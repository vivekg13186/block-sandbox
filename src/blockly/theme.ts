import * as Blockly from "blockly";

// Dark theme matching the app palette (see index.css :root variables).
export const blockSandboxDark = Blockly.Theme.defineTheme("blocksandbox-dark", {
  name: "blocksandbox-dark",
  base: Blockly.Themes.Zelos,
  componentStyles: {
    workspaceBackgroundColour: "#0f1218",
    toolboxBackgroundColour: "#171b24",
    toolboxForegroundColour: "#e6e9ef",
    flyoutBackgroundColour: "#1f2533",
    flyoutForegroundColour: "#8b94a7",
    flyoutOpacity: 1,
    scrollbarColour: "#2a2f3a",
    scrollbarOpacity: 0.7,
    insertionMarkerColour: "#e6e9ef",
    insertionMarkerOpacity: 0.35,
    markerColour: "#4f8cff",
    cursorColour: "#4f8cff",
    selectedGlowColour: "#4f8cff",
    selectedGlowOpacity: 0.4,
  },
  fontStyle: {
    family:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    weight: "normal",
    size: 12,
  },
});
