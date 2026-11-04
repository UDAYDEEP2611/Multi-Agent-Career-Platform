// Link to an attached picture/PDF, shown as icon + file name
export default function FileChip({ href, file, className = "" }) {
  const isPdf = file.mimeType === "application/pdf";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`d-inline-flex align-items-center gap-2 border rounded px-2 py-1 small text-decoration-none mw-100 ${className}`}
    >
      <i
        className={`bi fs-5 flex-shrink-0 ${
          isPdf
            ? "bi-file-earmark-pdf text-danger"
            : "bi-file-earmark-image text-primary"
        }`}
      />
      <span className="text-truncate">{file.originalName}</span>
    </a>
  );
}
