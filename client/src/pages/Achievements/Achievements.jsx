import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Modal,
  Spinner
} from "react-bootstrap";

import AchievementModal from "./AchievementModal";
import AchievementHeader from "./AchievementHeader";
import useContextLabels from "./useContextLabels";
import { CATEGORIES } from "./achievementOptions";
import ClampedText from "../Common/ClampedText";

import {
  getAchievements,
  createAchievement,
  updateAchievement,
  deleteAchievement
} from "../../api/achievementApi";
import VisibilityToggles from "../Common/VisibilityToggles";

const FILTER_KEY = "achievements-filter";

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

export default function Achievements() {
  const navigate = useNavigate();
  const { experiences, educations, labels } = useContextLabels();

  const [items, setItems] = useState([]);
  const [max, setMax] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(readFilter);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getAchievements()
      .then(({ data }) => {
        if (!active) return;
        setItems(data.achievements || []);
        setMax(data.max || 100);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load achievements");
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
      // Remembering the filter is optional
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
      const { data } = await updateAchievement(editing._id, payload);
      setItems((previous) =>
        previous.map((item) => (item._id === data.achievement._id ? data.achievement : item))
      );
      return;
    }

    // New items open their page so media can be added
    const { data } = await createAchievement(payload);
    navigate(`/dashboard/achievements/${data.achievement._id}`);
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteAchievement(deleting._id);
      setItems((previous) => previous.filter((item) => item._id !== deleting._id));
      setDeleting(null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete achievement");
    } finally {
      setDeletingBusy(false);
    }
  };

  // Only categories in use get a filter pill
  const usedCategories = CATEGORIES.filter((category) =>
    items.some((item) => item.category === category)
  );
  const activeFilter = filter === "all" || usedCategories.includes(filter) ? filter : "all";
  const shown = items
    .filter((item) => activeFilter === "all" || item.category === activeFilter)
    .sort(newestFirst);
  const full = items.length >= max;

  const pill = (key, label, count) => (
    <button
      key={key}
      type="button"
      className={`btn btn-sm rounded-pill ${activeFilter === key ? "btn-primary" : "btn-outline-secondary"}`}
      onClick={() => chooseFilter(key)}
    >
      {label}
      <span className="ms-1 opacity-75">{count}</span>
    </button>
  );

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="fw-bold mb-1">Activity & Achievements</h1>
          <p className="text-secondary mb-0">
            Awards, honors, hackathons, talks and other things you're proud of.
          </p>
        </div>

        <Button onClick={openAdd} disabled={full} title={full ? `You can add up to ${max}` : undefined}>
          <i className="bi bi-plus-lg me-2" />
          Add Achievement
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
              className="rounded-circle bg-warning-subtle text-warning-emphasis d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 72, height: 72 }}
            >
              <i className="bi bi-trophy-fill fs-2" />
            </div>

            <h5 className="fw-semibold mb-2">No activities or achievements yet</h5>

            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: 440 }}>
              Add awards, honors, scholarships, hackathons, talks, leadership
              roles and more.
            </p>

            <Button onClick={openAdd} className="px-4">
              <i className="bi bi-plus-lg me-2" />
              Add Your First Achievement
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div className="d-flex flex-wrap gap-2">
              {pill("all", "All", items.length)}
              {usedCategories.map((category) =>
                pill(category, category, items.filter((item) => item.category === category).length)
              )}
            </div>

            <span className={`small ${full ? "text-danger" : "text-secondary"}`}>
              {items.length}/{max} added
            </span>
          </div>

          <Card className="border-0 shadow-sm">
            <Card.Body className="p-0">
              {shown.map((item, index) => (
                <div key={item._id} className={`p-4 ${index > 0 ? "border-top" : ""}`}>
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <AchievementHeader
                      item={item}
                      contextLabel={item.contextId ? labels[item.contextId] : ""}
                    >
                      <Link
                        to={`/dashboard/achievements/${item._id}`}
                        className="text-reset text-decoration-none"
                      >
                        {item.title}
                      </Link>
                    </AchievementHeader>

                    <div className="d-flex flex-wrap justify-content-end align-items-center gap-1 flex-shrink-0">

                      <VisibilityToggles section="achievements" item={item} />
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => openEdit(item)}
                        aria-label={`Edit ${item.title}`}
                        title="Edit"
                      >
                        <i className="bi bi-pencil" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => setDeleting(item)}
                        aria-label={`Delete ${item.title}`}
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
                        to={`/dashboard/achievements/${item._id}`}
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
        </>
      )}

      <AchievementModal
        show={showModal}
        achievement={editing}
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
          <Modal.Title>Delete Achievement?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Delete <strong>{deleting?.title}</strong> and its media? This action
          cannot be undone.
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
