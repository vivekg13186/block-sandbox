# Packaging Block Sandbox

## Build an installer

```bash
npm install
npm run tauri build
```

This produces a native installer/app under `src-tauri/target/release/bundle/`
for the current platform (`.dmg`/`.app` on macOS, `.msi`/`.exe` on Windows,
`.deb`/`.AppImage` on Linux). Cross-platform builds require building on (or in
CI for) each target OS.

## Python at runtime

The Run tab executes generated Python through the Rust `run_python` command,
which picks an interpreter in this order:

1. A **bundled** interpreter at `src-tauri/resources/python/` (if present).
2. The **system** `python3` / `python` on `PATH`.

Out of the box the app uses system Python — fine for development and for users
who already have Python 3 installed.

## Bundling a self-contained Python (no system install needed)

To ship an app that doesn't depend on the user having Python:

1. Download a standalone build from
   [python-build-standalone](https://github.com/astral-sh/python-build-standalone/releases)
   for each target platform (pick the `install_only` archives).
2. Unpack it into `src-tauri/resources/python/` so the interpreter lands at:
   - macOS / Linux: `src-tauri/resources/python/bin/python3`
   - Windows: `src-tauri/resources/python/python.exe`
3. `npm run tauri build`.

`resources/python/**/*` is already listed under `bundle.resources` in
`src-tauri/tauri.conf.json`, so whatever you place there is copied into the app
bundle and resolved at runtime via the app's resource directory. No code change
is needed — `run_python` detects the bundled interpreter automatically.

> Tip: keep the standalone Python out of git (it's large). Add
> `src-tauri/resources/python/bin/` and `src-tauri/resources/python/lib/` to
> `.gitignore`, or fetch it in CI before the build step.

## Notes

- Trusted-use only: generated code runs with the user's privileges. Don't run
  untrusted modules.
- Phase 7 leaves the standalone-Python download as a manual/CI step because the
  binaries are platform-specific and large; the app and fallback work today.
