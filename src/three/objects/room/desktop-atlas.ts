import { resources } from "../../../utils/resources";
import { cvHeader, cvSections } from "../../../content/cv";

/**
 * ─── THE SECOND MONITOR SHOWS THE CV ──────────────────────────────────────
 *
 * Both desks sample one atlas, `assets/textures/desktops.webp`: the hero room's
 * two panels through `desktops.ts`, the Experience monitors through
 * `workstation/screens.ts`. So the CV is painted into that atlas ONCE, here,
 * over the chat app that used to fill the right half, and both desks pick it up
 * from the same canvas. Same computer, same screens, one edit.
 *
 * ── THE LAYOUT OF THE RIGHT HALF ──────────────────────────────────────────
 *
 * Read off the file and off `shaders/desktops/fragment.glsl`: the region the
 * monitor shows is the TOP half of the right half (x 512..1024, y 0..512). The
 * BOTTOM half is the message bubble the hero room flashes over it when he turns
 * to that screen (`vUv.y + 0.5`, keyed on its alpha). Only the top half is
 * repainted, so the bubble keeps its alpha and still pops up over the document,
 * which is what a notification does.
 *
 * ── IT IS THE CV, NOT A PICTURE OF ONE ────────────────────────────────────
 *
 * The page is typeset from `content/cv.ts`, the same source the envelope's
 * panel reads. At monitor size it reads as a document with his name on it and
 * a few headed sections, which is the point; the readable copy is the panel.
 */
const SIZE = 1024;
const HALF = 512;

/** The viewer chrome, then the page inside it. */
const CHROME = "#2b2d31";
const CHROME_BAR = "#1e1f22";
const PAGE = { x: HALF + 112, y: 44, w: 288, h: 468 };

let canvas: HTMLCanvasElement | null = null;
let drawn = false;

const wrap = (ctx: CanvasRenderingContext2D, text: string, width: number): string[] => {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const drawPage = (ctx: CanvasRenderingContext2D) => {
  const font = "Urbanist, system-ui, sans-serif";

  // viewer
  ctx.fillStyle = CHROME;
  ctx.fillRect(HALF, 0, HALF, HALF);
  ctx.fillStyle = CHROME_BAR;
  ctx.fillRect(HALF, 0, HALF, 28);
  ctx.fillStyle = "#b5bac1";
  ctx.font = `500 12px ${font}`;
  ctx.textBaseline = "middle";
  ctx.fillText("Bhavye-Thakkar-CV.pdf", HALF + 14, 14);

  // page, with a soft drop so it sits in the viewer rather than on it
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(PAGE.x + 3, PAGE.y + 4, PAGE.w, PAGE.h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(PAGE.x, PAGE.y, PAGE.w, PAGE.h);

  const left = PAGE.x + 22;
  const width = PAGE.w - 44;
  const bottom = PAGE.y + PAGE.h - 14;
  let y = PAGE.y + 30;
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#1d2b3a";
  ctx.font = `700 17px ${font}`;
  ctx.fillText(cvHeader.name, left, y);
  y += 15;
  ctx.fillStyle = "#5b6b7a";
  ctx.font = `500 9px ${font}`;
  ctx.fillText(cvHeader.role, left, y);
  y += 11;
  ctx.fillStyle = "#7d8b99";
  ctx.font = `400 7px ${font}`;
  ctx.fillText(`${cvHeader.email}   ${cvHeader.address}`, left, y);
  y += 8;
  ctx.fillStyle = "#34bfff";
  ctx.fillRect(left, y, width, 1.5);
  y += 14;

  for (const section of cvSections) {
    if (y > bottom - 20) break;
    ctx.fillStyle = "#2b3a49";
    ctx.font = `700 8px ${font}`;
    ctx.fillText(section.label.toUpperCase(), left, y);
    y += 9;
    for (const entry of section.entries) {
      if (y > bottom - 10) break;
      ctx.fillStyle = "#1d2b3a";
      ctx.font = `600 7px ${font}`;
      ctx.fillText(entry.title, left, y);
      y += 8;
      if (entry.subtitle) {
        ctx.fillStyle = "#7d8b99";
        ctx.font = `400 6.5px ${font}`;
        ctx.fillText(entry.subtitle, left, y);
        y += 8;
      }
      ctx.fillStyle = "#3c4652";
      ctx.font = `400 6px ${font}`;
      for (const bullet of entry.bullets ?? []) {
        for (const line of wrap(ctx, bullet, width - 8)) {
          if (y > bottom) break;
          ctx.fillText(`• ${line}`, left + 2, y);
          y += 7;
        }
      }
      y += 4;
    }
    y += 6;
  }
};

/**
 * The composited atlas, or null until the room's texture has decoded. Drawn
 * once; the result is shared, so nothing here should be disposed by a caller.
 */
export const getDesktopAtlas = (): HTMLCanvasElement | null => {
  const image = resources.items["desktops-texture"]?.image as CanvasImageSource | undefined;
  if (!image || !("width" in image) || !image.width) return null;
  if (drawn && canvas) return canvas;

  canvas ??= document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0, SIZE, SIZE);
  drawPage(ctx);
  drawn = true;
  return canvas;
};
