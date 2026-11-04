import { useEffect, useState } from "react";
import {
  Accordion,
  Alert,
  Button,
  Modal,
  Spinner
} from "react-bootstrap";

import EducationEntryModal from "./EducationEntryModal";
import FileChip from "../Experience/FileChip";

import {
  uploadEducationItemFile,
  deleteEducationItemFile,
  educationItemFileUrl
} from "../../api/educationFileApi";
import LimitedAddBar from "../Common/LimitedAddBar";

// Dates are stored as UTC midnight, so format them in UTC
const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });

// Newest date first; undated entries last, newest added first
function newestFirst(a, b) {
  if (a.date && b.date) {
    return new Date(b.date) - new Date(a.date) ||
      new Date(b.createdAt) - new Date(a.createdAt);
  }
  if (a.date || b.date) return a.date ? -1 : 1;
  return new Date(b.createdAt) - new Date(a.createdAt);
}

// Accordion panel for a list of dated education entries, used for both
// Activities & Achievements and Certifications & Honors.
// config: { title, itemLabel, types, titlePlaceholder, emptyText, maxItems,
//           listKey, itemKey, api: { getAll, create, update, remove } }
// Owns its own data, modal and delete confirmation.
export default function EducationEntriesSection({
  educationId,
  eventKey,
  config
}) {
  const { title, itemLabel, types, titlePlaceholder, emptyText, listKey, itemKey, api, maxItems } = config;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  const [deletingEntry, setDeletingEntry] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    api.getAll(educationId)
      .then(({ data }) => {
        if (active) {
          setEntries(data[listKey] || []);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            `Unable to load ${title.toLowerCase()}`
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [educationId, api, listKey, title]);

  // After saving, upload or remove the attached file. The modal then edits
  // the saved item, so retrying a failed upload doesn't create a duplicate.
  const applyFileChanges = async (saved, { file, removeFile }) => {
    if (file) {
      const response = await uploadEducationItemFile(
        educationId,
        listKey,
        saved._id,
        file
      );
      return response.data[itemKey];
    }

    if (removeFile && saved.file) {
      const response = await deleteEducationItemFile(
        educationId,
        listKey,
        saved._id
      );
      return response.data[itemKey];
    }

    return saved;
  };

  const openAdd = () => {
    setEditingEntry(null);
    setShowModal(true);
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setShowModal(true);
  };

  const saveEntry = async (payload, fileChanges) => {
    const { data } = editingEntry
      ? await api.update(educationId, editingEntry._id, payload)
      : await api.create(educationId, payload);

    let saved = data[itemKey];
    store(saved);
    setEditingEntry(saved);

    saved = await applyFileChanges(saved, fileChanges);
    store(saved);
    setError("");
  };

  const store = (item) =>
    setEntries((previous) =>
      previous.some((existing) => existing._id === item._id)
        ? previous.map((existing) => (existing._id === item._id ? item : existing))
        : [item, ...previous]
    );

  const confirmDelete = async () => {
    if (!deletingEntry) return;

    setDeletingBusy(true);

    try {
      await api.remove(
        educationId,
        deletingEntry._id
      );

      setEntries((previous) =>
        previous.filter(
          (item) => item._id !== deletingEntry._id
        )
      );

      setDeletingEntry(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        `Unable to delete ${itemLabel.toLowerCase()}`
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  const sorted = [...entries].sort(newestFirst);

  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header>
        <span className="fw-semibold">{title}</span>
        <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
          {loading ? "…" : entries.length}
        </span>
      </Accordion.Header>

      <Accordion.Body>
        <LimitedAddBar
          count={entries.length}
          max={maxItems}
          noun={title.toLowerCase()}
          label={`Add ${itemLabel}`}
          onAdd={openAdd}
        />

        {error && (
          <Alert
            variant="danger"
            dismissible
            onClose={() => setError("")}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-3">
            <Spinner animation="border" size="sm" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-secondary mb-0">
            {emptyText}
          </p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {sorted.map((entry) => (
              <div
                key={entry._id}
                className="d-flex justify-content-between gap-3 border-bottom pb-3"
              >
                <div>
                  <div className="fw-semibold">
                    {entry.title}
                    <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
                      {entry.type}
                    </span>
                  </div>

                  {(entry.issuedBy || entry.date) && (
                    <div className="text-secondary small mt-1">
                      {[
                        entry.issuedBy,
                        entry.date && formatDate(entry.date)
                      ].filter(Boolean).join(" · ")}
                    </div>
                  )}

                  {entry.description && (
                    <p
                      className="mt-2 mb-0"
                      style={{ whiteSpace: "pre-line" }}
                    >
                      {entry.description}
                    </p>
                  )}

                  {entry.url && (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="d-inline-block mt-2 small text-decoration-none"
                    >
                      View link
                      <i className="bi bi-box-arrow-up-right ms-1" />
                    </a>
                  )}

                  {entry.file && (
                    <div className="mt-2">
                      <FileChip
                        href={educationItemFileUrl(educationId, listKey, entry)}
                        file={entry.file}
                      />
                    </div>
                  )}
                </div>

                <div className="btn-group btn-group-sm flex-shrink-0 align-self-start">
                  <Button
                    variant="outline-secondary"
                    title="Edit"
                    onClick={() => openEdit(entry)}
                  >
                    <i className="bi bi-pencil" />
                  </Button>

                  <Button
                    variant="outline-danger"
                    title="Delete"
                    onClick={() => setDeletingEntry(entry)}
                  >
                    <i className="bi bi-trash" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <EducationEntryModal
          show={showModal}
          entry={editingEntry}
          types={types}
          itemLabel={itemLabel}
          titlePlaceholder={titlePlaceholder}
          onHide={() => setShowModal(false)}
          onSave={saveEntry}
        />

        <Modal
          show={!!deletingEntry}
          onHide={() => {
            if (!deletingBusy) setDeletingEntry(null);
          }}
          centered
          backdrop={deletingBusy ? "static" : true}
          keyboard={!deletingBusy}
        >
          <Modal.Header closeButton={!deletingBusy}>
            <Modal.Title>Delete {itemLabel}?</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            Delete{" "}
            <strong>{deletingEntry?.title}</strong>?
            This action cannot be undone.
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="outline-secondary"
              disabled={deletingBusy}
              onClick={() => setDeletingEntry(null)}
            >
              Cancel
            </Button>

            <Button
              variant="danger"
              disabled={deletingBusy}
              onClick={confirmDelete}
            >
              {deletingBusy ? "Deleting..." : "Delete"}
            </Button>
          </Modal.Footer>
        </Modal>
      </Accordion.Body>
    </Accordion.Item>
  );
}
