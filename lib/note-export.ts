/** Offline PDF export uses the same schema and embeds locally stored image bytes. */
import { generateHTML } from "@tiptap/core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { icons } from "lucide-react";
import katex from "katex";
import { noteExtensions, validNoteLink } from "@/lib/note-extensions";
import { noteTitle, parseNoteContent, type Note } from "@/lib/notes";
import db from "@/lib/db";

const printStyle = `
@page { size: A4 portrait; margin: 18mm; }
.note-print { color: #171717; background: #fff; font: 11pt/1.6 Arial, Helvetica, sans-serif; overflow-wrap: anywhere; color-scheme: light; margin: 0; }
.note-print *, .note-print *::before, .note-print *::after { box-sizing: border-box; }
.note-print .note-print-header { margin-bottom: 10mm; }
.note-print .note-print-icon svg { width: 30px; height: 30px; margin-bottom: 4mm; }
.note-print .note-print-date { font-size: 9pt; color: #666; margin-top: 3mm; }
.note-print h1, .note-print h2, .note-print h3 { font-family: Georgia, 'Times New Roman', serif; line-height: 1.25; break-after: avoid; page-break-after: avoid; margin: 7mm 0 3mm; }
.note-print h1 { font-size: 24pt; } .note-print h2 { font-size: 19pt; } .note-print h3 { font-size: 15pt; }
.note-print .note-print-title { margin: 0; font-size: 28pt; }
.note-print p { margin: 2.5mm 0; orphans: 3; widows: 3; }
.note-print ul, .note-print ol { margin: 3mm 0; padding-left: 6mm; }
.note-print blockquote { color: #555; border-left: 1mm solid #ccc; padding-left: 4mm; margin: 4mm 0; }
.note-print hr { border: 0; border-top: 1px solid #ccc; margin: 5mm 0; }
.note-print a { color: #254a78; text-decoration: underline; text-underline-offset: 2px; }
.note-print code { font-family: Consolas, 'Courier New', monospace; font-size: 9pt; background: #f2f2f2; border-radius: 3px; padding: 1px 3px; }
.note-print pre { break-inside: avoid; page-break-inside: avoid; white-space: pre-wrap; overflow-wrap: anywhere; background: #f2f2f2; border-radius: 6px; padding: 4mm; line-height: 1.5; tab-size: 2; }
.note-print pre code { background: none; padding: 0; white-space: inherit; }
.note-print mark { background: #fff0a6; color: inherit; }
.note-print .hljs-comment, .note-print .hljs-quote { color: #687078; }
.note-print .hljs-keyword, .note-print .hljs-literal { color: #6b3384; }
.note-print .hljs-string, .note-print .hljs-addition { color: #246c39; }
.note-print .hljs-number, .note-print .hljs-symbol { color: #875311; }
.note-print .hljs-title, .note-print .hljs-section { color: #235e91; }
.note-print .hljs-attr, .note-print .hljs-type, .note-print .hljs-built_in { color: #785127; }
.note-print .hljs-deletion { color: #a32929; }
.note-print table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 4mm 0; font-size: 10pt; }
.note-print th, .note-print td { border: 1px solid #bbb; padding: 2mm; vertical-align: top; overflow-wrap: anywhere; }
.note-print th { background: #f0f0f0; font-weight: 600; text-align: left; }
.note-print tr { break-inside: avoid; page-break-inside: avoid; }
.note-print thead { display: table-header-group; }
.note-print img { display: block; max-width: 100%; max-height: 245mm; height: auto; object-fit: contain; border-radius: 5px; break-inside: avoid; page-break-inside: avoid; margin: 4mm 0; }
.note-print img[data-align="center"] { margin-left: auto; margin-right: auto; }
.note-print img[data-align="right"] { margin-left: auto; }
.note-print [data-type="columns"] { display: grid; grid-template-columns: repeat(var(--note-columns, 2), minmax(0, 1fr)); gap: 6mm; margin: 4mm 0; }
.note-print [data-type="column"] { min-width: 0; }
.note-print [data-type="column"] > :first-child { margin-top: 0; }
.note-print [data-type="callout"] { position: relative; background: #f3f3f3; border-radius: 6px; padding: 3mm 4mm 3mm 10mm; margin: 4mm 0; break-inside: avoid; page-break-inside: avoid; }
.note-print [data-type="callout"]::before { content: 'ⓘ'; position: absolute; left: 4mm; top: 4mm; }
.note-print [data-type="callout"][data-variant="tip"] { background: #eff5ee; }
.note-print [data-type="callout"][data-variant="warning"] { background: #faf5e8; }
.note-print [data-type="callout"][data-variant="danger"] { background: #f9eded; }
.note-print [data-type="callout"] > :first-child { margin-top: 0; }
.note-print [data-type="callout"] > :last-child { margin-bottom: 0; }
.note-print [data-type="toggle"] { padding-left: 5mm; margin: 4mm 0; }
.note-print [data-type="toggle-summary"] { font-weight: 600; break-after: avoid; }
.note-print [data-type="toggle-summary"]::before { content: '▾ '; }
.note-print [data-type="toggle"] > * { display: block !important; }
.note-print ul[data-type="taskList"] { list-style: none; padding-left: 0; }
.note-print li[data-type="taskItem"] { display: flex; align-items: flex-start; gap: 2mm; }
.note-print li[data-type="taskItem"] > label { display: none; }
.note-print li[data-type="taskItem"]::before { content: '☐'; font-family: 'Segoe UI Symbol', sans-serif; flex: 0 0 auto; padding-top: 2.5mm; }
.note-print li[data-type="taskItem"][data-checked="true"]::before { content: '☑'; }
.note-print li[data-type="taskItem"] > div { flex: 1; min-width: 0; }
.note-print [data-type="math-block"] { margin: 4mm 0; text-align: center; break-inside: avoid; font-size: 12pt; }
.note-print .note-print-math-inline-source { font-family: ui-monospace, Consolas, monospace; font-size: .9em; background: #f3f3f3; padding: 0 1mm; border-radius: 3px; }
.note-print .note-print-math-source { font-family: ui-monospace, Consolas, monospace; font-size: 9pt; text-align: left; white-space: pre-wrap; background: #f3f3f3; padding: 3mm; border-radius: 5px; }
.note-print .note-print-missing { background: #f3f3f3; color: #666; padding: 4mm; border-radius: 5px; font-size: 9pt; break-inside: avoid; }
`;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Legacy HTML is inert in the iframe, including pasted script/event attributes. */
function cleanDocument(document: Document) {
  document.querySelectorAll("script,style,iframe,object,embed,link,meta,base,form,input:not([type=checkbox]),button,video,audio,source").forEach((element) => element.remove());
  document.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name) || ["srcdoc", "srcset", "formaction"].includes(attribute.name)) element.removeAttribute(attribute.name);
      if (attribute.name === "style" && /url\s*\(|expression\s*\(|@import/i.test(attribute.value)) element.removeAttribute("style");
    }
    if (element.tagName === "A" && !validNoteLink(element.getAttribute("href") || "")) element.removeAttribute("href");
    if (element.tagName === "IMG" && !/^(https:\/\/|data:image\/(png|jpe?g|webp|gif|svg\+xml);)/i.test(element.getAttribute("src") || "")) element.removeAttribute("src");
  });
}

