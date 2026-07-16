import { useCallback, useEffect, useRef, useState } from "react";

interface ResizeHandleProps {
  /** Called with delta X (positive = drag right) while dragging */
  onResize: (deltaX: number) => void;
  /** Optional double-click handler (e.g. reset) */
  onDoubleClick?: () => void;
  title?: string;
}

export function ResizeHandle({
  onResize,
  onDoubleClick,
  title = "드래그하여 너비 조절 · 더블클릭 초기화",
}: ResizeHandleProps) {
  const dragging = useRef(false);
  const lastX = useRef(0);
  const [active, setActive] = useState(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragging.current = true;
      lastX.current = e.clientX;
      setActive(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      if (dx !== 0) onResize(dx);
    },
    [onResize],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    setActive(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title={title}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onDoubleClick}
      className={`group relative z-10 w-1.5 shrink-0 cursor-col-resize touch-none ${
        active ? "bg-indigo-500" : "bg-zinc-800 hover:bg-indigo-500/70"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-y-0 -left-1 -right-1 ${
          active ? "bg-indigo-500/20" : "group-hover:bg-indigo-500/10"
        }`}
      />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-8 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-500 opacity-0 group-hover:opacity-100" />
    </div>
  );
}
