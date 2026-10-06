import gsap from "gsap";

/**
 * ─── THE SHELVES ──────────────────────────────────────────────────────────
 *
 * Three rows of books that move sideways without end. This is the whole of
 * the motion: no scroll container, no carousel, no second render loop. Each
 * row keeps one number, `offset`, and every book on it is placed at
 *
 *     x = (start + offset) mod loop - lead
 *
 * so a book that leaves on the left comes back in on the right, with the same
 * DOM node. The books are never duplicated for the loop; Library.vue only
 * repeats a shelf's set when the shelf is narrower than the screen it has to
 * fill (a wide monitor), and then the repeats are real nodes in the same
 * modulus. Widths come from the data (cover aspect x the row's book height),
 * so laying out a row reads nothing from the DOM and the per-frame work is one
 * `translate3d` per visible book.
 *
 * ── WHO MOVES WHAT ────────────────────────────────────────────────────────
 *
 *   drag / swipe   the row under the finger, 1:1, then a throw that eases out
 *   wheel          every row, alternate rows the opposite way (the archive
 *                  slides past itself rather than scrolling as one sheet)
 *   arrow keys     every row, the same alternation, one book-width a press
 *   on its own     a drift of a few pixels a second, alternate rows opposite,
 *                  only after two seconds without input, never while a book
 *                  page is open, never with reduced motion
 *
 * Every input writes `target`; the tick eases `offset` toward it on the app's
 * one ticker (gsap's). A drag writes both, so the row stays under the finger.
 *
 * ── TOUCH ────────────────────────────────────────────────────────────────
 *
 * The rows are `touch-action: pan-y`: the browser keeps vertical pans (the
 * page scrolls if it is taller than the screen) and hands us the horizontal
 * ones as pointer events. A gesture only becomes a drag once it has moved
 * further sideways than up, so a thumb that wanders a little does not steal
 * the page, and a sideways swipe never scrolls it.
 */

export type RowInput = {
  /** The track the books are positioned in. */
  el: HTMLElement;
  /** One node per book in display order, repeats included. */
  nodes: HTMLElement[];
  /**
   * Each node's width on the shelf as a multiple of the row's book height:
   * the spine's face plus the angled sliver of cover plus its own bit of air,
   * worked out by Library.vue from the data, never read from the DOM.
   */
  footprints: number[];
  /** Per node: its 1-based number among the books, or null for a divider. */
  ordinals: (number | null)[];
  /** +1 or -1: the way this row drifts and answers the wheel. */
  direction: 1 | -1;
  /** Wheel and key response multiplier; a little less than 1 reads as further back. */
  depth: number;
};

type Row = RowInput & {
  widths: number[];
  starts: number[];
  loop: number;
  lead: number;
  offset: number;
  target: number;
  pointerId: number | null;
  dragging: boolean;
  dragged: boolean;
  startX: number;
  startY: number;
  dragOffset: number;
  lastX: number;
  lastT: number;
  velocity: number;
  lastXs: number[];
};

/**
 * Book height and the gap between books, from the viewport. Spines stand
 * close on a real shelf, so the gap is a few pixels; each book carries a
 * little air of its own in its footprint (Library.vue) so the row does not
 * read as one solid block.
 */
