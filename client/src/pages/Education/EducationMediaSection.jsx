import { useEffect, useState } from "react";
import {
  Accordion,
  Alert,
  Button,
  Modal,
  Spinner
} from "react-bootstrap";

import EducationMediaModal from "./EducationMediaModal";
import FileChip from "../Experience/FileChip";

import {
  getEducationMedia,
  createEducationMedia,
  updateEducationMedia,
  deleteEducationMedia,
  uploadEducationMediaFile,
  deleteEducationMediaFile,
  educationMediaFileUrl
} from "../../api/educationMediaApi";
import LimitedAddBar from "../Common/LimitedAddBar";
import { MAX_ITEMS } from "../../limits";

// Media & Files panel of the Education Details accordion.
// Owns its own data, modal and delete confirmation.
export default function EducationMediaSection({
  educationId,
  eventKey = "media"
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getEducationMedia(educationId)
      .then(({ data }) => {
        if (active) setRecords(data.media || []);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load education media"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [educationId]);

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setShowModal(true);
  };

  const store = (media) =>
    setRecords((previous) =>
      previous.some((item) => item._id === media._id)
        ? previous.map((item) => (item._id === media._id ? media : item))
        : [media, ...previous]
    );

  // Saves the item, then uploads or removes its file. The modal switches to
  // editing the saved item, so retrying a failed upload doesn't duplicate it.
  const saveRecord = async (payload, { file, removeFile }) => {
    const { data } = editing
      ? await updateEducationMedia(educationId, editing._id, payload)
      : await createEducationMedia(educationId, payload);

    let saved = data.media;
    store(saved);
    setEditing(saved);

    if (file) {
      const response = await uploadEducationMediaFile(
        educationId,
        saved._id,
        file
      );
      saved = response.data.media;
    } else if (removeFile && saved.file) {
      const response = await deleteEducationMediaFile(
        educationId,
        saved._id
      );
      saved = response.data.media;
    }

    store(saved);
    setError("");
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteEducationMedia(educationId, deleting._id);

      setRecords((previous) =>
        previous.filter((item) => item._id !== deleting._id)
      );

      setDeleting(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete media"
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header>
        <span className="fw-semibold">Media & Files</span>
        <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
          {loading ? "…" : records.length}
        </span>
      </Accordion.Header>

      <Accordion.Body>
        <LimitedAddBar
          count={records.length}
          max={MAX_ITEMS.media}
          noun="media items"
          label="Add Media"
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
        ) : records.length === 0 ? (
          <p className="text-secondary mb-0">
            No media added yet.
          </p>
        ) : (
          <div
            className="d-grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))"
            }}
          >
            {records.map((record) => (
              <div key={record._id} className="d-flex">
                <div className="border rounded-3 p-3 w-100 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <span className="badge rounded-pill text-bg-light border fw-normal">
                      {record.mediaType}
                    </span>

                    <div className="btn-group btn-group-sm flex-shrink-0">
                      <Button
                        variant="outline-secondary"
                        title="Edit"
                        onClick={() => openEdit(record)}
                      >
                        <i className="bi bi-pencil" />
                      </Button>

                      <Button
                        variant="outline-danger"
                        title="Delete"
                        onClick={() => setDeleting(record)}
                      >
                        <i className="bi bi-trash" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 text-break">
                    {record.url ? (
                      <a
                        href={record.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="fw-semibold text-decoration-none"
                      >
                        {record.title}
                        <i className="bi bi-box-arrow-up-right ms-2 small" />
                      </a>
                    ) : (
                      <span className="fw-semibold">{record.title}</span>
                    )}
                  </div>

                  {record.file && (
                    <FileChip
                      href={educationMediaFileUrl(educationId, record)}
                      file={record.file}
                      className="mt-3"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <EducationMediaModal
          show={showModal}
          media={editing}
          onHide={() => setShowModal(false)}
          onSave={saveRecord}
        />

        <Modal
          show={!!deleting}
          onHide={() => {
            if (!deletingBusy) setDeleting(null);
          }}
          centered
          backdrop={deletingBusy ? "static" : true}
          keyboard={!deletingBusy}
        >
          <Modal.Header closeButton={!deletingBusy}>
            <Modal.Title>Delete Media?</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            Delete <strong>{deleting?.title}</strong>?
            {deleting?.file && " Its attached file will also be deleted."}
            {" "}This action cannot be undone.
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="outline-secondary"
              disabled={deletingBusy}
              onClick={() => setDeleting(null)}
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
