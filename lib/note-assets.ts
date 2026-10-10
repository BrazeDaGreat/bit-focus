/** Browser image compression keeps synced note assets below the row size cap. */
import { toast } from "sonner";
import db from "./db";
import { NOTE_ASSET_MAX_BYTES, type NoteAsset } from "./notes";

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(blob);
  });
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close(): void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch { /* Some browsers require an HTML image to decode SVG or GIF. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not decode the image"));
      img.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

export async function compressImage(file: Blob): Promise<{ dataUrl: string; type: string; width: number; height: number; size: number }> {
  if (!file.type.startsWith("image/")) throw new Error("Only image files can be added to a page");
  const image = await decode(file);
  try {
    if (!image.width || !image.height) throw new Error("This image has no readable dimensions");
    if (file.type === "image/gif" && file.size <= NOTE_ASSET_MAX_BYTES && Math.max(image.width, image.height) <= 2400)
      return { dataUrl: await dataUrl(file), type: file.type, width: image.width, height: image.height, size: file.size };
    const scale = Math.min(1, 2400 / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!context) throw new Error("Image compression is unavailable in this browser");
    context.drawImage(image.source, 0, 0, width, height);
    const encode = (type: string, quality: number): Promise<Blob> => {
      if (canvas instanceof HTMLCanvasElement) {
        return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode the image")), type, quality));
      }
      return canvas.convertToBlob({ type, quality });
    };
    for (const type of ["image/webp", "image/jpeg"]) {
      for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
        let encoded: Blob;
        try { encoded = await encode(type, quality); }
        catch { break; }
        // Unsupported encoders may silently return PNG; try the next format.
        if (encoded.type !== type) break;
        if (encoded.size <= NOTE_ASSET_MAX_BYTES)
          return { dataUrl: await dataUrl(encoded), type: encoded.type, width, height, size: encoded.size };
      }
    }
    throw new Error("This image is too large after compression. Try a smaller image");
  } finally { image.close(); }
}

export async function addNoteAssets(noteUid: string, files: File[]): Promise<NoteAsset[]> {
  const rows: NoteAsset[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) { toast.error(`${file.name}: only image files can be added to a page`); continue; }
    try {
      const compressed = await compressImage(file);
      const now = new Date();
      const row: NoteAsset = { ...compressed, uid: crypto.randomUUID(), noteUid, name: file.name, createdAt: now, updatedAt: now };
      row.id = await db.noteAssets.add(row);
      rows.push(row);
    } catch (error) { toast.error(`${file.name}: ${error instanceof Error ? error.message : "Could not add this image"}`); }
  }
  return rows;
}

export function getNoteAsset(uid: string): Promise<NoteAsset | undefined> {
  return db.noteAssets.where("uid").equals(uid).first();
}

export async function deleteAssetsForNotes(noteUids: string[]): Promise<void> {
  if (noteUids.length) await db.noteAssets.where("noteUid").anyOf(noteUids).delete();
}
