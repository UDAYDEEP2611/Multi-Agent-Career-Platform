import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Modal,
  Spinner
} from "react-bootstrap";

import PatentModal from "./PatentModal";
import { dateLabel } from "./patentOptions";
import { formatCalendarDate } from "../Common/calendarDate";
import ClampedText from "../Common/ClampedText";

import {
  getPatents,
  createPatent,
  updatePatent,
  deletePatent
} from "../../api/patentApi";
import VisibilityToggles from "../Common/VisibilityToggles";

// Newest date first; undated last (same as the server)
const newestFirst = (a, b) =>
  (b.date || "").localeCompare(a.date || "") ||
  new Date(b.createdAt) - new Date(a.createdAt);

export default function Patents() {
  const [patents, setPatents] = useState([]);
  const [max, setMax] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getPatents()
      .then(({ data }) => {
        if (!active) return;
        setPatents(data.patents || []);
        setMax(data.max || 50);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load patents");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const full = patents.length >= max;

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (patent) => {
    setEditing(patent);
    setShowModal(true);
  };

  const save = async (payload) => {
    if (editing) {
      const { data } = await updatePatent(editing._id, payload);
      setPatents((previous) =>
        previous.map((item) => (item._id === data.patent._id ? data.patent : item))
      );
    } else {
      const { data } = await createPatent(payload);
      setPatents((previous) => [...previous, data.patent]);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deletePatent(deleting._id);
      setPatents((previous) => previous.filter((item) => item._id !== deleting._id));
      setDeleting(null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete patent");
    } finally {
      setDeletingBusy(false);
    }
  };

  const sorted = [...patents].sort(newestFirst);

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="fw-bold mb-1">Patents</h1>
          <p className="text-secondary mb-0">
            Patents issued and applications pending.
          </p>
        </div>

        <Button onClick={openAdd} disabled={full} title={full ? `You can add up to ${max}` : undefined}>
          <i className="bi bi-plus-lg me-2" />
          Add Patent
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
      ) : patents.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 px-4">
            <div
              className="rounded-circle bg-warning-subtle text-warning-emphasis d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 72, height: 72 }}
            >
              <i className="bi bi-lightbulb-fill fs-2" />
            </div>

            <h5 className="fw-semibold mb-2">No patents added yet</h5>

            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: 420 }}>
              Add issued patents or pending applications with the number,
              co-inventors and a link.
            </p>

            <Button onClick={openAdd} className="px-4">
              <i className="bi bi-plus-lg me-2" />
              Add Your First Patent
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            {sorted.map((patent, index) => {
              const issued = patent.status === "Issued";
              const date = formatCalendarDate(patent.date);

              return (
                <div key={patent._id} className={`p-4 ${index > 0 ? "border-top" : ""}`}>
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div className="d-flex gap-3" style={{ minWidth: 0 }}>
                      <div
                        className="rounded-3 bg-warning-subtle text-warning-emphasis d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: 52, height: 52 }}
                      >
                        <i className="bi bi-lightbulb-fill fs-4" />
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <h5 className="fw-bold mb-0 text-break">{patent.title}</h5>
                        <VisibilityToggles section="patents" item={patent} className="my-1" />

                        <div className="d-flex align-items-center flex-wrap gap-2">
                          <span className="text-break">{patent.patentNumber}</span>
                          <span
                            className={`badge rounded-pill fw-normal border ${
                              issued
                                ? "bg-success-subtle text-success-emphasis border-success-subtle"
                                : "bg-warning-subtle text-warning-emphasis border-warning-subtle"
                            }`}
                          >
                            {issued ? "Issued" : "Pending"}
                          </span>
                        </div>

                        {date && (
                          <div className="small text-secondary">
                            {dateLabel(patent.status).replace(" date", "")} {date}
                          </div>
                        )}

                        <div className="small text-secondary">
                          <i className="bi bi-people me-1" />
                          {["You", ...patent.coInventors].join(", ")}
                        </div>

                        {patent.url && (
                          <a
                            href={patent.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline-secondary rounded-pill mt-2"
                          >
                            Show patent
                            <i className="bi bi-box-arrow-up-right ms-2" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="d-flex gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => openEdit(patent)}
                        aria-label={`Edit ${patent.title}`}
                        title="Edit"
                      >
                        <i className="bi bi-pencil" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => setDeleting(patent)}
                        aria-label={`Delete ${patent.title}`}
                        title="Delete"
                      >
                        <i className="bi bi-trash" />
                      </Button>
                    </div>
                  </div>

                  {patent.description && (
                    <ClampedText text={patent.description} lines={3} className="mt-2" />
                  )}
                </div>
              );
            })}
          </Card.Body>
        </Card>
      )}

      <PatentModal
        show={showModal}
        patent={editing}
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
          <Modal.Title>Delete Patent?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Delete <strong>{deleting?.title}</strong>? This action cannot be undone.
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" disabled={deletingBusy} onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={deletingBusy} onClick={confirmDelete}>
            {deletingBusy ? "Deleting..." : "Delete Patent"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
