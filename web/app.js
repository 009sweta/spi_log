const analyzeForm = document.getElementById("analyzeForm");
const runBtn = document.getElementById("runBtn");
const logOutput = document.getElementById("logOutput");
const filesList = document.getElementById("filesList");
const serverStatus = document.getElementById("serverStatus");
const serverStatusText = document.getElementById("serverStatusText");

const ragSettingsForm = document.getElementById("ragSettingsForm");
const ragSettingsStatus = document.getElementById("ragSettingsStatus");
const llmProviderSelect = document.getElementById("llmProvider");
const cloudSettingsGroup = document.getElementById("cloudSettingsGroup");
const localSettingsGroup = document.getElementById("localSettingsGroup");
const openRouterKeyInput = document.getElementById("openRouterKey");
const groqKeyInput = document.getElementById("groqKey");
const groqModelInput = document.getElementById("groqModel");
const ollamaHostInput = document.getElementById("ollamaHost");
const ollamaChatModelInput = document.getElementById("ollamaChatModel");
const ollamaEmbedModelInput = document.getElementById("ollamaEmbedModel");
const httpsProxyInput = document.getElementById("httpsProxy");
const spuAllowInsecureSslCheckbox = document.getElementById("spuAllowInsecureSsl");
const embeddingModelLabel = document.getElementById("embeddingModelLabel");
const groqModelLabel = document.getElementById("groqModelLabel");
const ragUploadForm = document.getElementById("ragUploadForm");
const ragFilesInput = document.getElementById("ragFilesInput");
const ragFilesList = document.getElementById("ragFilesList");
const chunkCount = document.getElementById("chunkCount");
const ingestBtn = document.getElementById("ingestBtn");
const ingestLog = document.getElementById("ingestLog");
const ragQueryForm = document.getElementById("ragQueryForm");
const ragQuery = document.getElementById("ragQuery");
const askRagBtn = document.getElementById("askRagBtn");
const chatMessages = document.getElementById("chatMessages");
const retrievalHits = document.getElementById("retrievalHits");
const ragStatus = document.getElementById("ragStatus");

const stats = {
  total: document.getElementById("totalEntries"),
  alarms: document.getElementById("alarmsDetected"),
  a: document.getElementById("classA"),
  b: document.getElementById("classB"),
  c: document.getElementById("classC"),
  d: document.getElementById("classD"),
};

const fileDropzone = document.getElementById("fileDropzone");
const logFileInput = document.getElementById("logFile");
const dropText = document.getElementById("dropText");

async function checkLogFileFormat(file) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await fetch("/api/check-unix", {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    if (data.success) {
      addLog(`File check: ${data.filename} format is ${data.lineEndings} (${data.isUnix ? "Unix LF" : "Not Unix"}).`);
      
      const badgeClass = data.isUnix ? "unix" : "non-unix";
      dropText.innerHTML = `${escapeHTML(file.name)} <span class="format-badge ${badgeClass}">${data.lineEndings}</span>`;
    } else {
      addLog(`Format check failed: ${data.error}`);
    }
  } catch (err) {
    addLog(`Format check error: ${err.message}`);
  }
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function handleFileSelection(file) {
  if (file) {
    dropText.textContent = "Checking format...";
    checkLogFileFormat(file);
  } else {
    dropText.textContent = "Click or drag SPU log file here";
  }
}

logFileInput.addEventListener("change", () => {
  handleFileSelection(logFileInput.files[0]);
});

if (fileDropzone && logFileInput) {
  fileDropzone.addEventListener("click", (e) => {
    if (e.target !== logFileInput) {
      logFileInput.click();
    }
  });

  fileDropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    fileDropzone.classList.add("drag-active");
  });
  fileDropzone.addEventListener("dragleave", () => {
    fileDropzone.classList.remove("drag-active");
  });
  fileDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    fileDropzone.classList.remove("drag-active");
    if (e.dataTransfer.files.length) {
      logFileInput.files = e.dataTransfer.files;
      handleFileSelection(e.dataTransfer.files[0]);
    }
  });
}

document.querySelectorAll(".result-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".result-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.target).classList.add("active");
  });
});

function setActiveTab(tabId) {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  document.querySelectorAll(".page-view").forEach((view) => {
    view.classList.toggle("active", view.id === tabId);
  });
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setActiveTab(button.dataset.tab));
});

