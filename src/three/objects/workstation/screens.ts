import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

/**
 * The two monitor faces of the Experience workstation, drawn on a 2D canvas
 * rather than modelled, a dashboard is text and rectangles, which is exactly
 * what a canvas is good at, and it keeps the whole office at zero extra
 * texture downloads.
 *
 * Two scenarios share one canvas per monitor. `blend` wipes between them the
 * way a screen actually switches: a bright seam sweeping across, old content on
 * one side, new content on the other.
 *
 * These are set dressing, not a portfolio claim. Nothing here names a product,
 * a client or a dataset, they are original panels that read as "something is
 * being built" and "something is being shipped", which is all the office needs
 * them to say. Real work belongs in the story page, in the visitor's own words.
 */

const WIDTH = 640;
const HEIGHT = 360;

// Palette borrowed from the site's HUD so the screens sit in the same world.
const INK = "#e1f5ff";
const DIM = "#81bdd8";
const CYAN = "#34bfff";
const DEEP = "#001941";
const PANEL = "#00306f";
const LINE = "rgba(52, 191, 255, 0.28)";
const WARM = "#ff8400";

export type ScenarioKey = "build" | "ship";

type Side = "left" | "right";

const mono = (size: number, weight = 400) => `${weight} ${size}px ProFontWindows, ui-monospace, monospace`;

const rounded = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const panel = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = PANEL) => {
  rounded(ctx, x, y, w, h, 6);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.stroke();
};

const label = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size = 13, color = DIM) => {
  ctx.font = mono(size);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
};

const chrome = (ctx: CanvasRenderingContext2D, title: string, right: string) => {
  ctx.fillStyle = DEEP;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // window bar
  ctx.fillStyle = "#00224f";
  ctx.fillRect(0, 0, WIDTH, 26);
  ctx.fillStyle = LINE;
  ctx.fillRect(0, 26, WIDTH, 1);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(16 + i * 14, 13, 4, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? WARM : "rgba(129, 189, 216, 0.5)";
    ctx.fill();
  }
  label(ctx, title, 66, 18, 14, INK);
  ctx.textAlign = "right";
  label(ctx, right, WIDTH - 14, 18, 12, DIM);
  ctx.textAlign = "left";
};

/** Column chart. `phase` walks the bars a little so the screen is not a still. */
const bars = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number[],
  phase: number,
) => {
  const gap = 5;
  const bw = (w - gap * (seed.length - 1)) / seed.length;
  seed.forEach((base, i) => {
    const wobble = 0.06 * Math.sin(phase * 1.4 + i * 0.9);
    const value = Math.max(0.08, Math.min(1, base + wobble));
    const bh = h * value;
    rounded(ctx, x + i * (bw + gap), y + h - bh, bw, bh, 2);
    ctx.fillStyle = i === seed.length - 2 ? CYAN : "rgba(52, 191, 255, 0.45)";
    ctx.fill();
  });
};

