// Run Python and install packages via the server API.

import { apiSend } from "../api";

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export function canRun(): boolean {
  return true;
}

export async function runPython(code: string, stdin: string): Promise<RunResult> {
  return apiSend<RunResult>("POST", "/run", { code, stdin });
}

/** Install pip packages into the server's managed venv (cached server-side). */
export async function ensurePackages(packages: string[]): Promise<RunResult> {
  return apiSend<RunResult>("POST", "/ensure-packages", { packages });
}