function addLog(message) {
  const time = new Date().toLocaleTimeString();
  logOutput.textContent += `\n[${time}] ${message}`;
  logOutput.scrollTop = logOutput.scrollHeight;
}

function setAnalyzeBusy(isBusy) {
  runBtn.disabled = isBusy;
  runBtn.textContent = isBusy ? "Processing..." : "Generate Reports";
}

function resetStats() {
  Object.values(stats).forEach((node) => {
    node.textContent = "-";
  });
  ["cardTotal", "cardAlarms", "cardA", "cardB", "cardC", "cardD"].forEach(id => {
    const card = document.getElementById(id);
    if (card) {
      card.classList.remove("has-data", "has-alarms");
    }
  });
}

function updateCardState(id, value, isAlarm = false) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.toggle("has-data", value > 0);
  if (isAlarm) {
    card.classList.toggle("has-alarms", value > 0);
  }
}

function setStats(data) {
  stats.total.textContent = Number(data.total || 0).toLocaleString();
  stats.alarms.textContent = Number(data.alarms || 0).toLocaleString();
  stats.a.textContent = data.classes?.A ?? 0;
  stats.b.textContent = data.classes?.B ?? 0;
  stats.c.textContent = data.classes?.C ?? 0;
  stats.d.textContent = data.classes?.D ?? 0;

  updateCardState("cardTotal", data.total || 0);
  updateCardState("cardAlarms", data.alarms || 0, true);
  updateCardState("cardA", data.classes?.A || 0, true);
  updateCardState("cardB", data.classes?.B || 0, true);
  updateCardState("cardC", data.classes?.C || 0, true);
  updateCardState("cardD", data.classes?.D || 0, true);
}

function renderFiles(paths) {
  if (!paths || paths.length === 0) {
    filesList.className = "files-list empty";
    filesList.innerHTML = `<div class="empty-state"><p class="empty-state-text">No reports generated yet.</p></div>`;
    return;
  }

  filesList.className = "files-list";
  filesList.innerHTML = "";
  paths.forEach((filePath) => {
    const row = document.createElement("div");
    row.className = "file-row";

    const info = document.createElement("div");
    const name = document.createElement("div");
    const path = document.createElement("div");
    const button = document.createElement("button");

    name.className = "file-name";
    name.textContent = filePath.split(/[\\/]/).pop();
    path.className = "file-path";
    path.textContent = filePath;
    info.append(name, path);

    button.className = "file-open-btn";
    button.type = "button";
    button.textContent = "Open";
    button.addEventListener("click", () => openFile(filePath));

    row.append(info, button);
    filesList.append(row);
  });
}

async function openFile(filePath) {
  try {
    const response = await fetch("/api/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });
    const data = await response.json();
    if (!data.success) addLog(`Open failed: ${data.error || "Unknown error"}`);
  } catch (error) {
    addLog(`Open failed: ${error.message}`);
  }
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    serverStatus.className = "status-dot ok";
    serverStatusText.textContent = "Python server ready";
  } catch (error) {
    serverStatus.className = "status-dot error";
    serverStatusText.textContent = "Server unavailable";
  }
}

document.getElementById("clearLog").addEventListener("click", () => {
  logOutput.textContent = "Log cleared.";
});

analyzeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = logFileInput.files[0];
  if (!file) {
    addLog("Please select a log file first.");
    return;
  }

  resetStats();
  renderFiles([]);
  
  document.getElementById("resultsEmptyState").style.display = "none";
  document.getElementById("resultsContent").style.display = "block";

  logOutput.textContent = "Starting analysis...";
  addLog(`File: ${file.name}`);
  addLog(`Time window: ${document.getElementById("startTime").value} to ${document.getElementById("endTime").value}`);
  addLog("Uploading to local Python analyzer...");

  setAnalyzeBusy(true);
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: new FormData(analyzeForm),
    });
    const data = await response.json();
    if (!data.success) {
      addLog(`Analysis failed: ${data.error || "Unknown error"}`);
      return;
    }
    setStats(data);
    renderFiles(data.outputs);
    addLog(`Processed ${Number(data.total).toLocaleString()} entries and ${Number(data.alarms).toLocaleString()} alarms.`);
    addLog("Reports generated successfully.");
  } catch (error) {
    addLog(`Request failed: ${error.message}`);
  } finally {
    setAnalyzeBusy(false);
  }
});

