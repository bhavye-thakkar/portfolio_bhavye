/**
 * ─── A PANEL'S SCROLL IS THE ONLY SCROLL ──────────────────────────────────
 *
 * For a fixed, full-screen panel with its own `overflow-y: auto` over a page
 * that must not move (the object pages, the book page). Two things already
 * see to a touch that starts on the PAGE: Lenis is stopped there and cancels
 * any touch outside a `data-lenis-prevent` element, and the root is
 * `overflow-y: hidden` while a panel is up. A touch that starts INSIDE the
 * panel is left to the browser on purpose, that is what lets the panel scroll
 * at all, and the gap is what the browser does with it once the panel has
 * nothing left to scroll in that direction: iOS hands the gesture on to the
 * document (`overscroll-behavior: contain` only stops that from iOS 16). So
 * the scroller itself cancels exactly those moves, pulling down at the top and
 * pushing up at the bottom, and nothing else.
 *
 * `own(element)` registers the pair, `release()` removes it; a second `own`
 * releases the first, so reopening never stacks listeners.
 */
export const createScrollOwner = () => {
  let element: HTMLElement | null = null;
  let touchY = 0;

  const handleTouchStart = (event: TouchEvent) => {
    touchY = event.touches[0]?.clientY ?? 0;
  };

  const handleTouchMove = (event: TouchEvent) => {
    const scroller = event.currentTarget as HTMLElement;
    const y = event.touches[0]?.clientY ?? 0;
    const dy = y - touchY;
    touchY = y;
    const atTop = scroller.scrollTop <= 0 && dy > 0;
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1 && dy < 0;
    if ((atTop || atBottom) && event.cancelable) event.preventDefault();
  };

  const release = () => {
    element?.removeEventListener("touchstart", handleTouchStart);
    element?.removeEventListener("touchmove", handleTouchMove);
    element = null;
  };

  const own = (scroller: HTMLElement | null) => {
    release();
    if (!scroller) return;
    element = scroller;
    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
  };

  return { own, release };
};
