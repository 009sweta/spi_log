import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pdf from 'pdf-parse/lib/pdf-parse.js';

// Paths
const DATA_DIR = path.resolve('data');
const VECTOR_DB_PATH = path.join(DATA_DIR, 'vector_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load vector database
function loadVectorDb() {
  if (fs.existsSync(VECTOR_DB_PATH)) {
    try {
      const data = fs.readFileSync(VECTOR_DB_PATH, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('[RAG] Error reading vector database, starting fresh:', e);
      return { documents: [] };
    }
  }
  return { documents: [] };
}

// Save vector database
function saveVectorDb(db) {
  fs.writeFileSync(VECTOR_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

// Math helpers for vector operations
function dotProduct(v1, v2) {
  if (v1.length !== v2.length) return 0;
  let dot = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
  }
  return dot;
}

function magnitude(v) {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(v1, v2) {
  const mag1 = magnitude(v1);
  const mag2 = magnitude(v2);
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct(v1, v2) / (mag1 * mag2);
}

// Text chunker (~150 words per chunk, respecting paragraphs)
function chunkText(text, maxWords = 150) {
  // Clean zero-width characters and normalise spacing
  let cleanText = text.replace(/\u200b/g, ' ')
                      .replace(/[\u200c\u200d\ufeff]/g, '')
                      .replace(/\r\n/g, '\n')
                      .replace(/\r/g, '\n');

  const paragraphs = cleanText.split('\n\n');
  const chunks = [];

  for (let p of paragraphs) {
    p = p.trim();
    if (!p) continue;
    const words = p.split(/\s+/);
    if (words.length > maxWords) {
      for (let i = 0; i < words.length; i += maxWords) {
        chunks.push(words.slice(i, i + maxWords).join(' '));
      }
    } else {
      chunks.push(p);
    }
  }
  return chunks;
}

// Get embeddings in batch from OpenRouter
async function getEmbeddingsBatch(texts, apiKey, model = 'nvidia/llama-nemotron-embed-vl-1b-v2:free') {
  if (!apiKey) throw new Error('OpenRouter API Key not configured.');
  
  const filteredTexts = texts.map(t => t.trim()).filter(Boolean);
  if (filteredTexts.length === 0) return [];

  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5000'
    },
    body: JSON.stringify({
      model: model,
      input: filteredTexts,
      input_type: 'passage'
    })
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    throw new Error(`OpenRouter Embeddings API failed: ${response.statusText}. Details: ${errorDetails}`);
  }

  const resData = await response.json();
  if (resData.data && resData.data.length > 0) {
    // Sort by index to maintain correct ordering matching the texts array
    const sorted = [...resData.data].sort((a, b) => a.index - b.index);
    return sorted.map(item => item.embedding);
  } else {
    throw new Error(`OpenRouter returned empty embedding response: ${JSON.stringify(resData)}`);
  }
}

// Get single query embedding
async function getQueryEmbedding(text, apiKey, model = 'nvidia/llama-nemotron-embed-vl-1b-v2:free') {
  if (!apiKey) throw new Error('OpenRouter API Key not configured.');
  
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5000'
    },
    body: JSON.stringify({
      model: model,
      input: [text.trim()],
      input_type: 'query'
    })
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    throw new Error(`OpenRouter Embeddings API failed: ${response.statusText}. Details: ${errorDetails}`);
  }

  const resData = await response.json();
  if (resData.data && resData.data.length > 0) {
    return resData.data[0].embedding;
  } else {
    throw new Error(`OpenRouter returned empty embedding response for query`);
  }
}

// Parse PDF text
async function parsePdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  try {
    const data = await pdf(dataBuffer);
    return data.text || '';
  } catch (error) {
    console.error(`[RAG] Failed to parse PDF ${path.basename(filePath)}:`, error);
    throw new Error(`PDF Parsing failed: ${error.message}`);
  }
}