// Toggle provider groups
if (llmProviderSelect) {
  llmProviderSelect.addEventListener("change", () => {
    const isLocal = llmProviderSelect.value === "local";
    cloudSettingsGroup.style.display = isLocal ? "none" : "block";
    localSettingsGroup.style.display = isLocal ? "block" : "none";
  });
}

async function loadRagSettings() {
  try {
    const response = await fetch("/api/rag/settings");
    const data = await response.json();
    if (!data.success) return;

    const isLocal = data.groqKey === "ollama" || data.openRouterKey === "ollama";
    if (llmProviderSelect) {
      llmProviderSelect.value = isLocal ? "local" : "cloud";
    }
    if (cloudSettingsGroup) {
      cloudSettingsGroup.style.display = isLocal ? "none" : "block";
    }
    if (localSettingsGroup) {
      localSettingsGroup.style.display = isLocal ? "block" : "none";
    }

    openRouterKeyInput.placeholder = data.openRouterKey && data.openRouterKey !== "ollama" ? data.openRouterKey : "sk-or-v1-...";
    groqKeyInput.placeholder = data.groqKey && data.groqKey !== "ollama" ? data.groqKey : "gsk_...";
    
    if (isLocal) {
      ollamaChatModelInput.value = data.groqModel || "llama3";
    } else {
      groqModelInput.value = data.groqModel || "llama-3.3-70b-versatile";
    }

    ollamaHostInput.value = data.ollamaHost || "";
    ollamaEmbedModelInput.value = data.ollamaEmbedModel || "";
    httpsProxyInput.value = data.httpsProxy || "";
    spuAllowInsecureSslCheckbox.checked = !!data.allowInsecureSsl;

    embeddingModelLabel.textContent = isLocal
      ? `Embedding: ${data.ollamaEmbedModel || "nomic-embed-text"} (Local)`
      : `Embedding: ${data.embeddingModel}`;
    groqModelLabel.textContent = isLocal
      ? `LLM: ${data.groqModel || "llama3"} (Local)`
      : `LLM: ${data.groqModel || "llama-3.3-70b-versatile"}`;
  } catch (error) {
    ragSettingsStatus.textContent = `Settings unavailable: ${error.message}`;
  }
}

ragSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  ragSettingsStatus.textContent = "Saving settings...";
  try {
    const isLocal = llmProviderSelect.value === "local";
    const payload = {
      provider: llmProviderSelect.value,
      httpsProxy: httpsProxyInput.value.trim(),
      allowInsecureSsl: spuAllowInsecureSslCheckbox.checked,
    };

    if (isLocal) {
      payload.groqModel = ollamaChatModelInput.value.trim() || "llama3";
      payload.ollamaHost = ollamaHostInput.value.trim();
      payload.ollamaEmbedModel = ollamaEmbedModelInput.value.trim() || "nomic-embed-text";
    } else {
      payload.openRouterKey = openRouterKeyInput.value.trim();
      payload.groqKey = groqKeyInput.value.trim();
      payload.groqModel = groqModelInput.value;
    }

    const response = await fetch("/api/rag/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "Save failed");
    openRouterKeyInput.value = "";
    groqKeyInput.value = "";
    ragSettingsStatus.textContent = "Settings saved.";
    await loadRagSettings();
  } catch (error) {
    ragSettingsStatus.textContent = `Save failed: ${error.message}`;
  }
});

function renderRagFiles(files, chunks) {
  chunkCount.textContent = `${Number(chunks || 0).toLocaleString()} chunks`;
  if (!files || files.length === 0) {
    ragFilesList.className = "doc-list empty";
    ragFilesList.textContent = "No documents uploaded.";
    return;
  }

  ragFilesList.className = "doc-list";
  ragFilesList.innerHTML = "";
  files.forEach((file) => {
    const row = document.createElement("div");
    row.className = "doc-row";

    const info = document.createElement("div");
    const name = document.createElement("div");
    const size = document.createElement("div");
    const button = document.createElement("button");

    name.className = "doc-name";
    name.textContent = file.name;
    size.className = "doc-size";
    size.textContent = `${(Number(file.size || 0) / 1024).toFixed(1)} KB`;
    info.append(name, size);

    button.className = "doc-delete-btn";
    button.type = "button";
    button.textContent = "Remove";
    button.addEventListener("click", () => deleteRagFile(file.name));

    row.append(info, button);
    ragFilesList.append(row);
  });
}

