import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Modal,
  Spinner
} from "react-bootstrap";

import InterestModal from "./InterestModal";
import { CATEGORIES, CATEGORY_ICONS } from "./interestOptions";

import {
  getInterests,
  createInterest,
  updateInterest,
  deleteInterest
} from "../../api/interestApi";

export default function Interests() {
  const [interests, setInterests] = useState([]);
  const [max, setMax] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [addCategory, setAddCategory] = useState("");

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getInterests()
      .then(({ data }) => {
        if (!active) return;
        setInterests(data.interests || []);
        setMax(data.max || 30);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load interests");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const full = interests.length >= max;

  const openAdd = (category = "") => {
    setEditing(null);
    setAddCategory(category);
    setShowModal(true);
  };

  const openEdit = (interest) => {
    setEditing(interest);
    setShowModal(true);
  };

  const save = async (payload) => {
    if (editing) {
      const { data } = await updateInterest(editing._id, payload);
      setInterests((previous) =>
        previous.map((item) => (item._id === data.interest._id ? data.interest : item))
      );
    } else {
      const { data } = await createInterest(payload);
      setInterests((previous) => [...previous, data.interest]);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteInterest(deleting._id);
      setInterests((previous) => previous.filter((item) => item._id !== deleting._id));
      setDeleting(null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete interest");
    } finally {
      setDeletingBusy(false);
    }
  };

  const groups = CATEGORIES
    .map((category) => ({
      category,
      items: interests.filter((item) => item.category === category)
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="fw-bold mb-1">Interests</h1>
          <p className="text-secondary mb-0">
            What you enjoy outside your work and studies.
          </p>
        </div>

        <Button onClick={() => openAdd()} disabled={full}>
          <i className="bi bi-plus-lg me-2" />
          Add Interest
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
      ) : interests.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 px-4">
            <div
              className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 72, height: 72 }}
            >
              <i className="bi bi-heart-fill fs-2" />
            </div>

            <h5 className="fw-semibold mb-2">No interests added yet</h5>

            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: 420 }}>
              Add hobbies and topics you care about. They help show the person
              behind the résumé.
            </p>

            <Button onClick={() => openAdd()} className="px-4">
              <i className="bi bi-plus-lg me-2" />
              Add Your First Interest
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-4">
            <div className={`small mb-3 ${full ? "text-danger" : "text-secondary"}`}>
              <i className={`bi ${full ? "bi-exclamation-circle" : "bi-info-circle"} me-1`} />
              {full
                ? `Limit reached: you can add up to ${max} interests.`
                : `You can add up to ${max} interests. Click one to edit it.`}
              <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
                {interests.length}/{max}
              </span>
            </div>

            {groups.map(({ category, items }, index) => (
              <div key={category} className={index > 0 ? "border-top pt-3 mt-3" : ""}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h6 className="fw-semibold mb-0">
                    <i className={`bi ${CATEGORY_ICONS[category]} text-primary me-2`} />
                    {category}
                  </h6>

                  {!full && (
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-decoration-none p-0"
                      onClick={() => openAdd(category)}
                    >
                      <i className="bi bi-plus-lg me-1" />
                      Add
                    </button>
                  )}
                </div>

                <div className="d-flex flex-wrap gap-2">
                  {items.map((interest) => (
                    <span
                      key={interest._id}
                      className="badge rounded-pill bg-primary-subtle text-primary-emphasis border border-primary-subtle fw-medium d-inline-flex align-items-center gap-1 ps-3 pe-2"
                      style={{ fontSize: "0.85rem", paddingTop: "0.4rem", paddingBottom: "0.4rem" }}
                    >
                      <button
                        type="button"
                        className="btn btn-link p-0 text-reset text-decoration-none fw-medium"
                        style={{ fontSize: "inherit" }}
                        onClick={() => openEdit(interest)}
                        title={interest.description || "Edit"}
                      >
                        {interest.name}
                        {interest.description && (
                          <i className="bi bi-info-circle ms-1 opacity-75" />
                        )}
                      </button>

                      <button
                        type="button"
                        className="btn-close ms-1"
                        style={{ fontSize: "0.55rem" }}
                        onClick={() => setDeleting(interest)}
                        aria-label={`Delete ${interest.name}`}
                        title="Delete"
                      />
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </Card.Body>
        </Card>
      )}

      <InterestModal
        show={showModal}
        interest={editing}
        defaultCategory={addCategory}
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
          <Modal.Title>Delete Interest?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Delete <strong>{deleting?.name}</strong> from your interests?
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
    </div>
  );
}
