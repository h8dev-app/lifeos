/**
 * Liquid glass: the highlight of the panel under the pointer follows it
 * (CSS variables --mx/--my on that panel). One listener, one update per frame.
 */
export function trackGlassPointer(): () => void {
  let frame = 0;
  let last: PointerEvent | null = null;
  const update = () => {
    frame = 0;
    if (!last || document.documentElement.dataset.style !== "glass") return;
    const panel = (last.target as Element | null)?.closest?.<HTMLElement>(".glass");
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    panel.style.setProperty("--mx", `${last.clientX - r.left}px`);
    panel.style.setProperty("--my", `${last.clientY - r.top}px`);
  };
  const onMove = (e: PointerEvent) => {
    last = e;
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  return () => {
    window.removeEventListener("pointermove", onMove);
    if (frame) cancelAnimationFrame(frame);
  };
}
