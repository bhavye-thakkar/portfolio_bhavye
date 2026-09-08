import EventEmitter from "../../utils/EventEmitter";

class ThreeSizes extends EventEmitter<{
  resize: { width: number; height: number; pixelRatio: number };
}> {
  width: number = 0;
  height: number = 0;
  pixelRatio: number = 1;
  canvas: HTMLCanvasElement | null = null;
  observer: ResizeObserver | null = null;

  init(_canvas: HTMLCanvasElement) {
    this.canvas = _canvas;
    this.observer = new ResizeObserver(this.resize.bind(this));
    this.observer.observe(this.canvas);
  }

  resize() {
    const rect = this.canvas?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    this.width = rect?.width ?? 0;
    this.height = rect?.height ?? 0;
    /**
     * Capped at 1.5, not 2. Fill cost goes with the square of this: at 2 a
     * retina laptop draws 5.2 million pixels a frame (with 4x MSAA on top) and
     * a 3x phone, capped to 2, draws four times a 1x screen, and both were
     * choking in the Experience section where every frame is two passes. At
     * 1.5 both draw 44% fewer pixels. What it softens: model edges, which the
     * MSAA covers, and the canvas-drawn type inside the scene (the CV sheet,
     * the watch dial, the About counter, the monitor code), none of which is
     * meant to be read at that size. The site's real type is all DOM and is
     * untouched.
     */
    this.pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    this.emit("resize", { width: this.width, height: this.height, pixelRatio: this.pixelRatio });
  }

  destroy() {
    this.observer?.disconnect();
    this.observer = null;
    this.canvas = null;
  }
}

export const threeSizes = new ThreeSizes();
