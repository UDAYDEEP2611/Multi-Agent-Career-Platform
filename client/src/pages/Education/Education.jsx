import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  Alert,
  Spinner,
  Modal
} from "react-bootstrap";

import EducationModal from "./EducationModal";

import {
  getEducations,
  createEducation,
  updateEducation,
  deleteEducation
} from "../../api/educationApi";
import { formatMonthYear } from "../Projects/projectOptions";
import VisibilityToggles from "../Common/VisibilityToggles";

// "Jan 2021", or just the year when there's no month
const formatDate = (month, year) => formatMonthYear(month, year);

// Months count as 0 when missing, so "2024" sorts before "2024-03"
const toMonths = (year, month) => (year || 0) * 12 + (month || 0);

// Current studies first, then latest end date, then latest start date
function newestFirst(a, b) {
  if (a.currentlyStudying !== b.currentlyStudying) {
    return a.currentlyStudying ? -1 : 1;
  }

  return (
    toMonths(b.endYear, b.endMonth) - toMonths(a.endYear, a.endMonth) ||
    toMonths(b.startYear, b.startMonth) - toMonths(a.startYear, a.startMonth)
  );
}

export default function Education() {
  const [educations, setEducations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEducation, setEditingEducation] = useState(null);

  const [deletingEducation, setDeletingEducation] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    let active = true;

    getEducations()
      .then(({ data }) => {
        if (active) {
          setEducations(data.educations || []);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load education"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const openAdd = () => {
    setEditingEducation(null);
    setShowModal(true);
  };

  const openEdit = (education) => {
    setEditingEducation(education);
    setShowModal(true);
  };

  const saveEducation = async (payload) => {
    const { data } = editingEducation
      ? await updateEducation(
          editingEducation._id,
          payload
        )
      : await createEducation(payload);

    setEducations((previous) =>
      editingEducation
        ? previous.map((item) =>
            item._id === data.education._id
              ? data.education
              : item
          )
        : [data.education, ...previous]
    );

    setError("");
  };

  const confirmDelete = async () => {
    if (!deletingEducation) return;

    setDeletingBusy(true);

    try {
      await deleteEducation(deletingEducation._id);

      setEducations((previous) =>
        previous.filter(
          (item) => item._id !== deletingEducation._id
        )
      );

      setDeletingEducation(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete education"
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  const sorted = [...educations].sort(newestFirst);

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="fw-bold mb-1">Education</h1>
          <p className="text-secondary mb-0">
            Manage your academic background and projects.
          </p>
        </div>

        <Button onClick={openAdd}>
          <i className="bi bi-plus-lg me-2" />
          Add Education
        </Button>
      </div>

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
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : educations.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 px-4">
            <div
              className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 72, height: 72 }}
            >
              <i className="bi bi-mortarboard-fill fs-2" />
            </div>

            <h5 className="fw-semibold mb-2">No education added yet</h5>

            <p
              className="text-secondary mx-auto mb-4"
              style={{ maxWidth: 420 }}
            >
              Add your schools, degrees and courses. You can then attach
              coursework, certifications, activities and projects to each one.
            </p>

            <Button onClick={openAdd} className="px-4">
              <i className="bi bi-plus-lg me-2" />
              Add Your First Education
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-4">
            <div className="ms-2 border-start border-2 border-primary-subtle">
              {sorted.map((education, index) => {
                const isLast = index === sorted.length - 1;
                const start = formatDate(education.startMonth, education.startYear);
                const end = education.currentlyStudying
                  ? null
                  : formatDate(education.endMonth, education.endYear);
                const byOrder = (x, y) =>
                  x.order - y.order ||
                  new Date(x.createdAt) - new Date(y.createdAt);
                const tasks = [...(education.tasks || [])].sort(byOrder);
                const skills = [...(education.skills || [])].sort(byOrder);
                const showAll = !!expanded[education._id];
                const visibleTasks = showAll ? tasks : tasks.slice(0, 2);
                const hiddenCount = tasks.length - visibleTasks.length;

                return (
                  <div
                    key={education._id}
                    className={`position-relative ps-4 ${isLast ? "" : "pb-4 mb-2"}`}
                  >
                    <span
                      className="position-absolute rounded-circle bg-primary border border-2 border-white shadow-sm"
                      style={{ left: -8, top: 4, width: 14, height: 14 }}
                    />

                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        {(start || end || education.currentlyStudying) && (
                          <div className="small text-secondary">
                            {start || "—"}
                            {" – "}
                            {education.currentlyStudying ? (
                              <span className="badge rounded-pill text-bg-success fw-normal">
                                Present
                              </span>
                            ) : (
                              end || "—"
                            )}
                          </div>
                        )}

                        <Link
                          to={`/dashboard/education/${education._id}`}
                          className="text-decoration-none text-body"
                        >
                          <h5 className="fw-semibold mt-1 mb-0">
                            {education.institution}
                          </h5>
                        </Link>

                        <div className="text-secondary">
                          {education.degree}
                          {education.fieldOfStudy &&
                            ` · ${education.fieldOfStudy}`}
                        </div>
                        <VisibilityToggles section="education" item={education} className="mt-1" />

                        {education.grade && (
                          <div className="small mt-1">
                            GPA / Grade: {education.grade}
                          </div>
                        )}
                      </div>

                      <div className="btn-group btn-group-sm flex-shrink-0">
                        <Button
                          as={Link}
                          to={`/dashboard/education/${education._id}`}
                          variant="outline-secondary"
                          title="Details"
                        >
                          <i className="bi bi-list-task" />
                        </Button>

                        <Button
                          variant="outline-secondary"
                          title="Edit"
                          onClick={() => openEdit(education)}
                        >
                          <i className="bi bi-pencil" />
                        </Button>

                        <Button
                          variant="outline-danger"
                          title="Delete"
                          onClick={() => setDeletingEducation(education)}
                        >
                          <i className="bi bi-trash" />
                        </Button>
                      </div>
                    </div>

                    {education.description && (
                      <p
                        className="mt-2 mb-0 small"
                        style={{ whiteSpace: "pre-line" }}
                      >
                        {education.description}
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
                            [education._id]: !showAll
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
          </Card.Body>
        </Card>
      )}

      <EducationModal
        show={showModal}
        education={editingEducation}
        onHide={() => setShowModal(false)}
        onSave={saveEducation}
      />

      <Modal
        show={!!deletingEducation}
        onHide={() => {
          if (!deletingBusy) setDeletingEducation(null);
        }}
        centered
        backdrop={deletingBusy ? "static" : true}
        keyboard={!deletingBusy}
      >
        <Modal.Header closeButton={!deletingBusy}>
          <Modal.Title>Delete Education?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Delete{" "}
          <strong>{deletingEducation?.institution}</strong>?
          This action cannot be undone.
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={deletingBusy}
            onClick={() => setDeletingEducation(null)}
          >
            Cancel
          </Button>

          <Button
            variant="danger"
            disabled={deletingBusy}
            onClick={confirmDelete}
          >
            {deletingBusy ? "Deleting..." : "Delete Education"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
