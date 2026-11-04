import { useState } from "react";
import { Modal, Form, Button, Alert } from "react-bootstrap";
import FileAttachmentField from "./FileAttachmentField";

const emptyForm = {
  title: "",
  mediaType: "Image",
  url: "",
  description: ""
};

const mediaTypes = [
  "Image",
  "Document",
  "Presentation",
  "Video",
  "Certificate",
  "Project",
  "GitHub",
  "Website",
  "Article",
  "Other"
];

export default function ExperienceMediaModal({
  show,
  media,
  onHide,
  onSave
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);

  const handleShow = () => {
    setFile(null);
    setRemoveFile(false);

    setForm(
      media
        ? {
            title: media.title || "",
            mediaType: media.mediaType || "Image",
            url: media.url || "",
            description: media.description || ""
          }
        : { ...emptyForm }
    );

    setError("");
  };

  const change = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  // Match the type to the chosen file
  const chooseFile = (selected) => {
    setFile(selected);

    if (selected) {
      setForm((previous) => ({
        ...previous,
        mediaType: selected.type === "application/pdf" ? "Document" : "Image"
      }));
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onSave(
        {
          title: form.title.trim(),
          mediaType: form.mediaType,
          url: form.url.trim(),
          description: form.description.trim()
        },
        { file, removeFile }
      );

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
      backdrop={saving ? "static" : true}
      keyboard={!saving}
    >
      <Form onSubmit={submit}>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            {media ? "Edit Media" : "Add Media"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>Title *</Form.Label>
            <Form.Control
              name="title"
              value={form.title}
              onChange={change}
              required
              maxLength={200}
              placeholder="Media title"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Media Type *</Form.Label>
            <Form.Select
              name="mediaType"
              value={form.mediaType}
              onChange={change}
              required
            >
              {mediaTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>URL / Link (Optional)</Form.Label>
            <Form.Control
              type="url"
              name="url"
              value={form.url}
              onChange={change}
              maxLength={2048}
              placeholder="https://..."
            />
          </Form.Group>

          <div className="mb-3">
            <FileAttachmentField
              currentFile={media?.file}
              file={file}
              onFileChange={chooseFile}
              removeFile={removeFile}
              onRemoveFileChange={setRemoveFile}
              onError={setError}
            />
          </div>

          <Form.Group>
            <Form.Label>Description (Optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              name="description"
              value={form.description}
              onChange={change}
              maxLength={2000}
              placeholder="Describe this project or media..."
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
