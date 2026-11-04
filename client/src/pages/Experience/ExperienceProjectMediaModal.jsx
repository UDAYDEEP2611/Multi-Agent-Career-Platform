import { useState } from "react";
import {
  Modal,
  Form,
  Button,
  Alert
} from "react-bootstrap";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const acceptedFiles = ".jpg,.jpeg,.png,.webp,.pdf,.docx,.pptx";

export default function ExperienceProjectMediaModal({
  show,
  media,
  onHide,
  onSave
}) {
  const [type, setType] = useState("File");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setType(media?.mediaType || "File");
    setTitle(media?.title || "");
    setDescription(media?.description || "");
    setUrl(media?.url || "");
    setFile(null);
    setError("");
  };

  const chooseFile = (event) => {
    const selected = event.target.files?.[0] || null;

    if (selected && selected.size > MAX_FILE_SIZE) {
      setError("File is too large (maximum 10 MB)");
      event.target.value = "";
      setFile(null);
      return;
    }

    setError("");
    setFile(selected);

    // Use the file name as a starting title
    if (selected && !title.trim()) {
      setTitle(selected.name.replace(/\.[^.]+$/, "").slice(0, 200));
    }
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (!media && type === "File" && !file) {
      setError("Select a file");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (!media && type === "File") {
        const formData = new FormData();

        formData.append("title", title.trim());
        formData.append("description", description.trim());
        formData.append("file", file);

        await onSave({ type: "File", formData });
      } else {
        await onSave({
          type,
          data: {
            title: title.trim(),
            description: description.trim(),
            ...(type === "Link" ? { url: url.trim() } : {})
          }
        });
      }

      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save media"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onShow={handleShow}
      onHide={saving ? undefined : onHide}
      centered
      scrollable
      backdrop={saving ? "static" : true}
      keyboard={!saving}
    >
      <Form onSubmit={submit} className="d-flex flex-column overflow-hidden">
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            {media ? "Edit Media" : "Add Media"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          {!media && (
            <Form.Group className="mb-3">
              <Form.Label>Add</Form.Label>
              <div className="d-flex gap-3">
                <Form.Check
                  type="radio"
                  id="project-media-file"
                  label="Upload file"
                  checked={type === "File"}
                  onChange={() => setType("File")}
                />
                <Form.Check
                  type="radio"
                  id="project-media-link"
                  label="External link"
                  checked={type === "Link"}
                  onChange={() => setType("Link")}
                />
              </div>
            </Form.Group>
          )}

          {!media && type === "File" && (
            <Form.Group className="mb-3">
              <Form.Label>Choose File *</Form.Label>
              <Form.Control
                type="file"
                accept={acceptedFiles}
                onChange={chooseFile}
              />
              <Form.Text muted>
                JPG, PNG, WEBP, PDF, DOCX or PPTX, up to 10 MB.
              </Form.Text>
            </Form.Group>
          )}

          {media?.mediaType === "File" && media.file && (
            <div className="small text-secondary mb-3">
              <i className="bi bi-paperclip me-1" />
              {media.file.originalName}
              <div className="mt-1">
                To replace the file, delete this item and upload the new one.
              </div>
            </div>
          )}

          {type === "Link" && (
            <Form.Group className="mb-3">
              <Form.Label>URL / Link *</Form.Label>
              <Form.Control
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
                maxLength={2048}
                placeholder="https://..."
              />
            </Form.Group>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Title *</Form.Label>
            <Form.Control
              value={title}
              placeholder="Media title"
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Description (Optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={description}
              placeholder="Add details..."
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={saving}
            onClick={onHide}
          >
            Cancel
          </Button>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Media"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
