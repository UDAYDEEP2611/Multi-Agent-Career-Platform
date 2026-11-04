import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Modal,
  Spinner
} from "react-bootstrap";

import PublicationModal from "./PublicationModal";
import { formatCalendarDate } from "../Common/calendarDate";
import ClampedText from "../Common/ClampedText";

import {
  getPublications,
  createPublication,
  updatePublication,
  deletePublication
} from "../../api/publicationApi";
import VisibilityToggles from "../Common/VisibilityToggles";

// Newest publication date first; undated last (same as the server)
const newestFirst = (a, b) =>
  (b.publishedOn || "").localeCompare(a.publishedOn || "") ||
  new Date(b.createdAt) - new Date(a.createdAt);

export default function Publications() {
  const [publications, setPublications] = useState([]);
  const [max, setMax] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getPublications()
      .then(({ data }) => {
        if (!active) return;
        setPublications(data.publications || []);
        setMax(data.max || 50);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load publications");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const full = publications.length >= max;

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (publication) => {
    setEditing(publication);
    setShowModal(true);
  };

  const save = async (payload) => {
    if (editing) {
      const { data } = await updatePublication(editing._id, payload);
      setPublications((previous) =>
        previous.map((item) => (item._id === data.publication._id ? data.publication : item))
      );
    } else {
      const { data } = await createPublication(payload);
      setPublications((previous) => [...previous, data.publication]);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deletePublication(deleting._id);
      setPublications((previous) => previous.filter((item) => item._id !== deleting._id));
      setDeleting(null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete publication");
    } finally {
      setDeletingBusy(false);
    }
  };

  const sorted = [...publications].sort(newestFirst);

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="fw-bold mb-1">Publications</h1>
          <p className="text-secondary mb-0">
            Papers, articles, books and posts you've written.
          </p>
        </div>

        <Button onClick={openAdd} disabled={full} title={full ? `You can add up to ${max}` : undefined}>
          <i className="bi bi-plus-lg me-2" />
          Add Publication
        </Button>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : publications.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 px-4">
            <div
              className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 72, height: 72 }}
            >
              <i className="bi bi-journal-text fs-2" />
            </div>

            <h5 className="fw-semibold mb-2">No publications added yet</h5>

            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: 420 }}>
              Add papers, articles, books or posts with the publisher, date,
              co-authors and a link.
            </p>

            <Button onClick={openAdd} className="px-4">
              <i className="bi bi-plus-lg me-2" />
              Add Your First Publication
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            {sorted.map((publication, index) => {
              const meta = [publication.publisher, formatCalendarDate(publication.publishedOn)]
                .filter(Boolean)
                .join(" · ");

              return (
                <div key={publication._id} className={`p-4 ${index > 0 ? "border-top" : ""}`}>
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div className="d-flex gap-3" style={{ minWidth: 0 }}>
                      <div
                        className="rounded-3 bg-primary-subtle text-primary d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: 52, height: 52 }}
                      >
                        <i className="bi bi-journal-text fs-4" />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <h5 className="fw-bold mb-0 text-break">{publication.title}</h5>
                        <VisibilityToggles section="publications" item={publication} className="my-1" />
                        {meta && <div>{meta}</div>}
                        <div className="small text-secondary">
                          <i className="bi bi-people me-1" />
                          {["You", ...publication.coAuthors].join(", ")}
                        </div>

                        {publication.url && (
                          <a
                            href={publication.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline-secondary rounded-pill mt-2"
                          >
                            Show publication
                            <i className="bi bi-box-arrow-up-right ms-2" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="d-flex gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => openEdit(publication)}
                        aria-label={`Edit ${publication.title}`}
                        title="Edit"
                      >
                        <i className="bi bi-pencil" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => setDeleting(publication)}
                        aria-label={`Delete ${publication.title}`}
                        title="Delete"
                      >
                        <i className="bi bi-trash" />
                      </Button>
                    </div>
                  </div>

                  {publication.description && (
                    <ClampedText
                      text={publication.description}
                      lines={3}
                      className="mt-2"
                    />
                  )}
                </div>
              );
            })}
          </Card.Body>
        </Card>
      )}

      <PublicationModal
        show={showModal}
        publication={editing}
        onHide={() => setShowModal(false)}
        onSave={save}
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
          <Modal.Title>Delete Publication?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Delete <strong>{deleting?.title}</strong>? This action cannot be undone.
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" disabled={deletingBusy} onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={deletingBusy} onClick={confirmDelete}>
            {deletingBusy ? "Deleting..." : "Delete Publication"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