// Ingest documents in uploads/ directory
export async function ingestDocuments(uploadsDir, openRouterKey, logFn = console.log) {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    return { added: 0, total: 0 };
  }

  const files = fs.readdirSync(uploadsDir);
  const chunksToEmbed = []; // Array of { text, source }

  logFn(`Scanning ${files.length} files in uploads folder...`);

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    let text = '';
    if (file.endsWith('.txt')) {
      try {
        text = fs.readFileSync(filePath, 'utf-8');
      } catch (err) {
        logFn(`⚠️ Error reading text file ${file}: ${err.message}`);
        continue;
      }
    } else if (file.endsWith('.pdf')) {
      try {
        logFn(`Extracting text from PDF: ${file}...`);
        text = await parsePdf(filePath);
      } catch (err) {
        logFn(`⚠️ Error parsing PDF ${file}: ${err.message}`);
        continue;
      }
    } else {
      continue; // Skip unsupported extensions
    }

    const fileChunks = chunkText(text);
    logFn(`Parsed ${file} → split into ${fileChunks.length} chunks.`);
    for (const chunk of fileChunks) {
      chunksToEmbed.push({ text: chunk, source: file });
    }
  }

  const db = loadVectorDb();
  const existingIds = new Set(db.documents.map(doc => doc.id));

  const newChunks = chunksToEmbed.filter(c => {
    const id = crypto.createHash('sha256').update(c.text).digest('hex');
    return !existingIds.has(id);
  });

  logFn(`Total chunks across files: ${chunksToEmbed.length}. New chunks to embed: ${newChunks.length}`);

  if (newChunks.length === 0) {
    logFn('All documents are already indexed. Skipping embedding.');
    return { added: 0, total: db.documents.length };
  }

  // Batch embed new chunks (batch size = 16 to respect rate limits / size)
  const batchSize = 16;
  let addedCount = 0;

  for (let i = 0; i < newChunks.length; i += batchSize) {
    const batch = newChunks.slice(i, i + batchSize);
    const texts = batch.map(c => c.text);
    
    try {
      logFn(`Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newChunks.length / batchSize)}...`);
      const vectors = await getEmbeddingsBatch(texts, openRouterKey);
      
      for (let j = 0; j < batch.length; j++) {
        const doc = batch[j];
        const id = crypto.createHash('sha256').update(doc.text).digest('hex');
        db.documents.push({
          id: id,
          text: doc.text,
          embedding: vectors[j],
          source: doc.source,
          timestamp: new Date().toISOString()
        });
        addedCount++;
      }
      
      saveVectorDb(db);
    } catch (err) {
      logFn(`❌ Batch embedding failed: ${err.message}`);
      throw err;
    }
  }

  logFn(`🎉 Successfully embedded and indexed ${addedCount} new chunks!`);
  return { added: addedCount, total: db.documents.length };
}

// Retrieve relevant context chunks matching the query
export async function retrieveContext(query, openRouterKey, topK = 3, logFn = console.log) {
  const db = loadVectorDb();
  if (db.documents.length === 0) {
    logFn('Vector database is empty. No context retrieved.');
    return '';
  }

  logFn(`Retrieving context for query: "${query}"...`);
  let queryVector;
  try {
    queryVector = await getQueryEmbedding(query, openRouterKey);
  } catch (err) {
    logFn(`⚠️ Query embedding failed: ${err.message}. Running RAG without semantic context.`);
    return '';
  }

  // Score each chunk
  const scoredDocs = db.documents.map(doc => {
    const similarity = cosineSimilarity(queryVector, doc.embedding);
    return { ...doc, similarity };
  });

  // Sort descending
  scoredDocs.sort((a, b) => b.similarity - a.similarity);

  // Filter chunks (similarity threshold e.g. > 0.15)
  // Consine similarity > 0.15 maps to cosine distance < 0.85
  const topHits = scoredDocs.filter(d => d.similarity > 0.15).slice(0, topK);
  logFn(`Semantic search found ${topHits.length} context hits. Top similarity: ${topHits[0]?.similarity?.toFixed(4) || 'N/A'}`);

  if (topHits.length === 0) {
    return '';
  }

  return topHits.map(h => `[Source File: ${h.source}]\n${h.text}`).join('\n\n---\n\n');
}

// Query Groq completions API
export async function queryGroq(query, context, groqKey, model = 'llama3-8b-8192') {
  if (!groqKey) throw new Error('Groq API Key not configured.');

  const systemPrompt = `You are a helpful SPU Fault Analysis Assistant. 
Use the following retrieved context documents to answer the user's questions about SPU fault analysis, severity classes, alarms, actions, remedies, and operational procedures.

=== RETRIEVED CONTEXT ===
${context || 'No context files found matching this query. Answer based on general system troubleshooting guidelines.'}

=== OPERATIONAL INSTRUCTIONS ===
1. Only answer based on the provided context where possible. If the context does not contain the answer, state that clearly.
2. Be professional, direct, and concise. Avoid unnecessary conversational filler.
3. If referring to a document, cite the [Source File] name in your response.`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    throw new Error(`Groq API failed: ${response.statusText}. Details: ${errorDetails}`);
  }

  const resData = await response.json();
  if (resData.choices && resData.choices.length > 0) {
    return resData.choices[0].message.content;
  } else {
    throw new Error(`Groq returned empty chat completion response`);
  }
}
