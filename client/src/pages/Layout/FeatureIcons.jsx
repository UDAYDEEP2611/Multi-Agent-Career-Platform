// Line icons for the CV Maker and JobPilot features (shapes from Lucide,
// ISC license). They take the text's color and size, like Bootstrap Icons.

function LineIcon({ children, className = "", title }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1.15em"
      height="1.15em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`uuv-line-icon ${className}`.trim()}
      style={{ verticalAlign: "-0.2em" }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {children}
    </svg>
  );
}

// A document with a person on it
export function CvMakerIcon(props) {
  return (
    <LineIcon {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M16 22a4 4 0 0 0-8 0" />
      <circle cx="12" cy="15" r="3" />
    </LineIcon>
  );
}

// A scan frame with a magnifier: looking for the match
export function JobPilotIcon(props) {
  return (
    <LineIcon {...props}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="12" r="3" />
      <path d="m16 16-1.9-1.9" />
    </LineIcon>
  );
}
