import { useEffect, useState } from "react";
import { X, GitBranch, RefreshCw, Loader2, Check, Upload, Download } from "lucide-react";
import {
  gitStatus,
  gitDiff,
  gitCommit,
  gitPush,
  gitPull,
  type GitStatus,
  type GitChange,
} from "../storage/git";

interface Props {
  onClose: () => void;
  onCommitted?: () => void;
}

const label = (code: string) => {
  if (code.includes("A") || code === "??") return "added";
  if (code.includes("D")) return "deleted";
  if (code.includes("M")) return "modified";
  if (code.includes("R")) return "renamed";
  return code || "changed";
};

export default function GitPanel({ onClose, onCommitted }: Props) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    const s = await gitStatus();
    setStatus(s);
    if (s.repo) {
      const d = await gitDiff(selected ?? undefined);
      setDiff(d);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const openFile = async (c: GitChange) => {
    setSelected(c.path);
    setDiff(await gitDiff(c.path));
  };

  const commit = async () => {
    setBusy(true);
    try {
      const res = await gitCommit(message);
      if (res.ok) {
        setCommitted(true);
        setMessage("");
        setSelected(null);
        await refresh();
        onCommitted?.();
        setTimeout(() => setCommitted(false), 1500);
      } else {
        setDiff(res.output || "Nothing to commit.");
      }
    } finally {
      setBusy(false);
    }
  };

  const push = async () => {
    setPushing(true);
    setNotice("");
    try {
      const res = await gitPush();
      setNotice(res.ok ? "Pushed to remote." : res.output || "Push failed.");
    } finally {
      setPushing(false);
    }
  };

  const pull = async () => {
    setPulling(true);
    setNotice("");
    try {
      const res = await gitPull();
      setNotice(res.ok ? res.output || "Up to date." : res.output || "Pull failed.");
      if (res.ok) {
        await refresh();
        onCommitted?.(); // reload modules in case files changed
      }
    } finally {
      setPulling(false);
    }
  };

  const changes = status?.changes ?? [];

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal git-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="env-modal-head">
          <h3 className="modal-title">
            <GitBranch size={16} /> Version control
            {status?.repo && <span className="muted git-branch">{status.branch}</span>}
          </h3>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="icon-btn" title="Refresh" onClick={refresh}>
              <RefreshCw size={15} />
            </button>
            <button className="icon-btn" title="Close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {status && !status.repo ? (
          <p className="muted">
            The data folder isn't a git repository. Run <code>git init</code> in the server's
            data directory to enable commits and diffs of your flows.
          </p>
        ) : (
          <div className="git-body">
            <aside className="git-changes">
              <div
                className={`git-change ${selected === null ? "active" : ""}`}
                onClick={() => {
                  setSelected(null);
                  refresh();
                }}
              >
                All changes ({changes.length})
              </div>
              {changes.length === 0 && <p className="muted">Working tree clean.</p>}
              {changes.map((c) => (
                <div
                  key={c.path}
                  className={`git-change ${selected === c.path ? "active" : ""}`}
                  onClick={() => openFile(c)}
                  title={c.path}
                >
                  <span className={`git-badge ${label(c.status)}`}>{label(c.status)}</span>
                  <span className="git-path">{c.path}</span>
                </div>
              ))}
            </aside>

            <section className="git-diff">
              {diff ? (
                <pre className="diff-view">
                  {diff.split("\n").map((line, i) => (
                    <div key={i} className={diffClass(line)}>
                      {line || " "}
                    </div>
                  ))}
                </pre>
              ) : (
                <p className="muted">No changes to show.</p>
              )}
            </section>
          </div>
        )}

        {status?.repo && (
          <>
            {notice && <div className="git-notice muted">{notice}</div>}
            <div className="git-commit">
              <input
                placeholder="Commit message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && changes.length > 0 && commit()}
              />
              <button
                className="btn primary"
                disabled={busy || changes.length === 0}
                onClick={commit}
              >
                {busy ? <Loader2 size={15} className="spin" /> : committed ? <Check size={15} /> : null}
                {committed ? "Committed" : "Commit"}
              </button>
              <button className="btn" disabled={pulling} onClick={pull} title="git pull (fast-forward)">
                {pulling ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Pull
              </button>
              <button className="btn" disabled={pushing} onClick={push} title="git push">
                {pushing ? <Loader2 size={15} className="spin" /> : <Upload size={15} />} Push
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function diffClass(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---")) return "diff-meta";
  if (line.startsWith("@@")) return "diff-hunk";
  if (line.startsWith("+")) return "diff-add";
  if (line.startsWith("-")) return "diff-del";
  if (line.startsWith("diff ") || line.startsWith("index ")) return "diff-meta";
  return "";
}
