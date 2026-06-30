import React from "react";
import ReactDOM from "react-dom/client";
import AppShell from "./AppShell";
import "./index.css";

// Disable browser autofill / autosuggest / spellcheck on all text inputs,
// including ones added later (modals, dynamic rows).
function hardenInput(el: Element) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.setAttribute("autocomplete", "off");
    el.setAttribute("autocorrect", "off");
    el.setAttribute("autocapitalize", "off");
    el.spellcheck = false;
  }
}
function hardenAll(root: ParentNode) {
  root.querySelectorAll?.("input, textarea").forEach(hardenInput);
}
hardenAll(document);
new MutationObserver((mutations) => {
  for (const m of mutations) {
    m.addedNodes.forEach((node) => {
      if (node instanceof Element) {
        hardenInput(node);
        hardenAll(node);
      }
    });
  }
}).observe(document.documentElement, { childList: true, subtree: true });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
);
