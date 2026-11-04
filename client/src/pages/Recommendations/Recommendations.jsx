import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Modal,
  Nav,
  Spinner
} from "react-bootstrap";

import RecommendationModal from "./RecommendationModal";
import RecommendationCard from "./RecommendationCard";
import { contextLabels, fullName } from "./recommendationOptions";

import {
  getRecommendations,
  createRecommendation,
  updateRecommendation,
  deleteRecommendation
} from "../../api/recommendationApi";
import { getExperiences } from "../../api/experienceApi";
import { getEducations } from "../../api/educationApi";

const FILTER_KEY = "recommendations-filter";

const readFilter = () => {
  try {
    return sessionStorage.getItem(FILTER_KEY) || "all";
  } catch {
    return "all";
  }
};

const months = (item) => (item.year ? item.year * 12 + (item.month || 1) : 0);

// Featured first, then most recent (same as the server)
const newestFirst = (a, b) =>
  Number(b.featured) - Number(a.featured) ||
  months(b) - months(a) ||
  new Date(b.createdAt) - new Date(a.createdAt);

export default function Recommendations() {
  const [items, setItems] = useState([]);
  const [max, setMax] = useState(50);
  const [experiences, setExperiences] = useState([]);
  const [educations, setEducations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(readFilter);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.all([
      getRecommendations(),
      // The "worked together" labels are a nice-to-have; don't fail on them
      getExperiences().catch(() => ({ data: {} })),
      getEducations().catch(() => ({ data: {} }))
    ])
      .then(([recommendations, experienceResponse, educationResponse]) => {
        if (!active) return;
        setItems(recommendations.data.recommendations || []);
        setMax(recommendations.data.max || 50);
        setExperiences(experienceResponse.data.experiences || []);
        setEducations(educationResponse.data.educations || []);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load recommendations");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const chooseFilter = (key) => {
    setFilter(key);
    try {
      sessionStorage.setItem(FILTER_KEY, key);
    } catch {
      // Remembering the tab is optional
    }
  };

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
      const { data } = await updateRecommendation(editing._id, payload);
      setItems((previous) =>
        previous.map((item) => (item._id === data.recommendation._id ? data.recommendation : item))
      );
    } else {
      const { data } = await createRecommendation(payload);
      setItems((previous) => [...previous, data.recommendation]);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteRecommendation(deleting._id);
      setItems((previous) => previous.filter((item) => item._id !== deleting._id));
      setDeleting(null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete");
    } finally {
      setDeletingBusy(false);
    }
  };

  const labels = contextLabels(experiences, educations);
  const counts = {
    all: items.length,
    Recommendation: items.filter((item) => item.kind === "Recommendation").length,
    Reference: items.filter((item) => item.kind === "Reference").length
  };
  const shown = items
    .filter((item) => filter === "all" || item.kind === filter)
    .sort(newestFirst);
  const full = items.length >= max;

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="fw-bold mb-1">Recommendations & References</h1>
          <p className="text-secondary mb-0">
            What people say about your work, and who can vouch for you.
          </p>
        </div>

        <Button onClick={openAdd} disabled={full} title={full ? `You can add up to ${max}` : undefined}>
          <i className="bi bi-plus-lg me-2" />
          Add
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
              className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 72, height: 72 }}
            >
              <i className="bi bi-chat-quote-fill fs-2" />
            </div>

            <h5 className="fw-semibold mb-2">No recommendations added yet</h5>

            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: 440 }}>
              Add recommendations people wrote about you, or references an
              employer can contact, with how they know you.
            </p>

            <Button onClick={openAdd} className="px-4">
              <i className="bi bi-plus-lg me-2" />
              Add Your First Recommendation
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <Nav variant="pills" activeKey={filter} onSelect={chooseFilter}>
              {[
                ["all", "All"],
                ["Recommendation", "Recommendations"],
                ["Reference", "References"]
              ].map(([key, label]) => (
                <Nav.Item key={key}>
                  <Nav.Link eventKey={key} className="py-1">
                    {label}
                    <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
                      {counts[key]}
                    </span>
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>

            <span className={`small ${full ? "text-danger" : "text-secondary"}`}>
              {items.length}/{max} added
            </span>
          </div>

          {shown.length === 0 ? (
            <p className="text-secondary">
              No {filter === "Reference" ? "references" : "recommendations"} yet.
            </p>
          ) : (
            <div className="row row-cols-1 row-cols-xl-2 g-3">
              {shown.map((item) => (
                <div className="col" key={item._id}>
                  <RecommendationCard
                    item={item}
                    contextLabel={item.contextId ? labels[item.contextId] : ""}
                    onEdit={openEdit}
                    onDelete={setDeleting}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <RecommendationModal
        show={showModal}
        recommendation={editing}
        experiences={experiences}
        educations={educations}
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
          <Modal.Title>Delete {deleting?.kind}?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Delete the {deleting?.kind.toLowerCase()} from{" "}
          <strong>{deleting && fullName(deleting)}</strong>? This action cannot be undone.
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
