export const mix = (a: number, b: number, t: number) => {
  return a + (b - a) * t;
};

export const lerp = (a: number, b: number, t: number) => {
  return a + (b - a) * t;
};

export const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(value, max));
};

/** 0..1 in, 0..1 out, with zero slope at both ends: a move that eases away and eases in. */
export const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/**
 * Frame-rate independent version of `lerp(a, b, factor)` called once per 60fps
 * frame: the same feel at 30, 60 or 144Hz. `deltaRatio` is gsap's frame delta
 * in 60fps frames.
 */
export const damp = (a: number, b: number, factor: number, deltaRatio: number) => {
  return lerp(a, b, 1 - Math.pow(1 - factor, deltaRatio));
};
