import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Modal, Alert, Spinner } from "react-bootstrap";
import ExperienceModal from "./ExperienceModal";

import {
  getExperiences,
  createExperience,
  updateExperience,
  deleteExperience
} from "../../api/experienceApi";
import { formatMonthYear } from "../Projects/projectOptions";
import VisibilityToggles from "../Common/VisibilityToggles";

// Months count as 0 when missing, so "2024" sorts before "2024-03"
const toMonths = (year, month) => (year || 0) * 12 + (month || 0);

// Current jobs first, then latest end date, then latest start date
function newestFirst(a, b) {
  if (a.currentlyWorking !== b.currentlyWorking) {
    return a.currentlyWorking ? -1 : 1;
  }

  return (
    toMonths(b.endYear, b.endMonth) - toMonths(a.endYear, a.endMonth) ||
    toMonths(b.startYear, b.startMonth) - toMonths(a.startYear, a.startMonth)
  );
}

// "Jan 2021", or just the year when there's no month
const formatDate = (month, year) => formatMonthYear(month, year);

export default function Experience() {
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    let active = true;

    getExperiences()
      .then(({ data }) => {
        if (active) setExperiences(data.experiences || []);
      })
      .catch(() => {
        if (active) setError("Unable to load experiences.");
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

  const openEdit = (experience) => {
    setEditing(experience);
    setShowModal(true);
  };

  const saveExperience = async (payload) => {
    const { data } = editing
      ? await updateExperience(editing._id, payload)
      : await createExperience(payload);

    setExperiences((previous) => {
      if (editing) {
        return previous.map((item) =>
          item._id === data.experience._id ? data.experience : item
        );
      }

      return [data.experience, ...previous];
    });

    setError("");
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteExperience(deleting._id);

      setExperiences((previous) =>
        previous.filter((item) => item._id !== deleting._id)
      );

      setDeleting(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to delete experience."
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="fw-bold mb-1">Experience</h1>
          <p className="text-secondary mb-0">
            Manage your professional experience.
          </p>
        </div>

        <Button onClick={openAdd}>
          <i className="bi bi-plus-lg me-2" />
          Add Experience
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <Spinner animation="border" />
      ) : experiences.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4 text-center">
            <p className="text-secondary mb-3">
              No experiences added yet.
            </p>
            <Button onClick={openAdd}>Add Your First Experience</Button>
          </div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="ms-2 border-start border-2 border-primary-subtle">
              {[...experiences].sort(newestFirst).map((experience, index) => {
                const isLast = index === experiences.length - 1;
                const byOrder = (x, y) =>
                  x.order - y.order ||
                  new Date(x.createdAt) - new Date(y.createdAt);
                const tasks = [...(experience.tasks || [])].sort(byOrder);
                const skills = [...(experience.skills || [])].sort(byOrder);
                const showAll = !!expanded[experience._id];
                const visibleTasks = showAll ? tasks : tasks.slice(0, 2);
                const hiddenCount = tasks.length - visibleTasks.length;

                return (
                  <div
                    key={experience._id}
                    className={`position-relative ps-4 ${isLast ? "" : "pb-4 mb-2"}`}
                  >
                    <span
                      className="position-absolute rounded-circle bg-primary border border-2 border-white shadow-sm"
                      style={{ left: -8, top: 4, width: 14, height: 14 }}
                    />

                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <div className="small text-secondary">
                          {formatDate(
                            experience.startMonth,
                            experience.startYear
                          )}
                          {" – "}
                          {experience.currentlyWorking ? (
                            <span className="badge rounded-pill text-bg-success fw-normal">
                              Present
                            </span>
                          ) : (
                            formatDate(
                              experience.endMonth,
                              experience.endYear
                            )
                          )}
                        </div>

                        <Link
                          to={`/dashboard/experience/${experience._id}`}
                          className="text-decoration-none text-body"
                        >
                          <h5 className="fw-semibold mt-1 mb-0">
                            {experience.organization}
                          </h5>
                        </Link>

                        <div className="text-secondary">
                          {experience.jobTitle}
                        </div>
                        <VisibilityToggles section="experience" item={experience} className="mt-1" />
                      </div>

                      <div className="btn-group btn-group-sm flex-shrink-0">
                        <Button
                          as={Link}
                          to={`/dashboard/experience/${experience._id}`}
                          variant="outline-secondary"
                          title="Details, tasks & skills"
                        >
                          <i className="bi bi-list-task" />
                        </Button>

                        <Button
                          variant="outline-secondary"
                          title="Edit"
                          onClick={() => openEdit(experience)}
                        >
                          <i className="bi bi-pencil" />
                        </Button>

                        <Button
                          variant="outline-danger"
                          title="Delete"
                          onClick={() => setDeleting(experience)}
                        >
                          <i className="bi bi-trash" />
                        </Button>
                      </div>
                    </div>

                    {experience.summary && (
                      <p
                        className="mt-2 mb-0 small"
                        style={{ whiteSpace: "pre-line" }}
                      >
                        {experience.summary}
                      </p>
                    )}

                    {tasks.length > 0 && (
                      <ul className="mt-2 mb-0 ps-3 small">
                        {visibleTasks.map((task) => (
                          <li
                            key={task._id}
                            className="mb-1"
                            style={{ whiteSpace: "pre-line" }}
                          >
                            {task.description}
                          </li>
                        ))}
                      </ul>
                    )}

                    {(hiddenCount > 0 || (showAll && tasks.length > 2)) && (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 ms-3 small text-decoration-none"
                        onClick={() =>
                          setExpanded((previous) => ({
                            ...previous,
                            [experience._id]: !showAll
                          }))
                        }
                      >
                        {showAll ? "Less info" : "More info"}
                      </button>
                    )}

                    {skills.length > 0 && (
                      <div className="d-flex flex-wrap gap-1 mt-2">
                        {skills.map((skill) => (
                          <span
                            key={skill._id}
                            className="badge rounded-pill bg-primary-subtle text-primary-emphasis border border-primary-subtle fw-medium"
                            title={skill.category || undefined}
                          >
                            {skill.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ExperienceModal
        show={showModal}
        experience={editing}
        onHide={() => setShowModal(false)}
        onSave={saveExperience}
      />

      <Modal
        show={!!deleting}
        onHide={() => !deletingBusy && setDeleting(null)}
        centered
        backdrop={deletingBusy ? "static" : true}
      >
        <Modal.Header closeButton={!deletingBusy}>
          <Modal.Title>Delete Experience?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Are you sure you want to delete{" "}
          <strong>{deleting?.jobTitle}</strong> at{" "}
          <strong>{deleting?.organization}</strong>?
          This action cannot be undone.
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
    </div>
  );
}
