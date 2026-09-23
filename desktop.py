"""Start the local viewer on a free port and open it in the default browser."""

from __future__ import annotations

import threading
import webbrowser

from werkzeug.serving import make_server

from app import app


def main() -> None:
    server = make_server("127.0.0.1", 0, app)
    address = f"http://127.0.0.1:{server.server_port}/"
    print(f"DWD Raster Explorer läuft unter {address}", flush=True)
    print("Dieses Fenster geöffnet lassen. Mit Strg+C beenden.", flush=True)
    threading.Timer(0.4, lambda: webbrowser.open(address, new=2)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
