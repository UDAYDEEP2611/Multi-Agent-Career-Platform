import { Button, Form } from "react-bootstrap";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const acceptedTypes = "image/jpeg,image/png,image/webp,application/pdf";

// Optional picture/PDF picker used by the experience item modals
export default function FileAttachmentField({
  currentFile,
  file,
  onFileChange,
  removeFile,
  onRemoveFileChange,
  onError
}) {
  const chooseFile = (event) => {
    const selected = event.target.files?.[0] || null;

    if (selected && selected.size > MAX_FILE_SIZE) {
      onError("File is too large (maximum 10 MB)");
      event.target.value = "";
      onFileChange(null);
      return;
    }

    onError("");
    onFileChange(selected);
  };

  return (
    <Form.Group>
      <Form.Label>Picture / PDF (Optional)</Form.Label>

      {currentFile && !file && (
        <div className="d-flex align-items-center gap-2 small mb-2">
          <i
            className={`bi ${
              currentFile.mimeType === "application/pdf"
                ? "bi-file-earmark-pdf text-danger"
                : "bi-file-earmark-image text-primary"
            }`}
          />
          <span
            className={`text-truncate ${
              removeFile ? "text-decoration-line-through text-secondary" : ""
            }`}
          >
            {currentFile.originalName}
          </span>
          <Button
            variant="link"
            size="sm"
            className="p-0 ms-auto"
            onClick={() => onRemoveFileChange(!removeFile)}
          >
            {removeFile ? "Keep file" : "Remove file"}
          </Button>
        </div>
      )}

      <Form.Control
        type="file"
        accept={acceptedTypes}
        onChange={chooseFile}
      />
      <Form.Text muted>
        JPG, PNG, WEBP or PDF, up to 10 MB.
        {currentFile && " Choosing a new file replaces the current one."}
      </Form.Text>
    </Form.Group>
  );
}
