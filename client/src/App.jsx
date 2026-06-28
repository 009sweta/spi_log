import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Terminal, 
  Settings, 
  MessageSquare, 
  UploadCloud, 
  Play, 
  FolderOpen, 
  ExternalLink, 
  ShieldAlert, 
  Trash2, 
  RefreshCw, 
  Key, 
  Send,
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('analyzer');
  const [apiStatus, setApiStatus] = useState({ hasGroq: false, hasOpenRouter: false });
  const [settings, setSettings] = useState({ groqKey: '', openRouterKey: '', model: 'llama3-8b-8192' });
  const [saveStatus, setSaveStatus] = useState({ type: '', msg: '' });

  // SPU Analyzer State
  const [logFile, setLogFile] = useState(null);
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const [outDir, setOutDir] = useState('C:\\SPU_Reports');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzerLogs, setAnalyzerLogs] = useState([
    { type: 'hdr', text: '⚡ SPU Log Analyzer System Ready.' },
    { type: 'dim', text: 'Select a SPU log file (.csv, .xlsx, .txt), set the filter window, and run.' }
  ]);
  const [analysisStats, setAnalysisStats] = useState(null);
  const [generatedFiles, setGeneratedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  // RAG State
  const [ragFiles, setRagFiles] = useState([]);
  const [selectedRagFiles, setSelectedRagFiles] = useState([]);
  const [isUploadingRag, setIsUploadingRag] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionLogs, setIngestionLogs] = useState([]);
  const [chatMessages, setChatMessages] = useState([
    { role: 'system', content: 'Hello! I am your SPU Fault Analysis Assistant. Ask me anything about SPU fault classes, alarm codes, causes, and recommended actions based on your uploaded documentation.' }
  ]);
  const [chatQuery, setChatQuery] = useState('');
  const [isChatWaiting, setIsChatWaiting] = useState(false);
  const [chatLogs, setChatLogs] = useState([]);

  const logEndRef = useRef(null);
  const chatEndRef = useRef(null);
  const ingestLogEndRef = useRef(null);

  // Load API status and RAG files on mount
  useEffect(() => {
    fetchSettingsStatus();
    fetchRagFiles();
  }, []);

  // Auto scroll logs and chats
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [analyzerLogs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    ingestLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ingestionLogs]);

  const fetchSettingsStatus = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setApiStatus({ hasGroq: data.hasGroq, hasOpenRouter: data.hasOpenRouter });
      setSettings(prev => ({
        ...prev,
        groqKey: data.groqKey || '',
        openRouterKey: data.openRouterKey || ''
      }));
    } catch (e) {
      console.error('Failed to fetch settings status:', e);
    }
  };

  const fetchRagFiles = async () => {
    try {
      const res = await fetch('/api/rag/files');
      const data = await res.json();
      if (data.success) {
        setRagFiles(data.files);
      }
    } catch (e) {
      console.error('Failed to fetch RAG files:', e);
    }
  };

  // Handle keys save
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaveStatus({ type: 'info', msg: 'Saving credentials...' });
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groqKey: settings.groqKey,
          openRouterKey: settings.openRouterKey
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus({ type: 'success', msg: 'Credentials saved successfully.' });
        fetchSettingsStatus();
      } else {
        setSaveStatus({ type: 'error', msg: data.error || 'Failed to save settings.' });
      }
    } catch (err) {
      setSaveStatus({ type: 'error', msg: err.message });
    }
  };

  // SPU Log Analyzer logic
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setLogFile(e.dataTransfer.files[0]);
    }
  };

  const addAnalyzerLog = (text, type = '') => {
    setAnalyzerLogs(prev => [...prev, { text, type }]);
  };

  const runAnalysis = async () => {
    if (!logFile) return;
    setIsAnalyzing(true);
    setAnalyzerLogs([
      { type: 'hdr', text: '━'.repeat(50) },
      { type: 'bold', text: `Target File:   ${logFile.name}` },
      { type: 'dim', text: `Time Window:   ${startTime} ➔ ${endTime}` },
      { type: 'dim', text: `Output Path:   ${outDir}` },
      { type: 'hdr', text: '━'.repeat(50) }
    ]);

    addAnalyzerLog('Step 1 / 4  —  Uploading file to local analyzer...', 'step');
    
    const formData = new FormData();
    formData.append('file', logFile);
    formData.append('start', startTime);
    formData.append('end', endTime);
    formData.append('outdir', outDir);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        addAnalyzerLog('✔ Log cleaned and validated successfully.', 'ok');
        addAnalyzerLog(`✔ Processed: ${data.total.toLocaleString()} records  |  ${data.alarms.toLocaleString()} alarm events`, 'ok');
        if (data.classes.A) addAnalyzerLog(`    🔴 Class A (Critical): ${data.classes.A}`, 'err');
        if (data.classes.B) addAnalyzerLog(`    🟠 Class B (Major): ${data.classes.B}`, 'warn');
        if (data.classes.C) addAnalyzerLog(`    🟡 Class C (Minor): ${data.classes.C}`, 'dim');
        if (data.classes.D) addAnalyzerLog(`    🔵 Class D (Info): ${data.classes.D}`, 'dim');
        
        addAnalyzerLog('Step 2 / 4  —  Creating outputs folder...', 'step');
        addAnalyzerLog('Step 3 / 4  —  Writing filtered chronological export...', 'step');
        addAnalyzerLog('Step 4 / 4  —  Generating formatted fault analysis sheets...', 'step');
        addAnalyzerLog('🎉 Reports generated successfully!', 'ok');
        
        setAnalysisStats(data);
        setGeneratedFiles(data.outputs);
      } else {
        addAnalyzerLog(`❌ Analysis failed: ${data.error}`, 'err');
      }
    } catch (e) {
      addAnalyzerLog(`❌ Network error: ${e.message}`, 'err');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openLocalFile = async (path) => {
    try {
      await fetch('/api/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
    } catch (e) {
      alert('Error opening file: ' + e.message);
    }
  };

  // RAG document operations
  const uploadRagFiles = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingRag(true);
    
    const formData = new FormData();
    for (let file of files) {
      formData.append('files', file);
    }

    try {
      const res = await fetch('/api/rag/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        fetchRagFiles();
      }
    } catch (err) {
      alert('Failed to upload RAG files: ' + err.message);
    } finally {
      setIsUploadingRag(false);
    }
  };

  const deleteRagFile = async (name) => {
    if (!confirm(`Are you sure you want to remove ${name}? This will delete the document and purge its embeddings.`)) return;
    try {
      const res = await fetch(`/api/rag/files/${name}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchRagFiles();
      }
    } catch (err) {
      alert('Failed to delete file: ' + err.message);
    }
  };

  const runIngestion = async () => {
    setIsIngesting(true);
    setIngestionLogs(['[INFO] Initializing vector ingestion stream...']);

    try {
      const res = await fetch('/api/rag/ingest', { method: 'POST' });
      const data = await res.json();
      if (data.logs) {
        setIngestionLogs(data.logs);
      }
      if (data.success) {
        setIngestionLogs(prev => [...prev, `[SUCCESS] Ingested successfully. Total indexed database size: ${data.total} chunks.`]);
      } else {
        setIngestionLogs(prev => [...prev, `[ERROR] Ingestion failed: ${data.error}`]);
      }
    } catch (err) {
      setIngestionLogs(prev => [...prev, `[ERROR] Connection failed: ${err.message}`]);
    } finally {
      setIsIngesting(false);
    }
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatQuery.trim() || isChatWaiting) return;

    const userMsg = chatQuery.trim();
    setChatQuery('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatWaiting(true);
    setChatLogs(['Searching vector store...', 'Matching cosine similarities...']);

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMsg,
          model: settings.model
        })
      });
      const data = await res.json();

      if (data.success) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        if (data.logs) {
          setChatLogs(data.logs);
        }
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Error: ${data.error}` }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `❌ Error connecting: ${err.message}` }]);
    } finally {
      setIsChatWaiting(false);
    }
  };

  return (
    <div className="app-container">
      {/* ══ TOP BAR ══ */}
      <header className="topbar">
        <div className="brand">
          <div className="logo-glow">⚡</div>
          <div>
            <h1>SPU Log Analyzer Pro</h1>
            <p className="subtitle">High Performance Fault Processing & RAG Knowledgebase</p>
          </div>
        </div>
        <div className="api-pills">
          <div className={`pill ${apiStatus.hasGroq ? 'connected' : 'disconnected'}`}>
            <Sparkles size={12} />
            <span>Groq: {apiStatus.hasGroq ? 'Active' : 'Missing'}</span>
          </div>
          <div className={`pill ${apiStatus.hasOpenRouter ? 'connected' : 'disconnected'}`}>
            <Key size={12} />
            <span>OpenRouter: {apiStatus.hasOpenRouter ? 'Active' : 'Missing'}</span>
          </div>
          <div className="version-tag">v3.0</div>
        </div>
      </header>

      <div className="main-layout">
        {/* ══ SIDEBAR ══ */}
        <aside className="sidebar">
          <button 
            className={`nav-btn ${activeTab === 'analyzer' ? 'active' : ''}`}
            onClick={() => setActiveTab('analyzer')}
          >
            <FileText size={18} />
            <span>Log Analyzer</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'rag' ? 'active' : ''}`}
            onClick={() => setActiveTab('rag')}
          >
            <MessageSquare size={18} />
            <span>RAG Assistant</span>
          </button>
          <button 
            className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} />
            <span>API Settings</span>
          </button>
        </aside>

        {/* ══ MAIN VIEW CONTENT ══ */}
        <main className="content-area">
          
          {/* TAB 1: LOG ANALYZER */}
          {activeTab === 'analyzer' && (
            <div className="tab-pane active fade-in">
              <div className="pane-cols">
                {/* Inputs Sidebar */}
                <div className="pane-sidebar flex flex-col gap-5">
                  <div className="glass-card">
                    <h3 className="section-title">Log File Input</h3>
                    <div 
                      className={`drag-area ${dragActive ? 'active' : ''} ${logFile ? 'has-file' : ''}`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <UploadCloud size={32} className="upload-icon" />
                      {logFile ? (
                        <div className="file-info">
                          <p className="file-name">{logFile.name}</p>
                          <p className="file-size">{(logFile.size / 1024).toFixed(1)} KB</p>
                          <button className="change-file-btn" onClick={() => setLogFile(null)}>Change File</button>
                        </div>
                      ) : (
                        <div className="drag-prompt">
                          <p>Drag & Drop SPU log file here</p>
                          <span>or</span>
                          <label className="browse-label">
                            Browse File
                            <input 
                              type="file" 
                              accept=".csv,.xlsx,.xls,.txt,.log" 
                              onChange={(e) => e.target.files?.[0] && setLogFile(e.target.files[0])} 
                              className="hidden" 
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="glass-card">
                    <h3 className="section-title">Configuration</h3>
                    <div className="form-group">
                      <label>Time Range Window</label>
                      <div className="time-range-pickers">
                        <div className="picker-col">
                          <span>Start Time</span>
                          <input 
                            type="time" 
                            value={startTime} 
                            onChange={(e) => setStartTime(e.target.value)} 
                          />
                        </div>
                        <div className="picker-col">
                          <span>End Time</span>
                          <input 
                            type="time" 
                            value={endTime} 
                            onChange={(e) => setEndTime(e.target.value)} 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-group mt-3">
                      <label>Output Directory</label>
                      <input 
                        type="text" 
                        value={outDir} 
                        onChange={(e) => setOutDir(e.target.value)} 
                        className="text-input"
                      />
                    </div>

                    <button 
                      className={`run-btn ${!logFile || isAnalyzing ? 'disabled' : ''}`}
                      onClick={runAnalysis}
                      disabled={!logFile || isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          <span>Generate Reports</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Performance Dashboard & Terminal */}
                <div className="pane-main">
                  {/* GLOW STATS BADGES */}
                  <div className="stats-grid">
                    <div className="stat-card blue">
                      <div className="stat-value">{analysisStats ? analysisStats.total.toLocaleString() : '—'}</div>
                      <div className="stat-label">Total Log Entries</div>
                    </div>
                    <div className="stat-card orange">
                      <div className="stat-value">{analysisStats ? analysisStats.alarms.toLocaleString() : '—'}</div>
                      <div className="stat-label">Alarms Detected</div>
                    </div>
                    <div className="stat-card red">
                      <div className="stat-value">{analysisStats ? analysisStats.classes.A : '—'}</div>
                      <div className="stat-label">Class A (Critical)</div>
                    </div>
                    <div className="stat-card orange-light">
                      <div className="stat-value">{analysisStats ? analysisStats.classes.B : '—'}</div>
                      <div className="stat-label">Class B (Major)</div>
                    </div>
                    <div className="stat-card yellow">
                      <div className="stat-value">{analysisStats ? analysisStats.classes.C : '—'}</div>
                      <div className="stat-label">Class C (Minor)</div>
                    </div>
                    <div className="stat-card blue-light">
                      <div className="stat-value">{analysisStats ? analysisStats.classes.D : '—'}</div>
                      <div className="stat-label">Class D (Info)</div>
                    </div>
                  </div>

                  {/* LOGS TERMINAL */}
                  <div className="terminal-card">
                    <div className="terminal-header">
                      <Terminal size={14} />
                      <span>Headless Engine Output Console</span>
                    </div>
                    <div className="terminal-body">
                      {analyzerLogs.map((log, index) => (
                        <div key={index} className={`terminal-line ${log.type}`}>
                          {log.type === 'step' && <span className="step-bullet">➔</span>}
                          {log.type === 'ok' && <span className="success-bullet">✔</span>}
                          {log.type === 'err' && <span className="error-bullet">✘</span>}
                          <span>{log.text}</span>
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </div>
                  </div>

                  {/* GENERATED EXCEL FILES */}
                  {generatedFiles.length > 0 && (
                    <div className="glass-card mt-4">
                      <h3 className="section-title">Generated Excel Reports</h3>
                      <div className="files-list">
                        {generatedFiles.map((file, idx) => {
                          const isReport = file.toLowerCase().includes('report');
                          return (
                            <div key={idx} className="file-row">
                              <div className="file-icon-box">
                                <Database size={16} className={isReport ? 'report-color' : 'export-color'} />
                              </div>
                              <div className="file-details">
                                <p className="file-path">{path.basename(file)}</p>
                                <span>{isReport ? 'Detailed Diagnostic Report' : 'Clean Filtered Data Export'}</span>
                              </div>
                              <button 
                                className="open-file-btn"
                                onClick={() => openLocalFile(file)}
                              >
                                <ExternalLink size={12} />
                                <span>Open Excel</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RAG SYSTEM */}
          {activeTab === 'rag' && (
            <div className="tab-pane active fade-in">
              <div className="pane-cols">
                {/* RAG Knowledge base manager */}
                <div className="pane-sidebar flex flex-col gap-5">
                  <div className="glass-card">
                    <h3 className="section-title">Knowledge Documents</h3>
                    
                    <div className="doc-uploader mb-4">
                      <label className="rag-upload-label">
                        <UploadCloud size={16} />
                        <span>Upload PDF or TXT</span>
                        <input 
                          type="file" 
                          multiple 
                          accept=".pdf,.txt" 
                          onChange={uploadRagFiles}
                          disabled={isUploadingRag}
                          className="hidden" 
                        />
                      </label>
                      {isUploadingRag && <span className="uploading-spinner animate-spin">⌛</span>}
                    </div>

                    <div className="files-list scrollable-list max-h-52">
                      {ragFiles.length === 0 ? (
                        <p className="no-docs-text">No documents uploaded yet.</p>
                      ) : (
                        ragFiles.map((file, idx) => (
                          <div key={idx} className="rag-doc-row">
                            <FileText size={14} className="text-cyan-400" />
                            <div className="rag-doc-info">
                              <p className="rag-doc-name">{file.name}</p>
                              <span>{(file.size / 1024).toFixed(1)} KB</span>
                            </div>
                            <button 
                              className="rag-doc-delete"
                              onClick={() => deleteRagFile(file.name)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <button 
                      className={`ingest-btn mt-4 ${isIngesting || ragFiles.length === 0 ? 'disabled' : ''}`}
                      onClick={runIngestion}
                      disabled={isIngesting || ragFiles.length === 0}
                    >
                      {isIngesting ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Generating Embeddings...</span>
                        </>
                      ) : (
                        <>
                          <Database size={14} />
                          <span>Ingest & Index Files</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* INGESTION PROGRESS CONSOLE */}
                  {ingestionLogs.length > 0 && (
                    <div className="terminal-card compact flex-grow min-h-32">
                      <div className="terminal-header">
                        <Terminal size={12} />
                        <span>Embedding Progress</span>
                      </div>
                      <div className="terminal-body compact">
                        {ingestionLogs.map((l, i) => (
                          <div key={i} className="terminal-line dim">{l}</div>
                        ))}
                        <div ref={ingestLogEndRef} />
                      </div>
                    </div>
                  )}
                </div>

                {/* RAG CHAT INTERFACE */}
                <div className="pane-main flex flex-col height-full">
                  <div className="chat-container">
                    <div className="chat-header">
                      <MessageSquare size={16} />
                      <span>SPU Troubleshooting Copilot</span>
                    </div>

                    {/* Chat Bubble List */}
                    <div className="chat-messages">
                      {chatMessages.map((msg, index) => (
                        <div key={index} className={`chat-bubble-wrapper ${msg.role}`}>
                          <div className="chat-bubble">
                            <p>{msg.content}</p>
                          </div>
                        </div>
                      ))}
                      {isChatWaiting && (
                        <div className="chat-bubble-wrapper assistant">
                          <div className="chat-bubble typing">
                            <div className="dot"></div>
                            <div className="dot"></div>
                            <div className="dot"></div>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Chat Logs Monitor */}
                    {chatLogs.length > 0 && (
                      <div className="chat-retrieval-logs">
                        <div className="logs-header">
                          <Terminal size={10} />
                          <span>RAG Trace Pipeline</span>
                        </div>
                        <div className="logs-content">
                          {chatLogs.map((log, i) => (
                            <span key={i} className="log-pill">{log}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Input Area */}
                    <form onSubmit={sendChatMessage} className="chat-input-bar">
                      <input 
                        type="text" 
                        placeholder="Ask a question about SPU codes, classes, or troubleshooting manuals..."
                        value={chatQuery}
                        onChange={(e) => setChatQuery(e.target.value)}
                        disabled={isChatWaiting}
                      />
                      <button type="submit" disabled={isChatWaiting || !chatQuery.trim()}>
                        <Send size={16} />
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SETTINGS PANEL */}
          {activeTab === 'settings' && (
            <div className="tab-pane active fade-in max-w-xl">
              <div className="glass-card">
                <h3 className="section-title flex items-center gap-2">
                  <Key size={18} className="text-blue-400" />
                  <span>API Credentials Setup</span>
                </h3>
                <p className="card-desc mb-5">
                  Enter your credentials to enable RAG embeddings and LLM analysis. These keys are saved securely in your local environment configuration.
                </p>

                <form onSubmit={handleSaveSettings} className="settings-form">
                  <div className="form-group">
                    <label>Groq API Key</label>
                    <input 
                      type="password" 
                      placeholder={settings.groqKey ? `${settings.groqKey}` : 'enter groq api key...'}
                      value={settings.groqKey.includes('...') ? '' : settings.groqKey}
                      onChange={(e) => setSettings({ ...settings, groqKey: e.target.value })}
                      className="text-input"
                    />
                    <span>Used for executing queries against LLM models (e.g. llama3).</span>
                  </div>

                  <div className="form-group mt-4">
                    <label>OpenRouter API Key</label>
                    <input 
                      type="password" 
                      placeholder={settings.openRouterKey ? `${settings.openRouterKey}` : 'enter openrouter api key...'}
                      value={settings.openRouterKey.includes('...') ? '' : settings.openRouterKey}
                      onChange={(e) => setSettings({ ...settings, openRouterKey: e.target.value })}
                      className="text-input"
                    />
                    <span>Required to fetch vector embeddings from OpenRouter.</span>
                  </div>

                  <div className="form-group mt-4">
                    <label>Select Chat Model (Groq)</label>
                    <select 
                      value={settings.model}
                      onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                      className="select-input"
                    >
                      <option value="llama3-8b-8192">Llama 3 8B (Fast)</option>
                      <option value="llama-3.3-70b-specdec">Llama 3.3 70B (High Quality)</option>
                      <option value="mixtral-8x7b-32768">Mixtral 8x7B (Deep reasoning)</option>
                    </select>
                  </div>

                  {saveStatus.msg && (
                    <div className={`status-alert ${saveStatus.type} mt-4`}>
                      {saveStatus.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      <span>{saveStatus.msg}</span>
                    </div>
                  )}

                  <button type="submit" className="save-settings-btn mt-5">
                    Save Credentials
                  </button>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