async function loadRagFiles() {
  try {
    const response = await fetch("/api/rag/files");
    const data = await response.json();
    if (data.success) renderRagFiles(data.files, data.chunks);
  } catch (error) {
    ragFilesList.className = "doc-list empty";
    ragFilesList.textContent = `Unable to load documents: ${error.message}`;
  }
}

ragFilesInput.addEventListener("change", () => {
  const count = ragFilesInput.files.length;
  const label = document.querySelector(".upload-zone span");
  label.textContent = count ? `${count} selected` : "Choose documents";
});

ragUploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (ragFilesInput.files.length === 0) return;
  document.getElementById("uploadRagBtn").disabled = true;
  try {
    const formData = new FormData();
    Array.from(ragFilesInput.files).forEach((file) => formData.append("files", file));
    const response = await fetch("/api/rag/upload", { method: "POST", body: formData });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "Upload failed");
    ragFilesInput.value = "";
    document.querySelector(".upload-zone span").textContent = "Choose documents";
    renderRagFiles(data.files, data.chunks);
  } catch (error) {
    ingestLog.textContent = `Upload failed: ${error.message}`;
  } finally {
    document.getElementById("uploadRagBtn").disabled = false;
  }
});

async function deleteRagFile(name) {
  try {
    const response = await fetch(`/api/rag/files/${encodeURIComponent(name)}`, { method: "DELETE" });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "Delete failed");
    renderRagFiles(data.files, data.chunks);
  } catch (error) {
    ingestLog.textContent = `Delete failed: ${error.message}`;
  }
}

ingestBtn.addEventListener("click", async () => {
  ingestBtn.disabled = true;
  ingestLog.textContent = "Starting ingestion...";
  try {
    const response = await fetch("/api/rag/ingest", { method: "POST" });
    const data = await response.json();
    ingestLog.textContent = (data.logs || []).join("\n") || "No ingestion logs returned.";
    if (!data.success) throw new Error(data.error || "Ingestion failed");
    renderRagFiles(data.files, data.chunks);
  } catch (error) {
    ingestLog.textContent += `\n${error.message}`;
  } finally {
    ingestBtn.disabled = false;
  }
});

function addMessage(role, text) {
  const wrapper = document.createElement("div");
  const para = document.createElement("p");
  wrapper.className = `message ${role}`;
  para.textContent = text;
  wrapper.append(para);
  chatMessages.append(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderHits(hits) {
  retrievalHits.innerHTML = "";
  if (!hits || hits.length === 0) return;
  hits.forEach((hit) => {
    const pill = document.createElement("span");
    pill.className = "hit-pill";
    pill.textContent = `${hit.source} - ${Number(hit.score).toFixed(3)}`;
    retrievalHits.append(pill);
  });
}

ragQueryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = ragQuery.value.trim();
  if (!query) return;

  addMessage("user", query);
  ragQuery.value = "";
  askRagBtn.disabled = true;
  ragStatus.textContent = "Retrieving";
  renderHits([]);

  try {
    const isLocal = llmProviderSelect ? llmProviderSelect.value === "local" : true;
    const modelToSend = isLocal ? (ollamaChatModelInput ? ollamaChatModelInput.value.trim() : "01rohitkumar0104/tess") : (groqModelInput ? groqModelInput.value : "");
    const response = await fetch("/api/rag/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, model: modelToSend }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || "Query failed");
    addMessage("assistant", data.answer);
    renderHits(data.hits);
    ragStatus.textContent = "Ready";
  } catch (error) {
    addMessage("assistant", `Error: ${error.message}`);
    ragStatus.textContent = "Error";
  } finally {
    askRagBtn.disabled = false;
  }
});

checkHealth();
loadRagSettings();
loadRagFiles();

// UNIX CHECKER FEATURE
let workspaceRoot = "";
let scannedUnixFiles = [];
let activeUnixFilter = "all";

const unixFileDropzone = document.getElementById("unixFileDropzone");
const unixFileInput = document.getElementById("unixFile");
const unixFolderInput = document.getElementById("unixFolder");
const unixDropText = document.getElementById("unixDropText");
const selectFilesLink = document.getElementById("selectFilesLink");
const selectFolderLink = document.getElementById("selectFolderLink");

const unixLocalPathInput = document.getElementById("unixLocalPath");
const unixScanBtn = document.getElementById("unixScanBtn");
const unixResetPathBtn = document.getElementById("unixResetPathBtn");

const unixResultsPanel = document.getElementById("unixResultsPanel");
const unixTotalFiles = document.getElementById("unixTotalFiles");
const unixCompliantFiles = document.getElementById("unixCompliantFiles");
const unixNonCompliantFiles = document.getElementById("unixNonCompliantFiles");
const complianceScorePercent = document.getElementById("complianceScorePercent");
const complianceRatioFill = document.getElementById("complianceRatioFill");

const unixReplaceAllBtn = document.getElementById("unixReplaceAllBtn");
const unixDownloadAllBtn = document.getElementById("unixDownloadAllBtn");
const unixFileSearch = document.getElementById("unixFileSearch");
const unixFilesTableBody = document.getElementById("unixFilesTableBody");

const countAll = document.getElementById("countAll");
const countNonUnix = document.getElementById("countNonUnix");
const countUnix = document.getElementById("countUnix");
const countBinary = document.getElementById("countBinary");

// Load Workspace Info
async function loadWorkspaceInfo() {
  try {
    const response = await fetch("/api/workspace-info");
    const data = await response.json();
    if (data.success && data.workspaceRoot) {
      workspaceRoot = data.workspaceRoot;
      if (unixLocalPathInput) {
        unixLocalPathInput.value = workspaceRoot;
      }
    }
  } catch (err) {
    console.error("Failed to load workspace root path:", err);
  }
}

// Hook up path scan controls
if (unixScanBtn && unixLocalPathInput) {
  unixScanBtn.addEventListener("click", () => {
    const path = unixLocalPathInput.value.trim();
    if (path) {
      scanLocalPath(path);
    }
  });
}

if (unixResetPathBtn) {
  unixResetPathBtn.addEventListener("click", () => {
    if (unixLocalPathInput) {
      unixLocalPathInput.value = workspaceRoot;
    }
  });
}

// File and folder selection links
if (selectFilesLink && unixFileInput) {
  selectFilesLink.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    unixFileInput.click();
  });
}

