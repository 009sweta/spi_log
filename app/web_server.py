#!/usr/bin/env python3
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import traceback
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

APP_DIR = Path(__file__).resolve().parent
ROOT_DIR = APP_DIR.parent
WEB_DIR = ROOT_DIR / "web"
TEMP_DIR = ROOT_DIR / ".web_uploads"

sys.path.insert(0, str(APP_DIR))

from spu_log_analyzer import (  # noqa: E402
    _sheet_filtered_export,
    build_analysis_report,
    build_output_paths,
    load_and_filter,
)
from rag_pipeline import (  # noqa: E402
    GROQ_DEFAULT_MODEL,
    OPENROUTER_EMBEDDING_MODEL,
    UPLOADS_DIR,
    ask,
    delete_document,
    ensure_dirs,
    get_setting,
    ingest_documents,
    list_documents,
    mask_key,
    safe_filename,
    save_env_values,
)


def _json_response(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _safe_upload_name(name):
    name = os.path.basename(name or "upload.log")
    return re.sub(r"[^A-Za-z0-9._ -]", "_", name) or "upload.log"


def _parse_multipart(content_type, body):
    match = re.search(r'boundary="?([^";]+)"?', content_type or "")
    if not match:
        raise ValueError("Missing multipart boundary.")

    boundary = ("--" + match.group(1)).encode("utf-8")
    fields = {}
    files = {}

    for part in body.split(boundary):
        part = part.strip(b"\r\n")
        if not part or part == b"--":
            continue

        header_blob, sep, content = part.partition(b"\r\n\r\n")
        if not sep:
            continue

        headers = header_blob.decode("utf-8", errors="replace").split("\r\n")
        disposition = ""
        for header in headers:
            if header.lower().startswith("content-disposition:"):
                disposition = header
                break

        name_match = re.search(r'name="([^"]+)"', disposition)
        if not name_match:
            continue

        name = name_match.group(1)
        filename_match = re.search(r'filename="([^"]*)"', disposition)
        content = content.rstrip(b"\r\n")

        if filename_match:
            files.setdefault(name, []).append({
                "filename": _safe_upload_name(filename_match.group(1)),
                "content": content,
            })
        else:
            fields[name] = content.decode("utf-8", errors="replace")

    return fields, files


def _analyze(upload_path, start, end, outdir):
    start = start or "00:00"
    end = end or "23:59"
    outdir = outdir or str(Path.home() / "SPU_Reports")

    start_full = start + ":00"
    end_full = end + ":59"

    filtered, alarms, _ = load_and_filter(str(upload_path), start_full, end_full, log_fn=None)
    if len(filtered) == 0:
        return {
            "success": False,
            "error": f"No log entries found in the range {start} to {end}.",
        }

    classes = {}
    for cls in ("A", "B", "C", "D"):
        classes[cls] = int(len(alarms[alarms["Class"] == cls])) if "Class" in alarms.columns else 0

    out_data, out_report = build_output_paths(str(upload_path), start, end, outdir)
    _sheet_filtered_export(filtered, alarms, start_full, end_full, out_data)
    build_analysis_report(filtered, alarms, start_full, end_full, out_report)

    return {
        "success": True,
        "total": int(len(filtered)),
        "alarms": int(len(alarms)),
        "classes": classes,
        "outputs": [str(Path(out_data).resolve()), str(Path(out_report).resolve())],
    }


def _open_path(path):
    if sys.platform == "win32":
        os.startfile(path)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", path])
    else:
        subprocess.Popen(["xdg-open", path])


class Handler(BaseHTTPRequestHandler):
    server_version = "SPULogAnalyzer/1.0"

    def log_message(self, fmt, *args):
        print("[web]", fmt % args)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") if parsed.path != "/" else "/"
        
        if path == "/api/health":
            _json_response(self, HTTPStatus.OK, {"success": True, "status": "ok"})
            return
        if path == "/api/rag/settings":
            self._handle_rag_settings_get()
            return
        if path == "/api/rag/files":
            try:
                _json_response(self, HTTPStatus.OK, {"success": True, **list_documents()})
            except Exception as exc:
                _json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"success": False, "error": str(exc)})
            return

        request_path = "index.html" if parsed.path in ("", "/") else unquote(parsed.path.lstrip("/"))
        file_path = (WEB_DIR / request_path).resolve()

        try:
            file_path.relative_to(WEB_DIR.resolve())
        except ValueError:
            self.send_error(HTTPStatus.FORBIDDEN)
            return

        if not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        data = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/analyze":
            self._handle_analyze()
            return
        if parsed.path == "/api/check-unix":
            self._handle_check_unix()
            return
        if parsed.path == "/api/convert-unix":
            self._handle_convert_unix()
            return
        if parsed.path == "/api/open":
            self._handle_open()
            return
        if parsed.path == "/api/rag/settings":
            self._handle_rag_settings_post()
            return
        if parsed.path == "/api/rag/upload":
            self._handle_rag_upload()
            return
        if parsed.path == "/api/rag/ingest":
            self._handle_rag_ingest()
            return
        if parsed.path == "/api/rag/query":
            self._handle_rag_query()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        prefix = "/api/rag/files/"
        if parsed.path.startswith(prefix):
            self._handle_rag_delete(unquote(parsed.path[len(prefix):]))
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def _handle_analyze(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length)
            fields, files = _parse_multipart(self.headers.get("Content-Type", ""), body)
            upload_items = files.get("file") or []
            upload = upload_items[0] if upload_items else None
            if not upload or not upload["content"]:
                _json_response(self, HTTPStatus.BAD_REQUEST, {"success": False, "error": "No file uploaded."})
                return

            TEMP_DIR.mkdir(exist_ok=True)
            handle = tempfile.NamedTemporaryFile(
                prefix="spu_",
                suffix="_" + upload["filename"],
                dir=TEMP_DIR,
                delete=False,
            )
            upload_path = Path(handle.name)
            with handle:
                handle.write(upload["content"])

            try:
                result = _analyze(
                    upload_path,
                    fields.get("start", "00:00"),
                    fields.get("end", "23:59"),
                    fields.get("outdir", ""),
                )
            finally:
                upload_path.unlink(missing_ok=True)

            _json_response(self, HTTPStatus.OK, result)
        except Exception as exc:
            _json_response(
                self,
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"success": False, "error": str(exc), "trace": traceback.format_exc()},
            )

    def _handle_check_unix(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length)
            fields, files = _parse_multipart(self.headers.get("Content-Type", ""), body)
            upload_items = files.get("file") or []
            upload = upload_items[0] if upload_items else None
            if not upload or not upload["content"]:
                _json_response(self, HTTPStatus.BAD_REQUEST, {"success": False, "error": "No file uploaded."})
                return

            content = upload["content"]
            filename = upload["filename"]
            
            is_unix = False
            line_endings = "Unknown"
            
            if content:
                is_binary = b"\x00" in content[:8192]
                if is_binary:
                    line_endings = "Binary File"
                    is_unix = False
                else:
                    if b"\r\n" in content:
                        line_endings = "Windows (CRLF)"
                        is_unix = False
                    elif b"\n" in content:
                        line_endings = "Unix (LF)"
                        is_unix = True
                    elif b"\r" in content:
                        line_endings = "Mac (CR)"
                        is_unix = False
                    else:
                        line_endings = "Single Line"
                        is_unix = True
            else:
                line_endings = "Empty File"
                is_unix = True

            _json_response(self, HTTPStatus.OK, {
                "success": True,
                "filename": filename,
                "isUnix": is_unix,
                "lineEndings": line_endings
            })
        except Exception as exc:
            _json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"success": False, "error": str(exc)})

    def _handle_convert_unix(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length)
            fields, files = _parse_multipart(self.headers.get("Content-Type", ""), body)
            upload_items = files.get("file") or []
            upload = upload_items[0] if upload_items else None
            if not upload or not upload["content"]:
                _json_response(self, HTTPStatus.BAD_REQUEST, {"success": False, "error": "No file uploaded."})
                return

            content = upload["content"]
            filename = upload["filename"]
            
            converted_content = content.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
            
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(len(converted_content)))
            self.end_headers()
            self.wfile.write(converted_content)
        except Exception as exc:
            _json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"success": False, "error": str(exc)})

    def _handle_open(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            target = payload.get("path")
            if not target:
                _json_response(self, HTTPStatus.BAD_REQUEST, {"success": False, "error": "Path is required."})
                return
            if not os.path.exists(target):
                _json_response(self, HTTPStatus.NOT_FOUND, {"success": False, "error": "File not found."})
                return
            _open_path(target)
            _json_response(self, HTTPStatus.OK, {"success": True})
        except Exception as exc:
            _json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"success": False, "error": str(exc)})

    def _handle_rag_settings_get(self):
        try:
            groq_key = get_setting("GROQ_API_KEY")
            openrouter_key = get_setting("OPENROUTER_API_KEY")
            _json_response(self, HTTPStatus.OK, {
                "success": True,
                "hasGroq": bool(groq_key),
                "hasOpenRouter": bool(openrouter_key),
                "groqKey": mask_key(groq_key),
                "openRouterKey": mask_key(openrouter_key),
                "embeddingModel": OPENROUTER_EMBEDDING_MODEL,
                "groqModel": get_setting("GROQ_MODEL", GROQ_DEFAULT_MODEL),
            })
        except Exception as exc:
            _json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"success": False, "error": str(exc)})

    def _handle_rag_settings_post(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            updates = {}
            if payload.get("groqKey") and "..." not in payload["groqKey"]:
                updates["GROQ_API_KEY"] = payload["groqKey"].strip()
            if payload.get("openRouterKey") and "..." not in payload["openRouterKey"]:
                updates["OPENROUTER_API_KEY"] = payload["openRouterKey"].strip()
            if payload.get("groqModel"):
                updates["GROQ_MODEL"] = payload["groqModel"].strip()
            save_env_values(updates)
            _json_response(self, HTTPStatus.OK, {"success": True})
        except Exception as exc:
            _json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"success": False, "error": str(exc)})

    def _handle_rag_upload(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length)
            _, files = _parse_multipart(self.headers.get("Content-Type", ""), body)
            uploads = files.get("files") or files.get("file") or []
            if not uploads:
                _json_response(self, HTTPStatus.BAD_REQUEST, {"success": False, "error": "No documents uploaded."})
                return
            ensure_dirs()
            saved = []
            for upload in uploads:
                filename = safe_filename(upload["filename"])
                target = UPLOADS_DIR / filename
                target.write_bytes(upload["content"])
                saved.append(filename)
            _json_response(self, HTTPStatus.OK, {"success": True, "saved": saved, **list_documents()})
        except Exception as exc:
            _json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"success": False, "error": str(exc)})

    def _handle_rag_delete(self, filename):
        try:
            delete_document(filename)
            _json_response(self, HTTPStatus.OK, {"success": True, **list_documents()})
        except Exception as exc:
            _json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"success": False, "error": str(exc)})

    def _handle_rag_ingest(self):
        logs = []
        try:
            result = ingest_documents(logs.append)
            _json_response(self, HTTPStatus.OK, {"success": True, "logs": logs, **result, **list_documents()})
        except Exception as exc:
            logs.append(str(exc))
            _json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"success": False, "error": str(exc), "logs": logs})

    def _handle_rag_query(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            query = (payload.get("query") or "").strip()
            if not query:
                _json_response(self, HTTPStatus.BAD_REQUEST, {"success": False, "error": "Question is required."})
                return
            result = ask(query, model=payload.get("model"))
            _json_response(self, HTTPStatus.OK, {"success": True, **result})
        except Exception as exc:
            _json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"success": False, "error": str(exc)})


def main():
    port = int(os.environ.get("SPU_WEB_PORT", "8080"))
    host = "127.0.0.1"

    if not WEB_DIR.is_dir():
        raise SystemExit(f"Web directory not found: {WEB_DIR}")

    ensure_dirs()
    if TEMP_DIR.exists():
        shutil.rmtree(TEMP_DIR, ignore_errors=True)
    TEMP_DIR.mkdir(exist_ok=True)

    httpd = ThreadingHTTPServer((host, port), Handler)
    url = f"http://{host}:{port}"
    print(f"SPU Log Analyzer web UI running at {url}")
    if os.environ.get("SPU_WEB_NO_BROWSER") != "1":
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        httpd.server_close()
        shutil.rmtree(TEMP_DIR, ignore_errors=True)


if __name__ == "__main__":
    main()
