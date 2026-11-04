import { useEffect, useState } from "react";
import {
  Accordion,
  Alert,
  Button,
  Modal,
  Spinner
} from "react-bootstrap";

import EducationTaskModal from "./EducationTaskModal";

import {
  getEducationProjectTasks,
  createEducationProjectTask,
  updateEducationProjectTask,
  deleteEducationProjectTask
} from "../../api/educationProjectTaskApi";

// Tasks & Responsibilities panel of the Education Project Details accordion.
// Owns its own data, modal and delete confirmation.
export default function EducationProjectTasksSection({
  educationId,
  projectId,
  eventKey = "tasks"
}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getEducationProjectTasks(educationId, projectId)
      .then(({ data }) => {
        if (active) setTasks(data.tasks || []);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load project tasks"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [educationId, projectId]);

  const sortedTasks = [...tasks].sort(
    (a, b) =>
      a.order - b.order ||
      new Date(a.createdAt) - new Date(b.createdAt)
  );

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (task) => {
    setEditing(task);
    setShowModal(true);
  };

  const saveTask = async (payload) => {
    const { data } = editing
      ? await updateEducationProjectTask(
          educationId,
          projectId,
          editing._id,
          payload
        )
      : await createEducationProjectTask(
          educationId,
          projectId,
          payload
        );

    setTasks((previous) =>
      editing
        ? previous.map((item) =>
            item._id === data.task._id
              ? data.task
              : item
          )
        : [...previous, data.task]
    );

    setError("");
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteEducationProjectTask(
        educationId,
        projectId,
        deleting._id
      );

      setTasks((previous) =>
        previous.filter(
          (item) => item._id !== deleting._id
        )
      );

      setDeleting(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete project task"
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header>
        <span className="fw-semibold">Tasks & Responsibilities</span>
        <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
          {loading ? "…" : tasks.length}
        </span>
      </Accordion.Header>

      <Accordion.Body>
        <div className="d-flex justify-content-end mb-3">
          <Button size="sm" onClick={openAdd}>
            <i className="bi bi-plus-lg me-1" />
            Add Task
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
        ) : sortedTasks.length === 0 ? (
          <p className="text-secondary mb-0">
            No project tasks added yet.
          </p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {sortedTasks.map((task) => (
              <div
                key={task._id}
                className="d-flex justify-content-between gap-3 border-bottom pb-3"
              >
                <div
                  style={{
                    whiteSpace: "pre-line",
                    overflowWrap: "anywhere"
                  }}
                >
                  • {task.description}
                </div>

                <div className="btn-group btn-group-sm flex-shrink-0 align-self-start">
                  <Button
                    variant="outline-secondary"
                    title="Edit"
                    onClick={() => openEdit(task)}
                  >
                    <i className="bi bi-pencil" />
                  </Button>

                  <Button
                    variant="outline-danger"
                    title="Delete"
                    onClick={() => setDeleting(task)}
                  >
                    <i className="bi bi-trash" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <EducationTaskModal
          show={showModal}
          task={editing}
          onHide={() => setShowModal(false)}
          onSave={saveTask}
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
            <Modal.Title>Delete Project Task?</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            Are you sure you want to delete this project task?
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
              {deletingBusy ? "Deleting..." : "Delete Task"}
            </Button>
          </Modal.Footer>
        </Modal>
      </Accordion.Body>
    </Accordion.Item>
  );
}