if (selectFolderLink && unixFolderInput) {
  selectFolderLink.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    unixFolderInput.click();
  });
}

if (unixFileInput) {
  unixFileInput.addEventListener("change", () => {
    if (unixFileInput.files.length) {
      handleBrowserFiles(Array.from(unixFileInput.files));
    }
  });
}

if (unixFolderInput) {
  unixFolderInput.addEventListener("change", () => {
    if (unixFolderInput.files.length) {
      const files = Array.from(unixFolderInput.files).map(file => {
        file.relativePath = file.webkitRelativePath || file.name;
        return file;
      });
      handleBrowserFiles(files);
    }
  });
}

// Drag & Drop Folder/Files
if (unixFileDropzone) {
  unixFileDropzone.addEventListener("click", (e) => {
    if (e.target !== selectFilesLink && e.target !== selectFolderLink && e.target !== unixFileInput && e.target !== unixFolderInput) {
      unixFileInput.click();
    }
  });

  unixFileDropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    unixFileDropzone.classList.add("drag-active");
  });

  unixFileDropzone.addEventListener("dragleave", () => {
    unixFileDropzone.classList.remove("drag-active");
  });

  unixFileDropzone.addEventListener("drop", async (e) => {
    e.preventDefault();
    unixFileDropzone.classList.remove("drag-active");
    
    const items = e.dataTransfer.items;
    if (items && items.length) {
      const files = [];
      const traversePromises = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            traversePromises.push(traverseDirectoryEntry(entry).then(childFiles => {
              files.push(...childFiles);
            }));
          }
        }
      }
      
      await Promise.all(traversePromises);
      if (files.length) {
        handleBrowserFiles(files);
      }
    } else if (e.dataTransfer.files.length) {
      handleBrowserFiles(Array.from(e.dataTransfer.files));
    }
  });
}

// Helper for recursive dir entry traversal
async function traverseDirectoryEntry(entry, path = "") {
  const files = [];
  if (entry.isFile) {
    const file = await new Promise((resolve) => entry.file(resolve));
    file.relativePath = path ? `${path}/${file.name}` : file.name;
    files.push(file);
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const entries = await new Promise((resolve) => {
      dirReader.readEntries(resolve);
    });
    for (const childEntry of entries) {
      const childFiles = await traverseDirectoryEntry(childEntry, path ? `${path}/${entry.name}` : entry.name);
      files.push(...childFiles);
    }
  }
  return files;
}

