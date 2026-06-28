const analyzeForm = document.getElementById("analyzeForm");
const runBtn = document.getElementById("runBtn");
const logOutput = document.getElementById("logOutput");
const filesList = document.getElementById("filesList");
const serverStatus = document.getElementById("serverStatus");
const serverStatusText = document.getElementById("serverStatusText");

const ragSettingsForm = document.getElementById("ragSettingsForm");
const ragSettingsStatus = document.getElementById("ragSettingsStatus");
const openRouterKeyInput = document.getElementById("openRouterKey");
const groqKeyInput = document.getElementById("groqKey");
const groqModelInput = document.getElementById("groqModel");
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

async function checkUnixFormat(file) {
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
    checkUnixFormat(file);
  } else {
    dropText.textContent = "Click or drag SPU log file here";
  }
}

logFileInput.addEventListener("change", () => {
  handleFileSelection(logFileInput.files[0]);
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

async function loadRagSettings() {
  try {
    const response = await fetch("/api/rag/settings");
    const data = await response.json();
    if (!data.success) return;
    openRouterKeyInput.placeholder = data.openRouterKey || "Used for Nvidia Nemotron embeddings";
    groqKeyInput.placeholder = data.groqKey || "Used for the chat completion model";
    groqModelInput.value = data.groqModel || "llama-3.3-70b-versatile";
    embeddingModelLabel.textContent = `Embedding: ${data.embeddingModel}`;
    groqModelLabel.textContent = `LLM: ${groqModelInput.value}`;
  } catch (error) {
    ragSettingsStatus.textContent = `Settings unavailable: ${error.message}`;
  }
}

ragSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  ragSettingsStatus.textContent = "Saving settings...";
  try {
    const response = await fetch("/api/rag/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        openRouterKey: openRouterKeyInput.value,
        groqKey: groqKeyInput.value,
        groqModel: groqModelInput.value,
      }),
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
    const response = await fetch("/api/rag/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, model: groqModelInput.value }),
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
