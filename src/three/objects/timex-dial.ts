/**
 * ─── THE TIMEX DIAL ───────────────────────────────────────────────────────
 *
 * The face of the watch he wears in Experience (`avatar/watch.ts`), drawn once
 * onto a canvas. It lives on its own rather than inside the watch builder so
 * the avatar module stays geometry and skinning, and so the drawing can be
 * shared again if the watch ever appears somewhere else. (It did: a copy lay on
 * the hero desk until 2026-09-09, when the owner had it removed.)
 *
 * ── THE DIAL IS DARK, AND THAT IS A LEGIBILITY DECISION ───────────────────
 *
 * It was cream with dark hands first, which is a perfectly good watch and was
 * invisible against a pale sleeve and a white desk: three whites in a row. Dark
 * face, light markers: one dark disc is a watch from any distance, which is the
 * only job the dial has at prop size.
 *
 * Drawn at 256² and seen at maybe forty pixels across. Everything on it is
 * sized for that: a minute track that reads as texture rather than as sixty
 * marks, four long indices that give the eye the cross a watch face is
 * recognised by, and hands at ten past ten, which is where every watch in
 * every photograph ever taken has its hands, because it frames the name and
 * leaves the face open.
 *
 * The avatar samples this raw in its own shader (the same convention as the
 * head texture), so the caller makes its own `CanvasTexture` from the canvas
 * and sets the colour space it needs.
 */
const DIAL_BASE = "#20242c";
const DIAL_MARK = "#e8edf5";

let canvas: HTMLCanvasElement | null = null;

const draw = (ctx: CanvasRenderingContext2D, size: number) => {
  const c = size / 2;
  ctx.fillStyle = DIAL_BASE;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();

  // A hair of warmth toward the rim, so the face is not one flat disc.
  const wash = ctx.createRadialGradient(c, c * 0.82, c * 0.1, c, c, c);
  wash.addColorStop(0, "rgba(120,130,146,0.42)");
  wash.addColorStop(1, "rgba(8,10,14,0.55)");
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(c, c);

  // minute track
  ctx.strokeStyle = "rgba(226,232,240,0.45)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const a = (i / 60) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * (c - 12), -Math.cos(a) * (c - 12));
    ctx.lineTo(Math.sin(a) * (c - 20), -Math.cos(a) * (c - 20));
    ctx.stroke();
  }

  // hour indices, the quarters longer
  ctx.strokeStyle = DIAL_MARK;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const long = i % 3 === 0;
    ctx.lineWidth = long ? 9 : 6;
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * (c - 10), -Math.cos(a) * (c - 10));
    ctx.lineTo(Math.sin(a) * (c - (long ? 40 : 30)), -Math.cos(a) * (c - (long ? 40 : 30)));
    ctx.stroke();
  }

  // The name. It is a Timex, which is the one fact about this object the
  // project actually has, so it is the one word printed on it.
  ctx.fillStyle = DIAL_MARK;
  ctx.font = "600 20px Urbanist, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "3px";
  ctx.fillText("TIMEX", 0, -48);

  const hand = (angle: number, length: number, width: number, color: string) => {
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-width / 2, -length, width, length + 14, width / 2);
    ctx.fill();
    ctx.restore();
  };

  hand((10 / 12) * Math.PI * 2, 54, 13, DIAL_MARK); // hour, at 10
  hand((10 / 60) * Math.PI * 2, 84, 10, DIAL_MARK); // minute, at 10 past
  hand((38 / 60) * Math.PI * 2, 88, 3, "#ff8400"); // seconds, the one warm note

  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fillStyle = DIAL_MARK;
  ctx.fill();
};

/** The dial, drawn once. */
export const getDialCanvas = (): HTMLCanvasElement => {
  if (canvas) return canvas;
  const size = 256;
  canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx, size);
  return canvas;
};