// Scan absolute path on server
async function scanLocalPath(path) {
  if (!path) return;
  unixScanBtn.disabled = true;
  unixScanBtn.textContent = "Scanning...";
  unixResultsPanel.style.display = "block";
  unixFilesTableBody.innerHTML = `<tr><td colspan="4" class="text-center">Scanning local path...</td></tr>`;
  
  try {
    const response = await fetch("/api/unix/scan-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path })
    });
    const data = await response.json();
    if (data.success) {
      addLog(`[Debug] Scan local response: ${JSON.stringify(data.files)}`);
      scannedUnixFiles = data.files.map(f => ({
        name: f.filename,
        path: f.path,
        relativePath: f.relativePath,
        lineEndings: f.lineEndings,
        isUnix: f.isUnix,
        fileType: f.fileType,
        local: true
      }));
      renderUnixBundle();
      addLog(`Scanned local path: ${path}. Found ${scannedUnixFiles.length} files.`);
    } else {
      unixFilesTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-error">Scan failed: ${escapeHTML(data.error)}</td></tr>`;
      alert("Scan failed: " + data.error);
    }
  } catch (err) {
    unixFilesTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-error">Scan error: ${escapeHTML(err.message)}</td></tr>`;
    alert("Error scanning path: " + err.message);
  } finally {
    unixScanBtn.disabled = false;
    unixScanBtn.textContent = "Scan Path";
  }
}

// Handle uploaded files/directories in-browser
async function handleBrowserFiles(files) {
  scannedUnixFiles = [];
  unixResultsPanel.style.display = "block";
  
  unixTotalFiles.textContent = "-";
  unixCompliantFiles.textContent = "-";
  unixNonCompliantFiles.textContent = "-";
  unixFilesTableBody.innerHTML = `<tr><td colspan="4" class="text-center">Analyzing ${files.length} files...</td></tr>`;
  
  for (let file of files) {
    const result = await checkFileContentLocally(file);
    scannedUnixFiles.push({
      name: file.name,
      path: "",
      relativePath: file.relativePath || file.name,
      lineEndings: result.lineEndings,
      isUnix: result.isUnix,
      fileType: result.fileType,
      local: false,
      content: file
    });
  }
  renderUnixBundle();
  addLog(`Analyzed ${scannedUnixFiles.length} uploaded files/folders.`);
}

function checkFileContentLocally(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const arrayBuffer = e.target.result;
      const view = new DataView(arrayBuffer);
      
      let isBinary = false;
      const scanLength = Math.min(arrayBuffer.byteLength, 8192);
      for (let i = 0; i < scanLength; i++) {
        if (view.getUint8(i) === 0) {
          isBinary = true;
          break;
        }
      }
      
      if (isBinary) {
        resolve({ isUnix: false, lineEndings: "Binary File", fileType: "Binary" });
        return;
      }
      
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const text = decoder.decode(arrayBuffer);
      
      addLog(`[Debug] Local file read "${file.name}" (size ${file.size} bytes). Text content starts with: ${JSON.stringify(text.substring(0, 100))}`);
      
      let isUnix = false;
      let lineEndings = "Unknown";
      
      if (text.includes("\r\n")) {
        lineEndings = "Windows (CRLF)";
        isUnix = false;
      } else if (text.includes("\n")) {
        lineEndings = "Unix (LF)";
        isUnix = true;
      } else if (text.includes("\r")) {
        lineEndings = "Mac (CR)";
        isUnix = false;
      } else {
        lineEndings = text.length > 0 ? "Single Line" : "Empty File";
        isUnix = true;
      }
      
      resolve({ isUnix, lineEndings, fileType: "Text" });
    };
    reader.readAsArrayBuffer(file.slice(0, 1024 * 1024));
  });
}

