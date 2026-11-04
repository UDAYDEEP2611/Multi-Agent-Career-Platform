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
  getEducationTasks,
  createEducationTask,
  updateEducationTask,
  deleteEducationTask
} from "../../api/educationTaskApi";
import LimitedAddBar from "../Common/LimitedAddBar";
import { MAX_ITEMS } from "../../limits";

// Tasks & Responsibilities panel of the Education Details accordion.
// Owns its own data, modal and delete confirmation.
export default function EducationTasksSection({
  educationId,
  eventKey = "tasks"
}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [deletingTask, setDeletingTask] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getEducationTasks(educationId)
      .then(({ data }) => {
        if (active) {
          setTasks(data.tasks || []);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load tasks"
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

  const sortedTasks = [...tasks].sort(
    (a, b) =>
      a.order - b.order ||
      new Date(a.createdAt) - new Date(b.createdAt)
  );

  const openAdd = () => {
    setEditingTask(null);
    setShowModal(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const saveTask = async (payload) => {
    const { data } = editingTask
      ? await updateEducationTask(
          educationId,
          editingTask._id,
          payload
        )
      : await createEducationTask(
          educationId,
          payload
        );

    setTasks((previous) =>
      editingTask
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
    if (!deletingTask) return;

    setDeletingBusy(true);

    try {
      await deleteEducationTask(
        educationId,
        deletingTask._id
      );

      setTasks((previous) =>
        previous.filter(
          (item) => item._id !== deletingTask._id
        )
      );

      setDeletingTask(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete task"
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
        <LimitedAddBar
          count={tasks.length}
          max={MAX_ITEMS.tasks}
          noun="tasks"
          label="Add Task"
          onAdd={openAdd}
        />

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
            No tasks added yet.
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
                    onClick={() => setDeletingTask(task)}
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
          task={editingTask}
          onHide={() => setShowModal(false)}
          onSave={saveTask}
        />

        <Modal
          show={!!deletingTask}
          onHide={() => {
            if (!deletingBusy) setDeletingTask(null);
          }}
          centered
          backdrop={deletingBusy ? "static" : true}
          keyboard={!deletingBusy}
        >
          <Modal.Header closeButton={!deletingBusy}>
            <Modal.Title>Delete Task?</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            This task will be permanently deleted.
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="outline-secondary"
              disabled={deletingBusy}
              onClick={() => setDeletingTask(null)}
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
