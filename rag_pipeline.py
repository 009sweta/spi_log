#!/usr/bin/env python3
import hashlib
import json
import math
import os
import re
import socket
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# --- Corporate proxy / SSL-inspection compatibility -------------------------
# Some company laptops sit behind an SSL-inspecting proxy (Zscaler, Netskope,
# Forcepoint, etc.) whose intercepting CA cert doesn't mark the Basic
# Constraints extension as "critical" (technically required by RFC 5280).
# Python's bundled OpenSSL rejects that with:
#   [SSL: CERTIFICATE_VERIFY_FAILED] Basic Constraints of CA cert not marked
#   critical
# Windows' own certificate validator (what the browser uses) is more lenient,
# so we delegate verification to the OS trust store via `truststore` instead
# of certifi's bundled CA list. This must run before any HTTPS connection is
# made, and before other code creates an ssl.SSLContext.
_TRUSTSTORE_ACTIVE = False
if sys.version_info >= (3, 10):
    try:
        import truststore
        truststore.inject_into_ssl()
        _TRUSTSTORE_ACTIVE = True
    except ImportError:
        pass


def _insecure_ssl_context():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
UPLOADS_DIR = DATA_DIR / "rag_uploads"
VECTOR_DB_PATH = DATA_DIR / "vector_db.json"
ENV_PATH = ROOT_DIR / ".env"

OPENROUTER_EMBEDDING_MODEL = "nvidia/llama-nemotron-embed-vl-1b-v2:free"
GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile"


def ensure_dirs():
    DATA_DIR.mkdir(exist_ok=True)
    UPLOADS_DIR.mkdir(exist_ok=True)


def load_env_file():
    values = {}
    if not ENV_PATH.exists():
        return values
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def save_env_values(updates):
    values = load_env_file()
    for key, value in updates.items():
        if value is not None:
            if value == "":
                values.pop(key, None)
                os.environ.pop(key, None)
            else:
                values[key] = value
                os.environ[key] = value
    lines = [f"{key}={value}" for key, value in values.items()]
    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def get_setting(key, default=""):
    val = os.environ.get(key) or load_env_file().get(key)
    if val:
        return val
    if key in ("GROQ_API_KEY", "OPENROUTER_API_KEY"):
        return "ollama"
    if key == "GROQ_MODEL":
        api_key = os.environ.get("GROQ_API_KEY") or load_env_file().get("GROQ_API_KEY") or "ollama"
        if api_key == "ollama":
            return "01rohitkumar0104/tess"
    if key == "OLLAMA_EMBED_MODEL":
        return "nomic-embed-text"
    if key == "OLLAMA_HOST":
        return "http://localhost:11434"
    return default


def _build_opener(insecure=False):
    """
    Build a urllib opener that honors an explicitly configured corporate
    proxy. Needed because some corporate networks only resolve/route
    external domains through a proxy — direct connections fail DNS
    resolution with [Errno 11001] getaddrinfo failed. Set HTTPS_PROXY
    (and HTTP_PROXY if needed) in the .env file at the project root, e.g.:
        HTTPS_PROXY=http://proxyhost:8080
        HTTPS_PROXY=http://user:password@proxyhost:8080   (if auth required)
    If nothing is configured, falls back to the normal default opener
    (which still honors OS/env proxy settings automatically).
    """
    handlers = []
    https_proxy = get_setting("HTTPS_PROXY") or get_setting("https_proxy")
    http_proxy = get_setting("HTTP_PROXY") or get_setting("http_proxy")
    proxies = {}
    if https_proxy:
        proxies["https"] = https_proxy
    if http_proxy:
        proxies["http"] = http_proxy
    if proxies:
        handlers.append(urllib.request.ProxyHandler(proxies))
    if insecure:
        handlers.append(urllib.request.HTTPSHandler(context=_insecure_ssl_context()))
    return urllib.request.build_opener(*handlers)


def mask_key(value):
    if not value:
        return ""
    if len(value) <= 8:
        return "****"
    return f"{value[:4]}...{value[-4:]}"


def load_vector_db():
    ensure_dirs()
    if not VECTOR_DB_PATH.exists():
        return {"documents": []}
    try:
        return json.loads(VECTOR_DB_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"documents": []}


def save_vector_db(db):
    ensure_dirs()
    VECTOR_DB_PATH.write_text(json.dumps(db, indent=2), encoding="utf-8")


def list_documents():
    ensure_dirs()
    files = []
    for path in sorted(UPLOADS_DIR.iterdir()):
        if path.is_file():
            files.append({"name": path.name, "size": path.stat().st_size})
    db = load_vector_db()
    return {"files": files, "chunks": len(db.get("documents", []))}


