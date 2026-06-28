import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { execFile, spawn } from 'child_process';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { ingestDocuments, retrieveContext, queryGroq } from './rag.js';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from project root (parent directory of /server)
const rootDir = path.resolve('..');
const envPath = path.join(rootDir, '.env');
dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Set up storage directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const LOGS_TEMP_DIR = path.join(__dirname, 'temp_logs');

[UPLOADS_DIR, LOGS_TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer for SPU log uploads
const logStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LOGS_TEMP_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});
const uploadLog = multer({ storage: logStorage });

// Configure Multer for RAG document uploads
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, file.originalname) // Keep original name for RAG reference
});
const uploadDocs = multer({ storage: docStorage });

// Helper to determine Windows python path
function getPythonPath() {
  const venvPython = path.join(rootDir, '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return 'python'; // fallback to global
}

// Global RAG progress log store (for long runs)
let ragProgressLogs = [];
const addRagLog = (msg) => {
  const timestamp = new Date().toLocaleTimeString();
  ragProgressLogs.push(`[${timestamp}] ${msg}`);
  console.log(`[RAG-Ingest] ${msg}`);
};

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// ─── SETTINGS ENDPOINTS ───────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  // Reload env file in case it was modified externally
  if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
  }

  const mask = (key) => {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  res.json({
    groqKey: mask(process.env.GROQ_API_KEY),
    openRouterKey: mask(process.env.OPENROUTER_API_KEY),
    hasGroq: !!process.env.GROQ_API_KEY,
    hasOpenRouter: !!process.env.OPENROUTER_API_KEY
  });
});

