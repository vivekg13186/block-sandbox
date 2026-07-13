import React from "react";
import ReactDOM from "react-dom/client";
import AppShell from "./AppShell";
import "./index.css";

// Disable browser autofill / autosuggest / spellcheck on text inputs. A single
// `focusin` listener hardens each field the first time it's focused — this is
// O(1) per focus, unlike a document-wide MutationObserver which fires on every
// DOM change (Blockly/CodeMirror churn the DOM constantly and would make it a
// growing CPU cost).
document.addEventListener(
  "focusin",
  (e) => {
    const el = e.target;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.setAttribute("autocomplete", "off");
      el.setAttribute("autocorrect", "off");
      el.setAttribute("autocapitalize", "off");
      el.spellcheck = false;
    }
  },
  true
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
);
