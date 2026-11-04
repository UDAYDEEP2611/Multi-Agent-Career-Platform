import { useLayoutEffect, useRef, useState } from "react";

const DPI = 96;
const PAGE_WIDTH = 8.5 * DPI;
const PAGE_HEIGHT = 11 * DPI;

// Shows the resume at real US Letter width (8.5in), scaled down to fit the
// column, so lines wrap exactly as they will in the PDF. Reports how many
// pages it fills; dashed lines in the resume mark where each page ends.
export default function ResumePage({ marginInches, onPages, children }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;

      const nextScale = Math.min(1, outer.current.clientWidth / PAGE_WIDTH);
      const docHeight = inner.current.offsetHeight;
      const marginPx = marginInches * DPI;
      const perPage = PAGE_HEIGHT - 2 * marginPx;

      setScale(nextScale);
      setHeight(docHeight * nextScale);
      onPages(Math.max(1, Math.ceil((docHeight - 2 * marginPx - 1) / perPage)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer.current);
    observer.observe(inner.current);
    return () => observer.disconnect();
  }, [marginInches, onPages]);

  return (
    <div ref={outer} className="resume-page-frame" style={{ height }}>
      <div
        ref={inner}
        className="resume-page-scale"
        style={{ width: PAGE_WIDTH, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
