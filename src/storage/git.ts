// Git operations over the server's data dir (if it's a git repo).

import { apiGet, apiSend } from "../api";

export interface GitChange {
  status: string;
  path: string;
}
export interface GitStatus {
  repo: boolean;
  root?: string;
  branch?: string;
  changes?: GitChange[];
}

export async function gitStatus(): Promise<GitStatus> {
  try {
    return await apiGet<GitStatus>("/git/status");
  } catch {
    return { repo: false };
  }
}

export async function gitDiff(path?: string): Promise<string> {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  const res = await apiGet<{ diff: string }>(`/git/diff${q}`);
  return res.diff;
}

export async function gitCommit(message: string): Promise<{ ok: boolean; output: string }> {
  return apiSend("POST", "/git/commit", { message });
}

export async function gitPush(): Promise<{ ok: boolean; output: string }> {
  return apiSend("POST", "/git/push", {});
}

export async function gitPull(): Promise<{ ok: boolean; output: string }> {
  return apiSend("POST", "/git/pull", {});
}
