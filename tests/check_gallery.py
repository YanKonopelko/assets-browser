"""Run the gallery smoke check in an isolated Chromium browser."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from queue import Empty, Queue
import shutil
import subprocess
import tempfile
from threading import Thread


TESTS = Path(__file__).resolve().parent
DOCS = TESTS.parent / "docs"


def find_browser():
    for name in ("msedge", "chrome", "google-chrome", "chromium"):
        executable = shutil.which(name)
        if executable:
            return Path(executable)

    for variable in ("ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"):
        directory = os.getenv(variable)
        if not directory:
            continue
        for relative in ("Microsoft/Edge/Application/msedge.exe", "Google/Chrome/Application/chrome.exe"):
            executable = Path(directory) / relative
            if executable.is_file():
                return executable
    return None


class GalleryHandler(SimpleHTTPRequestHandler):
    results = Queue()

    def do_GET(self):
        if self.path not in ("/", "/index.html"):
            return super().do_GET()

        page = (DOCS / "index.html").read_text(encoding="utf-8")
        check = (TESTS / "gallery-smoke.js").read_text(encoding="utf-8")
        body = page.replace("</body>", f"<script>\n{check}\n</script>\n</body>").encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/gallery-check":
            return self.send_error(404)
        length = int(self.headers["Content-Length"])
        self.results.put(self.rfile.read(length).decode("utf-8"))
        self.send_response(204)
        self.end_headers()

    def log_message(self, *_args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", type=Path, help="Path to Edge, Chrome, or Chromium")
    args = parser.parse_args()
    browser = args.browser or find_browser()
    if browser is None or not browser.is_file():
        parser.error("Browser not found. Pass its executable with --browser.")

    handler = partial(GalleryHandler, directory=DOCS)
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            for size in ("1100,950", "390,844"):
                with tempfile.TemporaryDirectory(prefix="assets-gallery-check-", ignore_cleanup_errors=True) as profile:
                    with subprocess.Popen(
                        [
                            str(browser.resolve()), "--headless", "--no-first-run",
                            "--remote-debugging-port=0",
                            "--disable-extensions", "--disable-background-networking",
                            f"--user-data-dir={profile}", f"--window-size={size}",
                            f"http://127.0.0.1:{server.server_port}/",
                        ],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    ) as browser_process:
                        try:
                            result = GalleryHandler.results.get(timeout=30)
                        except Empty:
                            raise SystemExit(f"{size}: No browser result") from None
                        finally:
                            browser_process.terminate()
                if result != "passed":
                    raise SystemExit(f"{size}: {result}")
                print(f"{size}: gallery check passed")
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()