export async function exportNoteToPdf(note: Note): Promise<void> {
  if (typeof window === "undefined" || typeof window.print !== "function") throw new Error("PDF export requires a browser with printing support.");
  const content = parseNoteContent(note.content);
  const html = typeof content === "string" ? content : generateHTML(content, noteExtensions({ editable: false, headless: true }));
  const parsed = new DOMParser().parseFromString(html, "text/html");
  cleanDocument(parsed);
  await Promise.all(Array.from(parsed.querySelectorAll<HTMLImageElement>("img[data-asset]")).map(async (image) => {
    const asset = await db.noteAssets.where("uid").equals(image.dataset.asset || "").first();
    if (asset) image.src = asset.dataUrl;
    else {
      const missing = parsed.createElement("div"); missing.className = "note-print-missing";
      missing.textContent = `Image not on this device yet${image.alt ? `: ${image.alt}` : ""}`; image.replaceWith(missing);
    }
  }));
  // Printing must never fetch remote resources. Only locally embedded bytes travel.
  parsed.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    if (/^data:image\//i.test(image.getAttribute("src") || "")) return;
    const missing = parsed.createElement("div"); missing.className = "note-print-missing";
    missing.textContent = `Image unavailable offline${image.alt ? `: ${image.alt}` : ""}`;
    image.replaceWith(missing);
  });
  // Equations print as MathML: browsers lay it out natively, so the print
  // document needs no KaTeX fonts or stylesheet and stays fully offline.
  const equations = Array.from(parsed.querySelectorAll<HTMLElement>('[data-type="math-block"]'));
  if (equations.length) {
    for (const equation of equations) {
      const latex = equation.getAttribute("data-latex") || equation.textContent || "";
      try { equation.innerHTML = katex.renderToString(latex, { displayMode: true, output: "mathml", throwOnError: true, strict: "ignore" }); }
      catch { equation.textContent = latex; equation.classList.add("note-print-math-source"); }
    }
  }
  const inlineEquations = Array.from(parsed.querySelectorAll<HTMLElement>('[data-type="math-inline"]'));
  if (inlineEquations.length) {
    const { default: katex } = await import("katex");
    for (const equation of inlineEquations) {
      const latex = equation.getAttribute("data-latex") || equation.textContent || "";
      try { equation.innerHTML = katex.renderToString(latex, { displayMode: false, output: "mathml", throwOnError: true, strict: "ignore" }); }
      catch { equation.textContent = latex; equation.classList.add("note-print-math-inline-source"); }
    }
  }
  // Persisted column count lives in the schema; legacy HTML can infer it too.
  parsed.querySelectorAll<HTMLElement>('[data-type="columns"]').forEach((columns) => columns.style.setProperty("--note-columns", String(columns.children.length)));
  parsed.querySelectorAll<HTMLElement>("table, col, th, td").forEach((element) => {
    element.style.removeProperty("width"); element.style.removeProperty("min-width");
  });
  const Icon = icons[(note.icon || "FileText") as keyof typeof icons] || icons.FileText;
  const iconHtml = renderToStaticMarkup(createElement(Icon, { size: 30, strokeWidth: 1.6, "aria-hidden": true }));
  const title = noteTitle(note);
  const edited = new Date(note.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const frame = document.createElement("iframe");
  frame.title = title; frame.setAttribute("aria-hidden", "true"); frame.tabIndex = -1;
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "794px", height: "1123px", border: "0" });
  document.body.appendChild(frame);
  const printWindow = frame.contentWindow, printDocument = frame.contentDocument;
  if (!printWindow || !printDocument || typeof printWindow.print !== "function") { frame.remove(); throw new Error("Printing is unavailable in this browser."); }
  try {
    printDocument.open();
    printDocument.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>${escapeHtml(title)}</title><style>${printStyle}</style></head><body class="note-print"><header class="note-print-header"><div class="note-print-icon">${iconHtml}</div><h1 class="note-print-title">${escapeHtml(title)}</h1><div class="note-print-date">Last edited ${escapeHtml(edited)}</div></header><main>${parsed.body.innerHTML}</main></body></html>`);
    printDocument.close();
    await Promise.all(Array.from(printDocument.images).map((image) => new Promise<void>((resolve) => {
      if (image.complete) { resolve(); return; }
      const timeout = setTimeout(done, 5000);
      function done() { clearTimeout(timeout); image.removeEventListener("load", done); image.removeEventListener("error", done); resolve(); }
      image.addEventListener("load", done, { once: true }); image.addEventListener("error", done, { once: true });
    })));
    // Failed external images are readable in an offline export as well.
    Array.from(printDocument.images).forEach((image) => {
      if (image.complete && image.naturalWidth > 0) return;
      const missing = printDocument.createElement("div"); missing.className = "note-print-missing";
      missing.textContent = `Image unavailable${image.alt ? `: ${image.alt}` : ""}`; image.replaceWith(missing);
    });
    // Off-screen iframe animation frames can be suspended by the browser.
    // Force layout, then yield a task so the print tree is ready even in a hidden tab.
    void printDocument.body.offsetHeight;
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    const cleanup = () => { clearTimeout(fallback); printWindow.removeEventListener("afterprint", cleanup); frame.remove(); };
    printWindow.addEventListener("afterprint", cleanup, { once: true });
    const fallback = setTimeout(cleanup, 120_000);
    printWindow.focus(); printWindow.print();
  } catch (error) {
    frame.remove(); throw new Error(`Could not open PDF printing: ${error instanceof Error ? error.message : "unknown browser error"}`);
  }
}
