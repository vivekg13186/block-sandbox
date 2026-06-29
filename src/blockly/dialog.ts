// Blockly calls window.prompt/alert/confirm for things like "Create variable".
// Those are no-ops in the Tauri webview, so we replace them with small in-app
// modal dialogs styled with the app's modal CSS classes.

import * as Blockly from "blockly";

let installed = false;

function makeOverlay(): { overlay: HTMLDivElement; modal: HTMLDivElement } {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.zIndex = "10000";
  const modal = document.createElement("div");
  modal.className = "modal";
  overlay.appendChild(modal);
  return { overlay, modal };
}

function button(label: string, className: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = className;
  b.textContent = label;
  return b;
}

function showPrompt(
  message: string,
  defaultValue: string,
  callback: (result: string | null) => void
) {
  const { overlay, modal } = makeOverlay();
  const title = document.createElement("h3");
  title.className = "modal-title";
  title.textContent = message || "Enter a value";
  const input = document.createElement("input");
  input.value = defaultValue || "";
  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const cancel = button("Cancel", "btn");
  const ok = button("OK", "btn primary");
  actions.append(cancel, ok);
  modal.append(title, input, actions);

  const close = (val: string | null) => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    callback(val);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close(null);
  };
  ok.onclick = () => close(input.value);
  cancel.onclick = () => close(null);
  overlay.onmousedown = (e) => {
    if (e.target === overlay) close(null);
  };
  input.onkeydown = (e) => {
    if (e.key === "Enter") close(input.value);
  };
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
  input.focus();
  input.select();
}

function showConfirm(message: string, callback: (ok: boolean) => void) {
  const { overlay, modal } = makeOverlay();
  const text = document.createElement("p");
  text.className = "modal-message";
  text.textContent = message;
  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const cancel = button("Cancel", "btn");
  const ok = button("OK", "btn primary");
  actions.append(cancel, ok);
  modal.append(text, actions);

  const close = (val: boolean) => {
    overlay.remove();
    callback(val);
  };
  ok.onclick = () => close(true);
  cancel.onclick = () => close(false);
  overlay.onmousedown = (e) => {
    if (e.target === overlay) close(false);
  };
  document.body.appendChild(overlay);
}

function showAlert(message: string, callback?: () => void) {
  const { overlay, modal } = makeOverlay();
  const text = document.createElement("p");
  text.className = "modal-message";
  text.textContent = message;
  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const ok = button("OK", "btn primary");
  actions.append(ok);
  modal.append(text, actions);

  const close = () => {
    overlay.remove();
    callback?.();
  };
  ok.onclick = close;
  overlay.onmousedown = (e) => {
    if (e.target === overlay) close();
  };
  document.body.appendChild(overlay);
}

/** Install the in-app replacements for Blockly's prompt/alert/confirm. */
export function installBlocklyDialogs(): void {
  if (installed) return;
  installed = true;
  Blockly.dialog.setPrompt(showPrompt);
  Blockly.dialog.setConfirm(showConfirm);
  Blockly.dialog.setAlert(showAlert);
}
