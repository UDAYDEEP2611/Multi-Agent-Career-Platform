import { useEffect, useRef, useState } from "react";

// Text cut off after `lines` lines, with Show more / Show less when it
// doesn't fit
export default function ClampedText({ text, lines = 3, className = "" }) {
  const ref = useRef(null);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(() =>
      setOverflowing(element.scrollHeight > element.clientHeight + 1)
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, [text]);

  return (
    <div className={className}>
      <p
        ref={ref}
        className="mb-0"
        style={{
          whiteSpace: "pre-line",
          ...(expanded
            ? {}
            : {
                display: "-webkit-box",
                WebkitLineClamp: lines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden"
              })
        }}
      >
        {text}
      </p>

      {(overflowing || expanded) && (
        <button
          type="button"
          className="btn btn-link btn-sm p-0 mt-1 text-decoration-none"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
