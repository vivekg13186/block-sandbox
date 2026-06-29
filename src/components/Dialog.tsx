import { useEffect, useRef, useState } from "react";

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/** Text-input prompt — a replacement for window.prompt (unsupported in Tauri). */
export function TextPrompt({
  title,
  initial,
  hint,
  confirmLabel = "OK",
  onSubmit,
  onCancel,
}: {
  title: string;
  initial: string;
  hint?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const submit = () => {
    const v = value.trim();
    if (v) onSubmit(v);
  };
  return (
    <Overlay onClose={onCancel}>
      <h3 className="modal-title">{title}</h3>
      {hint && <p className="modal-message">{hint}</p>}
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <div className="modal-actions">
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" onClick={submit}>
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}

/** Confirm dialog — a replacement for window.confirm. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  danger = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Overlay onClose={onCancel}>
      <h3 className="modal-title">{title}</h3>
      <p className="modal-message">{message}</p>
      <div className="modal-actions">
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className={`btn ${danger ? "danger-btn" : "primary"}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}
