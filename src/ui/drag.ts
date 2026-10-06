export function makeDraggable(element: HTMLElement, handle: HTMLElement | null = null): void {
  const h = handle ?? element;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  const clamp = (v: number, min: number, max: number): number =>
    Math.min(Math.max(v, min), Math.max(min, max));

  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    if (e.target instanceof HTMLElement && e.target.closest("iframe")) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = element.getBoundingClientRect();
    origLeft = rect.left;
    origTop = rect.top;
    element.style.left = `${origLeft}px`;
    element.style.top = `${origTop}px`;
    element.style.right = "auto";
    element.style.bottom = "auto";
    try {
      h.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    e.preventDefault();
  };

  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const w = element.offsetWidth;
    const hh = element.offsetHeight;
    const left = clamp(origLeft + dx, 0, window.innerWidth - w);
    const top = clamp(origTop + dy, 0, window.innerHeight - hh);
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  };

  const onUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    try {
      h.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  h.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}