export const metrics = (vw: number, vh: number) => {
  const portrait = vh > vw;
  // One shelf, about half the screen tall, the proportion the reference keeps:
  // the books are the page. The masthead and the counter take the rest.
  // Landscape: whatever is left once the header, the masthead and the counter
  // have taken their ~410px, so the page fits the screen and the wheel is the
  // shelf's rather than the page's.
  const bookH = portrait ? Math.round(clamp(vh * 0.5, 280, 460)) : Math.round(clamp(vh - 410, 280, 520));
  const gap = 4;
  return { bookH, gap };
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const DRAG_THRESHOLD = 6;
/** px/s of drift, before the row's depth factor. */
const DRIFT = 6;
/** ms without input before the drift resumes. */
const IDLE = 2500;
/** A flick's velocity (px/ms) becomes this many ms of travel. */
const THROW = 320;
/** Share of the remaining distance covered per 60fps frame. */
const EASE = 0.1;

export const createArchive = (options: { reducedMotion: () => boolean; onCurrent?: (ordinal: number) => void }) => {
  let root: HTMLElement | null = null;
  let rows: Row[] = [];
  let running = false;
  let paused = false;
  let lastInput = 0;
  let trackW = 0;
  let current = 0;

  const markInput = () => {
    lastInput = performance.now();
  };

  // ── layout ─────────────────────────────────────────────────────────────

  const layout = (bookH: number, gap: number, width: number) => {
    trackW = width;
    for (const row of rows) {
      let x = 0;
      let maxW = 0;
      row.widths = row.footprints.map((footprint) => {
        const w = Math.round(bookH * footprint);
        maxW = Math.max(maxW, w);
        return w;
      });
      row.starts = row.widths.map((w) => {
        const start = x;
        x += w + gap;
        return start;
      });
      row.loop = x;
      row.lead = maxW + gap;
      row.nodes.forEach((node, i) => {
        node.style.width = `${row.widths[i]}px`;
      });
    }
    place(true);
  };

  /** Where node i of a row sits right now, in track pixels. */
  const xOf = (row: Row, i: number) => {
    let x = (row.starts[i]! + row.offset) % row.loop;
    if (x < 0) x += row.loop;
    return x - row.lead;
  };

  const place = (force = false) => {
    for (const row of rows) {
      if (!row.loop) continue;
      for (let i = 0; i < row.nodes.length; i++) {
        const node = row.nodes[i]!;
        const w = row.widths[i]!;
        const x = Math.round(xOf(row, i));
        const onScreen = x > -w - 40 && x < trackW + 40;
        const was = node.dataset.on === "1";
        if (!onScreen && !was && !force) continue;
        node.dataset.on = onScreen ? "1" : "0";
        node.style.transform = `translate3d(${x}px,0,0)`;
      }
    }
    // The book nearest the middle of the first row is "the current one", for
    // the counter and the scrub line.
    const row = rows[0];
    if (!row || !row.loop || !options.onCurrent) return;
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < row.nodes.length; i++) {
      if (row.ordinals[i] == null) continue;
      const distance = Math.abs(xOf(row, i) + row.widths[i]! / 2 - trackW / 2);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    if (best === -1) return;
    const ordinal = row.ordinals[best]!;
    if (ordinal !== current) {
      current = ordinal;
      options.onCurrent(ordinal);
    }
  };

  /**
   * Moves the first row so the book `count` places along from the current one
   * sits in the middle: the arrow keys and the two buttons.
   */
  const stepBy = (count: number) => {
    const row = rows[0];
    if (!row || !row.loop || paused) return;
    const bookIndexes = row.ordinals.map((o, i) => (o == null ? -1 : i)).filter((i) => i >= 0);
    if (!bookIndexes.length) return;
    const at = Math.max(0, bookIndexes.findIndex((i) => row.ordinals[i] === current));
    const target = bookIndexes[(((at + count) % bookIndexes.length) + bookIndexes.length) % bookIndexes.length]!;
    // Nearest copy of the target, so a step never unwinds the whole loop.
    let delta = trackW / 2 - (xOf(row, target) + row.widths[target]! / 2);
    delta = ((((delta + row.loop / 2) % row.loop) + row.loop) % row.loop) - row.loop / 2;
    row.target += delta;
    markInput();
  };

  // ── per frame ──────────────────────────────────────────────────────────

  const tick = () => {
    const ratio = Math.min(gsap.ticker.deltaRatio(60), 4);
    const seconds = (gsap.ticker.deltaRatio(60) * 1000) / 60 / 1000;
    const now = performance.now();
    const reduced = options.reducedMotion();
    const drifting = !paused && !reduced && now - lastInput > IDLE;
    // frame-rate independent ease toward the target
    const ease = 1 - Math.pow(1 - (reduced ? 0.5 : EASE), ratio);

    for (const row of rows) {
      if (row.dragging) continue;
      if (drifting) row.target += row.direction * DRIFT * row.depth * seconds;
      const gapTo = row.target - row.offset;
      if (Math.abs(gapTo) < 0.05) row.offset = row.target;
      else row.offset += gapTo * ease;
    }
    place();
  };

  const start = () => {
    if (running) return;
    running = true;
    markInput();
    gsap.ticker.add(tick);
  };

  const stop = () => {
    if (!running) return;
    running = false;
    gsap.ticker.remove(tick);
  };

  // ── pointer: drag the row under the finger ─────────────────────────────

  const rowOf = (event: Event) => rows.find((row) => row.el === event.currentTarget) ?? null;

  const handlePointerDown = (event: PointerEvent) => {
    const row = rowOf(event);
    if (!row || paused || event.button !== 0) return;
    row.pointerId = event.pointerId;
    row.dragging = false;
    row.dragged = false;
    row.startX = event.clientX;
    row.startY = event.clientY;
    row.dragOffset = row.offset;
    row.lastX = event.clientX;
    row.lastT = performance.now();
    row.velocity = 0;
    row.lastXs = [];
  };

  const handlePointerMove = (event: PointerEvent) => {
    const row = rowOf(event);
    if (!row || row.pointerId !== event.pointerId) return;
    const dx = event.clientX - row.startX;
    const dy = event.clientY - row.startY;

    if (!row.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD) {
        // Up or down first: the browser has this gesture (pan-y), not us.
        if (Math.abs(dy) > DRAG_THRESHOLD * 1.5) row.pointerId = null;
        return;
      }
      if (Math.abs(dy) > Math.abs(dx)) {
        row.pointerId = null;
        return;
      }
      row.dragging = true;
      row.dragged = true;
      row.el.setPointerCapture(event.pointerId);
      row.el.classList.add("is-dragging");
      markInput();
    }

    const now = performance.now();
    const dt = Math.max(1, now - row.lastT);
    row.velocity = (event.clientX - row.lastX) / dt;
    row.lastX = event.clientX;
    row.lastT = now;
    row.offset = row.target = row.dragOffset + dx;
    markInput();
    if (event.cancelable) event.preventDefault();
  };

  const endDrag = (event: PointerEvent) => {
    const row = rowOf(event);
    if (!row || row.pointerId !== event.pointerId) return;
    row.pointerId = null;
    if (!row.dragging) return;
    row.dragging = false;
    row.el.classList.remove("is-dragging");
    if (row.el.hasPointerCapture(event.pointerId)) row.el.releasePointerCapture(event.pointerId);
    // A flick carries on and eases out; a slow release stops where it is.
    const stale = performance.now() - row.lastT > 80;
    const velocity = stale ? 0 : row.velocity;
    row.target = row.offset + clamp(velocity * THROW, -1400, 1400);
    markInput();
  };

  // The click that ends a drag must not open the book under the pointer.
  const handleClick = (event: MouseEvent) => {
    const row = rowOf(event);
    if (!row || !row.dragged) return;
    row.dragged = false;
    event.preventDefault();
    event.stopPropagation();
  };

  // ── wheel and keys: every row, alternating ─────────────────────────────

  const handleWheel = (event: WheelEvent) => {
    if (paused) return;
    const lines = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? trackW : 1;
    const vertical = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
    // A vertical wheel is the page's when the page has somewhere to scroll
    // (a short window, a phone held sideways): taking it would trap the
    // visitor above the third shelf. Sideways wheel and trackpad swipes, drag
    // and the arrow keys still move the shelves; when the page fits, the
    // vertical wheel moves them too.
    if (vertical && document.documentElement.scrollHeight > window.innerHeight + 2) return;
    const delta = (vertical ? event.deltaY : event.deltaX) * lines;
    if (!delta) return;
    event.preventDefault();
    for (const row of rows) row.target += delta * row.direction * row.depth;
    markInput();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (paused || !running) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const target = event.target as HTMLElement | null;
    if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
    event.preventDefault();
    stepBy(event.key === "ArrowRight" ? 1 : -1);
  };

  // ── wiring ─────────────────────────────────────────────────────────────

  const bindRow = (row: Row) => {
    row.el.addEventListener("pointerdown", handlePointerDown);
    row.el.addEventListener("pointermove", handlePointerMove);
    row.el.addEventListener("pointerup", endDrag);
    row.el.addEventListener("pointercancel", endDrag);
    row.el.addEventListener("click", handleClick, true);
  };

  const unbindRow = (row: Row) => {
    row.el.removeEventListener("pointerdown", handlePointerDown);
    row.el.removeEventListener("pointermove", handlePointerMove);
    row.el.removeEventListener("pointerup", endDrag);
    row.el.removeEventListener("pointercancel", endDrag);
    row.el.removeEventListener("click", handleClick, true);
  };

  /** Replaces the rows (after a mount or a re-render with more repeats). Keeps each row's offset. */
  const setRows = (inputs: RowInput[]) => {
    const previous = rows;
    rows.forEach(unbindRow);
    rows = inputs.map((input, i) => {
      const row: Row = {
        ...input,
        widths: [],
        starts: [],
        loop: 0,
        lead: 0,
        offset: previous[i]?.offset ?? 0,
        target: previous[i]?.target ?? 0,
        pointerId: null,
        dragging: false,
        dragged: false,
        startX: 0,
        startY: 0,
        dragOffset: 0,
        lastX: 0,
        lastT: 0,
        velocity: 0,
        lastXs: [],
      };
      bindRow(row);
      return row;
    });
  };

  const mount = (element: HTMLElement) => {
    root = element;
    root.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeydown);
    // QA-SHIM temporary, remove before ship, same gate as three/index.ts
    if (location.search.includes("qa=1")) {
      (window as unknown as Record<string, unknown>).__archive = { offset: () => rows[0]?.offset ?? 0, current: () => current };
    }
  };

  const destroy = () => {
    stop();
    rows.forEach(unbindRow);
    rows = [];
    root?.removeEventListener("wheel", handleWheel);
    window.removeEventListener("keydown", handleKeydown);
    root = null;
  };

  /** A book page is open: nothing moves and nothing answers. */
  const setPaused = (value: boolean) => {
    paused = value;
    if (!value) markInput();
  };

  return { setRows, layout, start, stop, mount, destroy, setPaused, stepBy, getRunning: () => running };
};
