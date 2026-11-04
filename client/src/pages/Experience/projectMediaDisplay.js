// Icons and size labels for project media items (files and links)
const fileIcons = {
  "application/pdf": "bi-file-earmark-pdf text-danger",
  "image/jpeg": "bi-file-earmark-image text-primary",
  "image/png": "bi-file-earmark-image text-primary",
  "image/webp": "bi-file-earmark-image text-primary",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "bi-file-earmark-word text-primary",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "bi-file-earmark-ppt text-warning"
};

export const mediaIcon = (item) =>
  item.mediaType === "Link"
    ? "bi-link-45deg text-secondary"
    : fileIcons[item.file?.mimeType] || "bi-file-earmark text-secondary";

export const formatSize = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