// Render the scanned files list, counts, filters
function renderUnixBundle() {
  if (!unixResultsPanel) return;

  const total = scannedUnixFiles.length;
  const compliant = scannedUnixFiles.filter(f => f.isUnix).length;
  const nonCompliant = scannedUnixFiles.filter(f => !f.isUnix && f.fileType !== "Binary").length;
  const binaryCount = scannedUnixFiles.filter(f => f.fileType === "Binary").length;

  unixTotalFiles.textContent = total;
  unixCompliantFiles.textContent = compliant;
  unixNonCompliantFiles.textContent = nonCompliant;

  const textFiles = total - binaryCount;
  const score = textFiles > 0 ? Math.round((compliant / textFiles) * 100) : 100;
  complianceScorePercent.textContent = `${score}%`;
  complianceRatioFill.style.width = `${score}%`;

  const nonUnixLocalPaths = scannedUnixFiles.filter(f => !f.isUnix && f.local && f.fileType !== "Binary").map(f => f.path);
  const nonUnixAll = scannedUnixFiles.filter(f => !f.isUnix && f.fileType !== "Binary");

  unixReplaceAllBtn.disabled = nonUnixLocalPaths.length === 0;
  unixDownloadAllBtn.disabled = nonUnixAll.length === 0;

  if (countAll) countAll.textContent = total;
  if (countNonUnix) countNonUnix.textContent = nonCompliant;
  if (countUnix) countUnix.textContent = compliant;
  if (countBinary) countBinary.textContent = binaryCount;

  filterAndRenderTable();
}

// Filter and render the rows in the table
function filterAndRenderTable() {
  if (!unixFilesTableBody) return;

  const searchTerm = (unixFileSearch ? unixFileSearch.value : "").trim().toLowerCase();
  
  const filtered = scannedUnixFiles.filter(file => {
    const matchesSearch = file.relativePath.toLowerCase().includes(searchTerm) || file.name.toLowerCase().includes(searchTerm);
    if (!matchesSearch) return false;

    if (activeUnixFilter === "non-unix") return !file.isUnix && file.fileType !== "Binary";
    if (activeUnixFilter === "unix") return file.isUnix;
    if (activeUnixFilter === "binary") return file.fileType === "Binary";
    return true;
  });

  if (filtered.length === 0) {
    unixFilesTableBody.innerHTML = `<tr><td colspan="4" class="text-center">No files match the criteria.</td></tr>`;
    return;
  }

  unixFilesTableBody.innerHTML = "";
  filtered.forEach(file => {
    const tr = document.createElement("tr");

    const tdPath = document.createElement("td");
    const fileIcon = document.createElement("span");
    fileIcon.className = "file-icon-mini";
    fileIcon.innerHTML = file.fileType === "Binary" 
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
    
    const textSpan = document.createElement("span");
    textSpan.className = "file-path-text";
    textSpan.textContent = file.relativePath;
    if (file.path) {
      textSpan.title = file.path;
    }
    tdPath.append(fileIcon, textSpan);

    const tdFormat = document.createElement("td");
    const badge = document.createElement("span");
    const badgeClass = file.isUnix ? "unix" : "non-unix";
    badge.className = `format-badge ${badgeClass}`;
    badge.textContent = file.lineEndings;
    tdFormat.appendChild(badge);

    const tdComp = document.createElement("td");
    tdComp.textContent = file.isUnix ? "✓ Yes" : (file.fileType === "Binary" ? "ℹ N/A" : "✗ No");
    tdComp.className = file.isUnix ? "text-success" : (file.fileType === "Binary" ? "text-muted" : "text-warning");

    const tdAction = document.createElement("td");
    tdAction.className = "td-actions";

    if (file.fileType !== "Binary") {
      if (!file.isUnix) {
        if (file.local) {
          const replaceBtn = document.createElement("button");
          replaceBtn.className = "action-btn replace-btn";
          replaceBtn.title = "Convert & Overwrite file at original path on disk";
          replaceBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Replace`;
          replaceBtn.addEventListener("click", () => replaceLocalFile(file));
          tdAction.appendChild(replaceBtn);
        }

        const downloadBtn = document.createElement("button");
        downloadBtn.className = "action-btn download-btn";
        downloadBtn.title = "Download converted LF version via browser";
        downloadBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download`;
        downloadBtn.addEventListener("click", () => downloadFile(file));
        tdAction.appendChild(downloadBtn);
      } else {
        const okSpan = document.createElement("span");
        okSpan.className = "text-success small-text";
        okSpan.textContent = "Ready";
        tdAction.appendChild(okSpan);
      }
    } else {
      const skipSpan = document.createElement("span");
      skipSpan.className = "text-muted small-text";
      skipSpan.textContent = "Binary (Skipped)";
      tdAction.appendChild(skipSpan);
    }

    tr.append(tdPath, tdFormat, tdComp, tdAction);
    unixFilesTableBody.appendChild(tr);
  });
}

// Replace a local file in-place on server
async function replaceLocalFile(file) {
  try {
    const response = await fetch("/api/unix/convert-and-replace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file.path })
    });
    const data = await response.json();
    if (data.success) {
      file.isUnix = true;
      file.lineEndings = "Unix (LF)";
      renderUnixBundle();
      addLog(`Replaced and converted file on disk: ${file.path}`);
    } else {
      alert("Replacement failed: " + data.errors.join("\n"));
    }
  } catch (err) {
    alert("Replacement error: " + err.message);
  }
}

