// Export the current Blockly workspace (just the blocks) as a PNG or SVG image.

import * as Blockly from "blockly";

const PAD = 16;
const BG = "#0f1218"; // app --bg, so dark-themed blocks read well

/** Gather stylesheet rules (including Blockly's adopted stylesheet, which holds
 *  the .blocklyText fill) so exported SVG text/colours render. */
function collectCss(): string {
  let css = "";
  const sheets: CSSStyleSheet[] = [
    ...Array.from(document.styleSheets),
    ...((document as unknown as { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? []),
  ];
  for (const sheet of sheets) {
    try {
      for (const rule of Array.from(sheet.cssRules)) css += rule.cssText + "\n";
    } catch {
      /* cross-origin sheet — skip */
    }
  }
  return css;
}

/** Force a readable fill on every text node, so field labels/values are visible
 *  even if the .blocklyText CSS rule didn't make it into the export. */
function forceTextFill(root: SVGElement): void {
  root.querySelectorAll("text, tspan").forEach((t) => {
    const el = t as SVGElement;
    const cur = el.getAttribute("fill");
    if (!cur || cur === "#000" || cur === "#000000" || cur === "black") {
      el.setAttribute("fill", "#e6e9ef");
    }
  });
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function bounds(ws: Blockly.WorkspaceSvg): Box | null {
  if (ws.getTopBlocks(false).length === 0) return null;
  const bbox = ws.getBlocksBoundingBox();
  return {
    x: bbox.left - PAD,
    y: bbox.top - PAD,
    width: bbox.right - bbox.left + PAD * 2,
    height: bbox.bottom - bbox.top + PAD * 2,
  };
}

function toSvgString(ws: Blockly.WorkspaceSvg, box: Box): string {
  const canvas = ws.getCanvas().cloneNode(true) as SVGElement;
  canvas.removeAttribute("transform");
  forceTextFill(canvas);
  const serialized = new XMLSerializer().serializeToString(canvas);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${box.width}" height="${box.height}" viewBox="${box.x} ${box.y} ${box.width} ${box.height}">` +
    `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${BG}"/>` +
    `<style>${collectCss()}</style>${serialized}</svg>`
  );
}

function download(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const safeName = (name: string) => (name || "blocks").replace(/[^\w.-]+/g, "_");

/** Download the workspace blocks as a vector SVG. Returns false if empty. */
export function saveWorkspaceSvg(ws: Blockly.WorkspaceSvg, name: string): boolean {
  const box = bounds(ws);
  if (!box) return false;
  const svg = toSvgString(ws, box);
  download("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg), `${safeName(name)}.svg`);
  return true;
}

/** Rasterize the workspace blocks to a PNG (scaled up for crispness). */
export function saveWorkspacePng(ws: Blockly.WorkspaceSvg, name: string, scale = 2): Promise<boolean> {
  const box = bounds(ws);
  if (!box) return Promise.resolve(false);
  const svg = toSvgString(ws, box);
  const src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(box.width * scale));
      canvas.height = Math.max(1, Math.round(box.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      download(canvas.toDataURL("image/png"), `${safeName(name)}.png`);
      resolve(true);
    };
    img.onerror = () => reject(new Error("Failed to render blocks image"));
    img.src = src;
  });
}
