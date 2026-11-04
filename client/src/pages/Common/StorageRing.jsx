// Ring chart: coloured segments for what's used, grey for what's left of
// the fixed limit. segments: [{ label, bytes, color }]
export default function StorageRing({ segments, limit, size = 180, stroke = 18, children }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.bytes, 0);
  // Past the limit, segments are scaled to fill the ring exactly
  const scale = Math.max(limit, total);

  // Where each segment starts along the ring
  const placed = segments.map((segment, index) => ({
    ...segment,
    length: (segment.bytes / scale) * circumference,
    start: segments
      .slice(0, index)
      .reduce((sum, previous) => sum + (previous.bytes / scale) * circumference, 0)
  }));

  return (
    <div className="position-relative d-inline-block flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Storage used">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bs-secondary-bg)"
          strokeWidth={stroke}
        />

        {placed.map((segment) => {
          // Keep tiny segments visible as a sliver
          const visible = segment.bytes > 0 ? Math.max(segment.length, 1.5) : 0;

          return (
            <circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={stroke}
              strokeDasharray={`${visible} ${circumference - visible}`}
              strokeDashoffset={-segment.start}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{segment.label}</title>
            </circle>
          );
        })}
      </svg>

      <div className="position-absolute top-50 start-50 translate-middle text-center w-75">
        {children}
      </div>
    </div>
  );
}