def delete_document(filename):
    ensure_dirs()
    target = UPLOADS_DIR / safe_filename(filename)
    if target.exists():
        target.unlink()
    db = load_vector_db()
    
    # Remove from indexed cache
    if "indexed_files" in db and target.name in db["indexed_files"]:
        del db["indexed_files"][target.name]
        
    before = len(db.get("documents", []))
    db["documents"] = [doc for doc in db.get("documents", []) if doc.get("source") != target.name]
    
    # Always save to update indexed_files list if needed
    save_vector_db(db)


def safe_filename(name):
    name = os.path.basename(name or "document.txt")
    return re.sub(r"[^A-Za-z0-9._ -]", "_", name) or "document.txt"


def read_document_text(path):
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md", ".csv", ".log"}:
        return path.read_text(encoding="utf-8", errors="replace")
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise RuntimeError("PDF support requires pypdf. Upload TXT/MD files or install pypdf.") from exc
        reader = PdfReader(str(path))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    raise RuntimeError(f"Unsupported document type: {path.suffix}")


def chunk_text(text, max_words=180):
    text = re.sub(r"[\u200b\u200c\u200d\ufeff]", " ", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    chunks = []
    for paragraph in re.split(r"\n\s*\n", text):
        words = paragraph.strip().split()
        if not words:
            continue
        for idx in range(0, len(words), max_words):
            chunk = " ".join(words[idx:idx + max_words]).strip()
            if len(chunk) >= 30:
                chunks.append(chunk)
    return chunks


def request_json(url, headers, payload):
    data = json.dumps(payload).encode("utf-8")
    req_headers = dict(headers)
    if "User-Agent" not in req_headers:
        req_headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    request = urllib.request.Request(url, data=data, headers=req_headers, method="POST")
    try:
        is_local = "localhost" in url or "127.0.0.1" in url
        insecure = (get_setting("SPU_ALLOW_INSECURE_SSL") == "1")
        opener = urllib.request.build_opener() if is_local else _build_opener(insecure=insecure)
        with opener.open(request, timeout=90) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {body}") from exc
    except ssl.SSLCertVerificationError as exc:
        raise RuntimeError(
            "SSL certificate verification failed. This is usually caused by a "
            "company network/proxy (e.g. Zscaler, Netskope) that inspects HTTPS "
            "traffic with a non-standard certificate. Please turn on 'Bypass SSL "
            "Verification' in the API Settings panel."
        ) from exc
    except urllib.error.URLError as exc:
        reason = exc.reason
        if isinstance(reason, socket.gaierror):
            host = urllib.parse.urlparse(url).hostname
            raise RuntimeError(
                f"Could not resolve '{host}' (DNS lookup failed, errno 11001). "
                "This network likely requires going through a corporate proxy "
                "to reach external sites. Please check your proxy settings in the "
                "API Settings panel."
            ) from exc
        elif "CERTIFICATE_VERIFY_FAILED" in str(reason) or (isinstance(reason, ssl.SSLError) and "verify failed" in str(reason).lower()):
            raise RuntimeError(
                "SSL certificate verification failed. This is usually caused by a "
                "company network/proxy (e.g. Zscaler, Netskope) that inspects HTTPS "
                "traffic with a non-standard certificate. Please turn on 'Bypass SSL "
                "Verification' in the API Settings panel."
            ) from exc
        raise


def get_embeddings(texts, api_key=None, input_type=None):
    clean = [text.strip() for text in texts if text.strip()]
    if not clean:
        return []
    ollama_host = get_setting("OLLAMA_HOST") or "http://localhost:11434"
    url = f"{ollama_host.rstrip('/')}/v1/embeddings"
    model_name = get_setting("OLLAMA_EMBED_MODEL") or "nomic-embed-text"
    payload = {
        "model": model_name,
        "input": clean,
    }
    headers = {
        "Content-Type": "application/json",
    }
    data = request_json(url, headers, payload)
    embeddings = sorted(data.get("data", []), key=lambda item: item.get("index", 0))
    if not embeddings:
        raise RuntimeError("Ollama returned no embeddings.")
    return [item["embedding"] for item in embeddings]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def magnitude(v):
    return math.sqrt(sum(x * x for x in v))


def cosine_similarity(a, b):
    if len(a) != len(b):
        return 0.0
    denom = magnitude(a) * magnitude(b)
    return dot(a, b) / denom if denom else 0.0


def ingest_documents(log_fn=None):
    ensure_dirs()
    openrouter_key = get_setting("OPENROUTER_API_KEY") or "ollama"

    def log(message):
        if log_fn:
            log_fn(message)

    db = load_vector_db()
    existing_ids = {doc.get("id") for doc in db.get("documents", [])}
    indexed_files = db.setdefault("indexed_files", {})
    pending = []

    files = [path for path in sorted(UPLOADS_DIR.iterdir()) if path.is_file()]
    log(f"Scanning {len(files)} uploaded documents.")

    new_indexed_metadata = {}

    for path in files:
        file_size = path.stat().st_size
        
        # Check if already indexed and size hasn't changed
        if path.name in indexed_files:
            if indexed_files[path.name] == file_size:
                log(f"{path.name}: already indexed (skipping chunking).")
                continue
            else:
                log(f"{path.name}: content changed, clearing old chunks to re-index...")
                # Delete old chunks for this file
                db["documents"] = [doc for doc in db.get("documents", []) if doc.get("source") != path.name]
                # Re-fetch existing ids list since we modified it
                existing_ids = {doc.get("id") for doc in db.get("documents", [])}
            
        text = read_document_text(path)
        chunks = chunk_text(text)
        log(f"{path.name}: {len(chunks)} chunks.")
        for chunk in chunks:
            chunk_id = hashlib.sha256(f"{path.name}\n{chunk}".encode("utf-8")).hexdigest()
            if chunk_id not in existing_ids:
                pending.append({"id": chunk_id, "source": path.name, "text": chunk})
        
        new_indexed_metadata[path.name] = file_size

    if not pending:
        # Update cache for files that might have been processed but generated no new chunks
        for name, size in new_indexed_metadata.items():
            indexed_files[name] = size
        save_vector_db(db)
        log("No new chunks to index.")
        return {"added": 0, "total": len(db.get("documents", []))}

    batch_size = 12
    added = 0
    for idx in range(0, len(pending), batch_size):
        batch = pending[idx:idx + batch_size]
        log(f"Embedding batch {idx // batch_size + 1} of {math.ceil(len(pending) / batch_size)}.")
        vectors = get_embeddings([item["text"] for item in batch], openrouter_key, "passage")
        for item, vector in zip(batch, vectors):
            db.setdefault("documents", []).append({
                "id": item["id"],
                "source": item["source"],
                "text": item["text"],
                "embedding": vector,
            })
            added += 1
            
        # Update the files cache as we successfully complete batches
        for item in batch:
            if item["source"] in new_indexed_metadata:
                indexed_files[item["source"]] = new_indexed_metadata[item["source"]]
                
        save_vector_db(db)

    log(f"Indexed {added} new chunks.")
    return {"added": added, "total": len(db.get("documents", []))}


def retrieve_context(query, top_k=4):
    openrouter_key = get_setting("OPENROUTER_API_KEY") or "ollama"

    db = load_vector_db()
    docs = db.get("documents", [])
    if not docs:
        return {"context": "", "hits": []}

    query_vector = get_embeddings([query], openrouter_key, "query")[0]
    scored = []
    for doc in docs:
        score = cosine_similarity(query_vector, doc.get("embedding", []))
        scored.append({**doc, "score": score})
    scored.sort(key=lambda item: item["score"], reverse=True)

    hits = [item for item in scored[:top_k] if item["score"] > 0.12]
    context = "\n\n---\n\n".join(
        f"[Source: {hit['source']} | score: {hit['score']:.3f}]\n{hit['text']}" for hit in hits
    )
    return {
        "context": context,
        "hits": [{"source": hit["source"], "score": round(hit["score"], 4)} for hit in hits],
    }


def query_groq(query, context, model=None):
    if not model or model in ("llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b", "llama3-8b-8192"):
        model = get_setting("GROQ_MODEL") or "01rohitkumar0104/tess"
    system_prompt = (
        "You are an SPU fault analysis assistant. Answer using the retrieved "
        "document context when it is relevant. If the context does not contain "
        "the answer, say that clearly and give the best next diagnostic step.\n\n"
        f"Retrieved context:\n{context or 'No matching context was retrieved.'}"
    )
    ollama_host = get_setting("OLLAMA_HOST") or "http://localhost:11434"
    url = f"{ollama_host.rstrip('/')}/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
    }
    data = request_json(
        url,
        headers,
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query},
            ],
            "temperature": 0.2,
        },
    )
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("Local LLM returned no completion.")
    return choices[0]["message"]["content"]


def ask(query, model=None):
    retrieval = retrieve_context(query)
    answer = query_groq(query, retrieval["context"], model=model)
    return {"answer": answer, "hits": retrieval["hits"]}