// Download a single file
async function downloadFile(file) {
  if (file.local) {
    try {
      const response = await fetch("/api/unix/download-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file.path })
      });
      if (!response.ok) throw new Error("Server download failed");
      const blob = await response.blob();
      triggerDownload(blob, file.name);
      addLog(`Downloaded converted file: ${file.name}`);
    } catch (err) {
      alert("Download failed: " + err.message);
    }
  } else {
    try {
      const reader = new FileReader();
      reader.onload = function(e) {
        const text = e.target.result;
        const converted = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const blob = new Blob([converted], { type: "text/plain;charset=utf-8" });
        triggerDownload(blob, file.name);
        addLog(`Downloaded converted file: ${file.name}`);
      };
      reader.readAsText(file.content);
    } catch (err) {
      alert("Client conversion failed: " + err.message);
    }
  }
}

function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Bulk replace in source
if (unixReplaceAllBtn) {
  unixReplaceAllBtn.addEventListener("click", async () => {
    const localNonUnix = scannedUnixFiles.filter(f => !f.isUnix && f.local && f.fileType !== "Binary");
    if (!localNonUnix.length) return;

    if (!confirm(`Are you sure you want to convert and replace ${localNonUnix.length} files in place on your local disk?`)) {
      return;
    }

    unixReplaceAllBtn.disabled = true;
    unixReplaceAllBtn.textContent = "Replacing...";

    try {
      const response = await fetch("/api/unix/convert-and-replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: localNonUnix.map(f => f.path) })
      });
      const data = await response.json();
      if (data.success) {
        localNonUnix.forEach(file => {
          file.isUnix = true;
          file.lineEndings = "Unix (LF)";
        });
        renderUnixBundle();
        addLog(`Successfully replaced ${data.convertedCount} files in-place.`);
        if (data.errors && data.errors.length) {
          addLog(`Encountered warnings:\n${data.errors.join("\n")}`);
        }
      } else {
        alert("Batch replace failed: " + (data.errors || []).join("\n"));
      }
    } catch (err) {
      alert("Batch replace error: " + err.message);
    } finally {
      unixReplaceAllBtn.textContent = "Replace All CRLF in Source";
      unixReplaceAllBtn.disabled = false;
    }
  });
}

// Bulk download ZIP
if (unixDownloadAllBtn) {
  unixDownloadAllBtn.addEventListener("click", async () => {
    const nonUnix = scannedUnixFiles.filter(f => !f.isUnix && f.fileType !== "Binary");
    if (!nonUnix.length) return;

    unixDownloadAllBtn.disabled = true;
    unixDownloadAllBtn.textContent = "Zipping...";

    const localFiles = nonUnix.filter(f => f.local).map(f => ({ path: f.path, zipPath: f.relativePath }));
    
    if (localFiles.length) {
      try {
        const response = await fetch("/api/unix/convert-and-download-zip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: localFiles })
        });
        if (!response.ok) throw new Error("ZIP creation failed on server");
        
        const blob = await response.blob();
        triggerDownload(blob, "unix_converted_files.zip");
        addLog(`Downloaded ZIP containing ${localFiles.length} converted files.`);
      } catch (err) {
        alert("ZIP download failed: " + err.message);
      } finally {
        unixDownloadAllBtn.textContent = "Download Converted ZIP";
        unixDownloadAllBtn.disabled = false;
      }
    } else {
      addLog(`No local paths. Downloading ${nonUnix.length} files individually...`);
      for (let file of nonUnix) {
        await downloadFile(file);
      }
      unixDownloadAllBtn.textContent = "Download Converted ZIP";
      unixDownloadAllBtn.disabled = false;
    }
  });
}

// Search filter binding
if (unixFileSearch) {
  unixFileSearch.addEventListener("input", filterAndRenderTable);
}

// Filter tabs binding
document.querySelectorAll(".filter-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeUnixFilter = tab.dataset.filter;
    filterAndRenderTable();
  });
});

// Load workspace root and setup
loadWorkspaceInfo();
