"""Launch the Block Sandbox web server.

    python run.py                 # http://127.0.0.1:8000
    python run.py --port 9000
    python run.py --host 0.0.0.0  # expose on the network (trusted use only!)
"""

import argparse

import uvicorn


def main() -> None:
    ap = argparse.ArgumentParser(description="Block Sandbox server")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()
    uvicorn.run("app:app", host=args.host, port=args.port, reload=False)


if __name__ == "__main__":
    main()
