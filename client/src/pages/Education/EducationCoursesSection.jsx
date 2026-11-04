import { useEffect, useState } from "react";
import {
  Accordion,
  Alert,
  Button,
  Modal,
  Spinner
} from "react-bootstrap";

import EducationCourseModal from "./EducationCourseModal";

import {
  getEducationCourses,
  createEducationCourse,
  updateEducationCourse,
  deleteEducationCourse
} from "../../api/educationCourseApi";

// Relevant Coursework panel of the Education Details accordion.
// Owns its own data, modal and delete confirmation.
export default function EducationCoursesSection({
  educationId,
  eventKey = "courses"
}) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getEducationCourses(educationId)
      .then(({ data }) => {
        if (active) setCourses(data.courses || []);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load courses"
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

  const sortedCourses = [...courses].sort(
    (a, b) =>
      a.order - b.order ||
      new Date(a.createdAt) - new Date(b.createdAt)
  );

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (course) => {
    setEditing(course);
    setShowModal(true);
  };

  const saveCourse = async (payload) => {
    const { data } = editing
      ? await updateEducationCourse(educationId, editing._id, payload)
      : await createEducationCourse(educationId, payload);

    setCourses((previous) =>
      editing
        ? previous.map((item) =>
            item._id === data.course._id ? data.course : item
          )
        : [...previous, data.course]
    );

    setError("");
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteEducationCourse(educationId, deleting._id);

      setCourses((previous) =>
        previous.filter((item) => item._id !== deleting._id)
      );

      setDeleting(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete course"
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header>
        <span className="fw-semibold">Relevant Coursework</span>
        <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
          {loading ? "…" : courses.length}
        </span>
      </Accordion.Header>

      <Accordion.Body>
        <div className="d-flex justify-content-end mb-3">
          <Button size="sm" onClick={openAdd}>
            <i className="bi bi-plus-lg me-1" />
            Add Course
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
          <div className="text-center py-3">
            <Spinner animation="border" size="sm" />
          </div>
        ) : sortedCourses.length === 0 ? (
          <p className="text-secondary mb-0">
            No courses added yet.
          </p>
        ) : (
          <div className="d-flex flex-column">
            {sortedCourses.map((course) => (
              <div
                key={course._id}
                className="d-flex justify-content-between align-items-center gap-3 border-bottom py-2"
              >
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  {course.code && (
                    <span className="badge text-bg-light border font-monospace fw-normal">
                      {course.code}
                    </span>
                  )}
                  <span>{course.name}</span>
                </div>

                <div className="btn-group btn-group-sm flex-shrink-0">
                  <Button
                    variant="outline-secondary"
                    title="Edit"
                    onClick={() => openEdit(course)}
                  >
                    <i className="bi bi-pencil" />
                  </Button>

                  <Button
                    variant="outline-danger"
                    title="Delete"
                    onClick={() => setDeleting(course)}
                  >
                    <i className="bi bi-trash" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <EducationCourseModal
          show={showModal}
          course={editing}
          onHide={() => setShowModal(false)}
          onSave={saveCourse}
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
            <Modal.Title>Delete Course?</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            Delete{" "}
            <strong>
              {deleting?.code ? `${deleting.code} — ` : ""}
              {deleting?.name}
            </strong>?
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
              {deletingBusy ? "Deleting..." : "Delete Course"}
            </Button>
          </Modal.Footer>
        </Modal>
      </Accordion.Body>
    </Accordion.Item>
  );
}
