import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Modal,
  Spinner
} from "react-bootstrap";

import VolunteeringModal from "./VolunteeringModal";
import VolunteeringHeader from "./VolunteeringHeader";
import ClampedText from "../Common/ClampedText";

import {
  getVolunteering,
  createVolunteering,
  updateVolunteering,
  deleteVolunteering
} from "../../api/volunteeringApi";
import VisibilityToggles from "../Common/VisibilityToggles";

const months = (year, month, fallback) => (year ? year * 12 + (month || fallback) : 0);

// Current roles first, then most recently ended, then newest start
const newestFirst = (a, b) =>
  (b.currentlyVolunteering ? Infinity : months(b.endYear, b.endMonth, 12)) -
    (a.currentlyVolunteering ? Infinity : months(a.endYear, a.endMonth, 12)) ||
  months(b.startYear, b.startMonth, 1) - months(a.startYear, a.startMonth, 1) ||
  new Date(b.createdAt) - new Date(a.createdAt);

export default function Volunteering() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getVolunteering()
      .then(({ data }) => {
        if (active) setItems(data.volunteering || []);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load volunteering");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setShowModal(true);
  };

  const save = async (payload) => {
    if (editing) {
      const { data } = await updateVolunteering(editing._id, payload);
      setItems((previous) =>
        previous.map((item) => (item._id === data.volunteering._id ? data.volunteering : item))
      );
      return;
    }

    // New roles open their page so media can be added
    const { data } = await createVolunteering(payload);
    navigate(`/dashboard/volunteering/${data.volunteering._id}`);
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteVolunteering(deleting._id);
      setItems((previous) => previous.filter((item) => item._id !== deleting._id));
      setDeleting(null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete volunteering");
    } finally {
      setDeletingBusy(false);
    }
  };

  const sorted = [...items].sort(newestFirst);

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="fw-bold mb-1">Volunteering</h1>
          <p className="text-secondary mb-0">
            Causes you support and the roles you've taken on.
          </p>
        </div>

        <Button onClick={openAdd}>
          <i className="bi bi-plus-lg me-2" />
          Add Volunteering
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
      ) : items.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 px-4">
            <div
              className="rounded-circle bg-danger-subtle text-danger d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 72, height: 72 }}
            >
              <i className="bi bi-heart-fill fs-2" />
            </div>

            <h5 className="fw-semibold mb-2">No volunteering added yet</h5>

            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: 420 }}>
              Add volunteer roles with the organization, cause, dates and
              what you did.
            </p>

            <Button onClick={openAdd} className="px-4">
              <i className="bi bi-plus-lg me-2" />
              Add Your First Volunteer Role
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            {sorted.map((item, index) => (
              <div key={item._id} className={`p-4 ${index > 0 ? "border-top" : ""}`}>
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <VolunteeringHeader item={item}>
                    <Link
                      to={`/dashboard/volunteering/${item._id}`}
                      className="text-reset text-decoration-none"
                    >
                      {item.role}
                    </Link>
                  </VolunteeringHeader>

                  <div className="d-flex flex-wrap justify-content-end align-items-center gap-1 flex-shrink-0">

                    <VisibilityToggles section="volunteering" item={item} />
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => openEdit(item)}
                      aria-label={`Edit ${item.role}`}
                      title="Edit"
                    >
                      <i className="bi bi-pencil" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => setDeleting(item)}
                      aria-label={`Delete ${item.role}`}
                      title="Delete"
                    >
                      <i className="bi bi-trash" />
                    </Button>
                  </div>
                </div>

                <div style={{ marginLeft: 68 }}>
                  {item.description && (
                    <ClampedText text={item.description} lines={3} className="mt-2" />
                  )}

                  <div className="d-flex align-items-center gap-2 mt-2">
                    {item.media.length > 0 && (
                      <span className="small text-secondary">
                        <i className="bi bi-paperclip me-1" />
                        {item.media.length} media
                      </span>
                    )}

                    <Link
                      to={`/dashboard/volunteering/${item._id}`}
                      className="small ms-auto text-decoration-none"
                    >
                      Details <i className="bi bi-arrow-right" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </Card.Body>
        </Card>
      )}

      <VolunteeringModal
        show={showModal}
        volunteering={editing}
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
          <Modal.Title>Delete Volunteering?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Delete <strong>{deleting?.role}</strong> at {deleting?.organization} and
          its media? This action cannot be undone.
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" disabled={deletingBusy} onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={deletingBusy} onClick={confirmDelete}>
            {deletingBusy ? "Deleting..." : "Delete Volunteering"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
