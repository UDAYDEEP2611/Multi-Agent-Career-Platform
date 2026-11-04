import { useState } from "react";
import { Accordion, Alert, Button, Form, Modal, Spinner } from "react-bootstrap";

import useProjectSection from "./useProjectSection";

// Accordion panel for one list inside a standalone project. The caller
// describes the list:
//   title, itemLabel, section, itemKey, emptyText, maxItems
//   emptyForm: initial form values
//   toForm(item): form values for editing
//   toPayload(form): request body, or { error }
//   renderFields(form, change): form inputs
//   renderItem(item): the item's display
export default function ProjectSectionPanel({ projectId, eventKey, config }) {
  const { items, loading, error, setError, save, remove } = useProjectSection(
    projectId,
    config.section,
    config.itemKey
  );

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(config.emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const full = items.length >= config.maxItems;

  const open = (item) => {
    setEditing(item);
    setShowModal(true);
  };

  const handleShow = () => {
    setForm(editing ? config.toForm(editing) : config.emptyForm);
    setFormError("");
  };

  const change = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();

    const payload = config.toPayload(form);

    if (payload.error) {
      setFormError(payload.error);
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      await save(editing, payload);
      setShowModal(false);
    } catch (err) {
      setFormError(err.response?.data?.message || `Unable to save ${config.itemLabel.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeletingBusy(true);

    try {
      await remove(deleting);
      setDeleting(null);
    } catch (err) {
      setError(err.response?.data?.message || `Unable to delete ${config.itemLabel.toLowerCase()}`);
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header>
        <span className="fw-semibold">{config.title}</span>
        <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
          {loading ? "…" : items.length}
        </span>
      </Accordion.Header>

      <Accordion.Body>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <span className={`small ${full ? "text-danger" : "text-secondary"}`}>
            {full
              ? `Limit reached: you can add up to ${config.maxItems}.`
              : `You can add up to ${config.maxItems}.`}
          </span>

          <Button size="sm" onClick={() => open(null)} disabled={full}>
            <i className="bi bi-plus-lg me-1" />
            Add {config.itemLabel}
          </Button>
        </div>

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-3">
            <Spinner animation="border" size="sm" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-secondary mb-0">{config.emptyText}</p>
        ) : (
          items.map((item, index) => (
            <div
              key={item._id}
              className={`d-flex justify-content-between align-items-start gap-3 py-3 ${
                index < items.length - 1 ? "border-bottom" : ""
              }`}
            >
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                {config.renderItem(item)}
              </div>

              <div className="btn-group btn-group-sm flex-shrink-0">
                <Button variant="outline-secondary" title="Edit" onClick={() => open(item)}>
                  <i className="bi bi-pencil" />
                </Button>
                <Button variant="outline-danger" title="Delete" onClick={() => setDeleting(item)}>
                  <i className="bi bi-trash" />
                </Button>
              </div>
            </div>
          ))
        )}
      </Accordion.Body>

      <Modal
        show={showModal}
        onShow={handleShow}
        onHide={saving ? undefined : () => setShowModal(false)}
        centered
        backdrop={saving ? "static" : true}
        keyboard={!saving}
      >
        <Form onSubmit={submit}>
          <Modal.Header closeButton={!saving}>
            <Modal.Title>
              {editing ? "Edit" : "Add"} {config.itemLabel}
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}
            {config.renderFields(form, change)}
          </Modal.Body>

          <Modal.Footer>
            <Button variant="outline-secondary" disabled={saving} onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : `Save ${config.itemLabel}`}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={!!deleting}
        onHide={() => {
          if (!deletingBusy) setDeleting(null);
        }}
        centered
      >
        <Modal.Header closeButton={!deletingBusy}>
          <Modal.Title>Delete {config.itemLabel}?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Delete <strong>{deleting?.title}</strong>? This action cannot be undone.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={deletingBusy} onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={deletingBusy} onClick={confirmDelete}>
            {deletingBusy ? "Deleting..." : "Delete"}
          </Button>
        </Modal.Footer>
      </Modal>
    </Accordion.Item>
  );
}
