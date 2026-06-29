// Frontend wrapper around the Rust `run_python` command.

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function canRun(): boolean {
  return inTauri();
}

export async function runPython(code: string, stdin: string): Promise<RunResult> {
  if (!inTauri()) {
    throw new Error("Running Python requires the desktop app (npm run tauri dev).");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<RunResult>("run_python", { code, stdin });
}

/** Install pip packages into the managed venv (cached after first install). */
export async function ensurePackages(packages: string[]): Promise<RunResult> {
  if (!inTauri()) {
    throw new Error("Installing packages requires the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<RunResult>("ensure_packages", { packages });
}