app.post('/api/settings', (req, res) => {
  const { groqKey, openRouterKey } = req.body;

  try {
    let envContent = '';
    
    // Read existing .env if it exists
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    const lines = envContent.split('\n');
    const newLines = [];
    let updatedGroq = false;
    let updatedOpenRouter = false;

    // Preserve existing settings and replace matching keys
    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('GROQ_API_KEY=')) {
        if (groqKey && !groqKey.includes('...')) {
          newLines.push(`GROQ_API_KEY=${groqKey}`);
          process.env.GROQ_API_KEY = groqKey;
        } else {
          newLines.push(line);
        }
        updatedGroq = true;
      } else if (trimmed.startsWith('OPENROUTER_API_KEY=')) {
        if (openRouterKey && !openRouterKey.includes('...')) {
          newLines.push(`OPENROUTER_API_KEY=${openRouterKey}`);
          process.env.OPENROUTER_API_KEY = openRouterKey;
        } else {
          newLines.push(line);
        }
        updatedOpenRouter = true;
      } else {
        newLines.push(line);
      }
    }

    if (!updatedGroq && groqKey && !groqKey.includes('...')) {
      newLines.push(`GROQ_API_KEY=${groqKey}`);
      process.env.GROQ_API_KEY = groqKey;
    }
    if (!updatedOpenRouter && openRouterKey && !openRouterKey.includes('...')) {
      newLines.push(`OPENROUTER_API_KEY=${openRouterKey}`);
      process.env.OPENROUTER_API_KEY = openRouterKey;
    }

    fs.writeFileSync(envPath, newLines.join('\n'), 'utf-8');
    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (e) {
    console.error('[SERVER] Failed to save settings:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── LOG ANALYZER ENDPOINT ────────────────────────────────────────────────────
app.post('/api/analyze', uploadLog.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No log file uploaded.' });
  }

  const { start, end, outdir } = req.body;
  const tempFilePath = req.file.path;
  const outputDir = outdir || path.join(process.env.USERPROFILE || rootDir, 'SPU_Reports');
  const pythonPath = getPythonPath();
  const cliScript = path.join(rootDir, 'app', 'cli.py');

  console.log(`[SERVER] Spawning Python CLI: ${pythonPath} ${cliScript}`);
  
  const processArgs = [
    cliScript,
    '--file', tempFilePath,
    '--start', start || '00:00',
    '--end', end || '23:59',
    '--outdir', outputDir
  ];

  execFile(pythonPath, processArgs, (error, stdout, stderr) => {
    // Delete the uploaded temporary file
    try {
      fs.unlinkSync(tempFilePath);
    } catch (err) {
      console.error('[SERVER] Temp file cleanup error:', err);
    }

    if (error) {
      console.error('[SERVER] CLI Exec error:', error, stderr);
      return res.status(500).json({
        success: false,
        error: `Python analysis failed. Details: ${stderr || error.message}`
      });
    }

    try {
      // Parse CLI stdout response (which is a JSON string)
      const data = JSON.parse(stdout.trim());
      res.json(data);
    } catch (e) {
      console.error('[SERVER] Failed to parse CLI stdout:', stdout);
      res.status(500).json({
        success: false,
        error: `Failed to parse Python output. Raw output: ${stdout}`
      });
    }
  });
});

// ─── RAG FILE MANAGER ─────────────────────────────────────────────────────────
app.get('/api/rag/files', (req, res) => {
  try {
    const files = fs.readdirSync(UPLOADS_DIR).map(name => {
      const filePath = path.join(UPLOADS_DIR, name);
      const stat = fs.statSync(filePath);
      return {
        name,
        size: stat.size,
        type: name.endsWith('.pdf') ? 'pdf' : 'txt'
      };
    });
    res.json({ success: true, files });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/rag/upload', uploadDocs.array('files'), (req, res) => {
  res.json({ success: true, message: 'Files uploaded successfully.' });
});

app.delete('/api/rag/files/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(UPLOADS_DIR, filename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Clean vector db matching records
    const dbPath = path.join(__dirname, 'data', 'vector_db.json');
    if (fs.existsSync(dbPath)) {
      const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      const beforeLength = db.documents.length;
      db.documents = db.documents.filter(doc => doc.source !== filename);
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
      console.log(`[RAG] Removed vector records for ${filename}. Count decreased from ${beforeLength} to ${db.documents.length}`);
    }

    res.json({ success: true, message: 'File deleted and vectors purged.' });
  } catch (e) {
    console.error(`[RAG] Error deleting file ${filename}:`, e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── RAG INGESTION & QUERY ────────────────────────────────────────────────────
app.post('/api/rag/ingest', async (req, res) => {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    return res.status(400).json({ success: false, error: 'OpenRouter API key is missing. Please set it in Settings.' });
  }

  ragProgressLogs = []; // Reset logs
  addRagLog('Starting document ingestion pipeline...');

  try {
    const result = await ingestDocuments(UPLOADS_DIR, openRouterKey, addRagLog);
    res.json({
      success: true,
      added: result.added,
      total: result.total,
      logs: ragProgressLogs
    });
  } catch (err) {
    addRagLog(`❌ Ingestion failed: ${err.message}`);
    res.status(500).json({
      success: false,
      error: err.message,
      logs: ragProgressLogs
    });
  }
});

app.post('/api/rag/query', async (req, res) => {
  const { query, model } = req.body;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!openRouterKey || !groqKey) {
    return res.status(400).json({
      success: false,
      error: 'Missing API keys. Please configure both Groq and OpenRouter keys in Settings.'
    });
  }

  if (!query) {
    return res.status(400).json({ success: false, error: 'No query provided.' });
  }

  try {
    const retrievalLogs = [];
    const logFn = (msg) => retrievalLogs.push(msg);

    // 1. Retrieve semantic context
    const context = await retrieveContext(query, openRouterKey, 3, logFn);

    // 2. Query Groq for inference
    const response = await queryGroq(query, context, groqKey, model || 'llama3-8b-8192');

    res.json({
      success: true,
      response,
      context,
      logs: retrievalLogs
    });
  } catch (err) {
    console.error('[RAG-Query] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/open', (req, res) => {
  const { path: filePath } = req.body;
  if (!filePath) {
    return res.status(400).json({ success: false, error: 'Path is required.' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found.' });
  }

  console.log(`[SERVER] Opening file: ${filePath}`);
  let proc;
  if (process.platform === 'win32') {
    proc = spawn('cmd.exe', ['/c', 'start', '""', filePath]);
  } else if (process.platform === 'darwin') {
    proc = spawn('open', [filePath]);
  } else {
    proc = spawn('xdg-open', [filePath]);
  }

  proc.on('error', (err) => {
    console.error('[SERVER] Failed to open file:', err);
    res.status(500).json({ success: false, error: err.message });
  });

  proc.on('close', () => {
    res.json({ success: true });
  });
});

// Serve frontend build static files in production
const frontendBuild = path.join(rootDir, 'client', 'dist');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  ⚡ SPU Log Analyzer Web Server ⚡`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`========================================`);
});
