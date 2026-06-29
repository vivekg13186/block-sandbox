# Bundled Python (optional)

If you drop a self-contained Python interpreter here, the app will use it
instead of the system Python, so end users don't need Python installed.

Expected layout:

- macOS / Linux: `python/bin/python3`
- Windows:       `python/python.exe`

Get a standalone build from python-build-standalone:
https://github.com/astral-sh/python-build-standalone/releases

Unpack it so that the interpreter lands at the path above, then run
`npm run tauri build`. See `../../PACKAGING.md` for details.

This README is a placeholder so the resources folder exists; it is harmless to
ship. The Rust `run_python` command checks for the interpreter path above and
silently falls back to system Python when it is absent.