const sparkline = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number[],
  phase: number,
  color = CYAN,
) => {
  ctx.beginPath();
  seed.forEach((base, i) => {
    const value = base + 0.05 * Math.sin(phase + i * 0.7);
    const px = x + (w * i) / (seed.length - 1);
    const py = y + h - h * Math.max(0.05, Math.min(1, value));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
};

const buildLeft = (ctx: CanvasRenderingContext2D, phase: number) => {
  chrome(ctx, "SERVICE OVERVIEW", "LIVE");

  // KPI row
  const kpis = [
    ["REQUESTS / DAY", "48,210"],
    ["SUCCESS", "96.4%"],
    ["ENDPOINTS", "32"],
  ];
  kpis.forEach(([k, v], i) => {
    const x = 14 + i * 205;
    panel(ctx, x, 38, 194, 54);
    label(ctx, k as string, x + 12, 58, 11);
    label(ctx, v as string, x + 12, 80, 20, INK);
  });

  // Node diagram, two paths through the graph with shared junctions
  panel(ctx, 14, 102, 320, 156);
  label(ctx, "SERVICE MAP", 26, 122, 11);
  const route = (points: [number, number][], color: string) => {
    ctx.beginPath();
    points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.stroke();
    points.forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = DEEP;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };
  route(
    [
      [40, 230],
      [96, 230],
      [140, 186],
      [212, 186],
      [258, 140],
      [312, 140],
    ],
    CYAN,
  );
  route(
    [
      [40, 150],
      [104, 150],
      [140, 186],
      [176, 222],
      [252, 222],
      [312, 222],
    ],
    WARM,
  );

  // Hourly load
  panel(ctx, 346, 102, 280, 156);
  label(ctx, "LOAD / HOUR", 358, 122, 11);
  bars(ctx, 358, 134, 256, 108, [0.32, 0.55, 0.86, 0.62, 0.4, 0.48, 0.74, 0.91, 0.58], phase);

  // Footer strip
  panel(ctx, 14, 268, 612, 78);
  label(ctx, "ROUTE THROUGHPUT", 26, 288, 11);
  const rows = [
    ["/api/v1", "6,412", "+4.2%"],
    ["/assets", "5,180", "+1.8%"],
    ["/search", "4,905", "-0.6%"],
  ];
  rows.forEach(([a, b, c], i) => {
    const y = 308 + i * 15;
    label(ctx, a as string, 26, y, 12, INK);
    label(ctx, b as string, 120, y, 12);
    label(ctx, c as string, 200, y, 12, (c as string).startsWith("-") ? WARM : CYAN);
    ctx.fillStyle = LINE;
    ctx.fillRect(250, y - 4, 360 * (0.5 + 0.16 * i), 1);
  });
};

const buildRight = (ctx: CanvasRenderingContext2D, phase: number) => {
  chrome(ctx, "query.sql / pipeline", "postgres");

  // Faux query, shapes of code, not code
  const code: [number, string][] = [
    [0, "select"],
    [1, "route_id, date_trunc('hour', seen_at) as h,"],
    [1, "count(*) as hits"],
    [0, "from  app.events"],
    [0, "where region in ('north','east')"],
    [0, "group by 1, 2"],
    [0, "order by hits desc"],
  ];
  code.forEach(([indent, text], i) => {
    const y = 50 + i * 19;
    label(ctx, String(i + 1).padStart(2, "0"), 14, y, 12, "rgba(129,189,216,0.45)");
    label(ctx, text, 42 + indent * 16, y, 13, i === 0 || text.startsWith("from") || text.startsWith("where") ? CYAN : INK);
  });

  panel(ctx, 14, 196, 300, 150);
  label(ctx, "ETL RUNS", 26, 216, 11);
  sparkline(ctx, 26, 226, 276, 106, [0.4, 0.62, 0.5, 0.78, 0.66, 0.9, 0.72, 0.84], phase);

  panel(ctx, 326, 196, 300, 150);
  label(ctx, "SERVICES", 338, 216, 11);
  ["flask api", "react client", "worker queue"].forEach((name, i) => {
    const y = 240 + i * 30;
    ctx.beginPath();
    ctx.arc(346, y - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = i === 2 ? WARM : CYAN;
    ctx.fill();
    label(ctx, name, 360, y, 13, INK);
    label(ctx, i === 2 ? "queued" : "healthy", 560, y, 12);
  });
};

const shipLeft = (ctx: CanvasRenderingContext2D, phase: number) => {
  chrome(ctx, "TEAM BOARD", "workspace");

  // Channel rail
  panel(ctx, 14, 38, 150, 308, "#002456");
  ["# general", "# releases", "# data", "# design", "# standup"].forEach((name, i) => {
    const y = 62 + i * 26;
    if (i === 2) {
      rounded(ctx, 22, y - 14, 134, 20, 4);
      ctx.fillStyle = "rgba(52,191,255,0.18)";
      ctx.fill();
    }
    label(ctx, name, 28, y, 13, i === 2 ? INK : DIM);
    if (i === 1) {
      ctx.beginPath();
      ctx.arc(148, y - 4, 6, 0, Math.PI * 2);
      ctx.fillStyle = WARM;
      ctx.fill();
    }
  });

  // Message stream
  panel(ctx, 176, 38, 450, 190);
  const messages = [
    ["AK", "deploy went out, build is green"],
    ["BT", "hooked the hourly job to the new endpoint"],
    ["RS", "throughput view looks right now"],
  ];
  messages.forEach(([who, text], i) => {
    const y = 66 + i * 44;
    rounded(ctx, 190, y - 14, 22, 22, 5);
    ctx.fillStyle = i === 1 ? CYAN : "rgba(52,191,255,0.35)";
    ctx.fill();
    label(ctx, who as string, 195, y + 2, 12, DEEP);
    label(ctx, text as string, 222, y, 13, INK);
    label(ctx, "09:4" + (i + 2), 222, y + 16, 11);
  });
  // typing indicator
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(226 + i * 10, 208, 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(225, 245, 255, ${0.25 + 0.6 * Math.max(0, Math.sin(phase * 2.4 - i * 0.7))})`;
    ctx.fill();
  }

  panel(ctx, 176, 240, 218, 106);
  label(ctx, "MESSAGES / DAY", 188, 260, 11);
  bars(ctx, 188, 272, 194, 60, [0.4, 0.7, 0.55, 0.88, 0.62, 0.75], phase);

  panel(ctx, 408, 240, 218, 106);
  label(ctx, "ACTIVE MEMBERS", 420, 260, 11);
  label(ctx, "24", 420, 296, 26, INK);
  sparkline(ctx, 500, 268, 112, 60, [0.35, 0.6, 0.48, 0.72, 0.85, 0.7], phase, WARM);
};

const shipRight = (ctx: CanvasRenderingContext2D, phase: number) => {
  chrome(ctx, "workspace / activity", "realtime");

  panel(ctx, 14, 38, 612, 140);
  label(ctx, "EVENTS PER MINUTE", 26, 58, 11);
  bars(
    ctx,
    26,
    70,
    588,
    96,
    [0.3, 0.44, 0.62, 0.5, 0.72, 0.58, 0.8, 0.66, 0.9, 0.74, 0.55, 0.68],
    phase,
  );

  panel(ctx, 14, 190, 300, 156);
  label(ctx, "CHANNEL SPLIT", 26, 210, 11);
  ["releases", "data", "standup", "design"].forEach((name, i) => {
    const y = 234 + i * 26;
    label(ctx, name, 26, y, 13, INK);
    const w = 150 * [0.9, 0.72, 0.48, 0.3][i]!;
    rounded(ctx, 150, y - 9, w, 10, 5);
    ctx.fillStyle = i === 0 ? CYAN : "rgba(52,191,255,0.4)";
    ctx.fill();
  });

  panel(ctx, 326, 190, 300, 156);
  label(ctx, "INTEGRATIONS", 338, 210, 11);
  ["webhook relay", "digest job", "presence sync"].forEach((name, i) => {
    const y = 240 + i * 32;
    ctx.beginPath();
    ctx.arc(346, y - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = CYAN;
    ctx.fill();
    label(ctx, name, 360, y, 13, INK);
    label(ctx, ["ok", "ok", "ok"][i]!, 592, y, 12);
  });
};

const SCENES: Record<ScenarioKey, Record<Side, (ctx: CanvasRenderingContext2D, phase: number) => void>> = {
  build: { left: buildLeft, right: buildRight },
  ship: { left: shipLeft, right: shipRight },
};

class Screen {
  readonly texture: CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly side: Side;

  constructor(side: Side) {
    this.side = side;
    this.canvas = document.createElement("canvas");
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;

    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
  }

  /** `blend` 0 = build, 1 = ship; in between the new panel wipes across. */
  draw(blend: number, phase: number) {
    const { ctx } = this;
    ctx.save();
    ctx.textBaseline = "alphabetic";

    const seam = WIDTH * blend;

    if (blend < 0.999) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(seam, 0, WIDTH - seam, HEIGHT);
      ctx.clip();
      SCENES.build[this.side](ctx, phase);
      ctx.restore();
    }

    if (blend > 0.001) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, seam, HEIGHT);
      ctx.clip();
      SCENES.ship[this.side](ctx, phase);
      ctx.restore();
    }

    if (blend > 0.001 && blend < 0.999) {
      ctx.fillStyle = CYAN;
      ctx.fillRect(seam - 2, 0, 4, HEIGHT);
      ctx.fillStyle = "rgba(52, 191, 255, 0.25)";
      ctx.fillRect(seam - 26, 0, 24, HEIGHT);
    }

    ctx.restore();
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}

let left: Screen | null = null;
let right: Screen | null = null;

/**
 * `blend` crosses the two scenarios; `dim` is how far the panels have gone
 * dark, 0 = on, 1 = off. The X-ray sequence drives `dim`, the monitors going
 * quiet is the cue that says something is about to happen to the scene, and it
 * is applied to the screen materials by the workstation tick rather than
 * redrawn into the canvases, which would cost a repaint per frame.
 */
const state = { blend: 0, dim: 0 };
let lastDrawn = -1;
let fontsReady = false;

const init = () => {
  if (left) return;
  left = new Screen("left");
  right = new Screen("right");
  redraw(0);

  // ProFontWindows arrives after first paint; redraw once it lands so the
  // screens use the site's own face rather than the monospace fallback.
  document.fonts.ready.then(() => {
    fontsReady = true;
    redraw(0);
  });
};

const redraw = (phase: number) => {
  left?.draw(state.blend, phase);
  right?.draw(state.blend, phase);
};

/**
 * Called from the workstation tick. Redraws at ~6fps while the scene is on
 * stage and never otherwise, the canvases are the only per-frame cost in the
 * office and this keeps them off the budget.
 */
const update = (time: number) => {
  const step = Math.floor(time * 6);
  if (step === lastDrawn && fontsReady) return;
  lastDrawn = step;
  redraw(time);
};

const destroy = () => {
  left?.dispose();
  right?.dispose();
  left = null;
  right = null;
  lastDrawn = -1;
  fontsReady = false;
  state.blend = 0;
  state.dim = 0;
};

export const screens = {
  init,
  update,
  destroy,
  state,
  getLeftTexture: () => left?.texture ?? null,
  getRightTexture: () => right?.texture ?? null,
};
