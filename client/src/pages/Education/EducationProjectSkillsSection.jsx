import { useEffect, useState } from "react";
import {
  Accordion,
  Alert,
  Button,
  Modal,
  Spinner
} from "react-bootstrap";

import EducationSkillModal from "./EducationSkillModal";

import {
  getEducationProjectSkills,
  createEducationProjectSkill,
  updateEducationProjectSkill,
  deleteEducationProjectSkill
} from "../../api/educationProjectSkillApi";

// Skills panel of the Education Project Details accordion.
// Owns its own data, modal and delete confirmation.
export default function EducationProjectSkillsSection({
  educationId,
  projectId,
  eventKey = "skills"
}) {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getEducationProjectSkills(educationId, projectId)
      .then(({ data }) => {
        if (active) setSkills(data.skills || []);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load skills"
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

  const sortedSkills = [...skills].sort(
    (a, b) =>
      a.order - b.order ||
      new Date(a.createdAt) - new Date(b.createdAt)
  );

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (skill) => {
    setEditing(skill);
    setShowModal(true);
  };

  const saveSkill = async (payload) => {
    const { data } = editing
      ? await updateEducationProjectSkill(
          educationId,
          projectId,
          editing._id,
          payload
        )
      : await createEducationProjectSkill(
          educationId,
          projectId,
          payload
        );

    setSkills((previous) =>
      editing
        ? previous.map((item) =>
            item._id === data.skill._id
              ? data.skill
              : item
          )
        : [...previous, data.skill]
    );

    setError("");
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteEducationProjectSkill(
        educationId,
        projectId,
        deleting._id
      );

      setSkills((previous) =>
        previous.filter(
          (item) => item._id !== deleting._id
        )
      );

      setDeleting(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete skill"
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header>
        <span className="fw-semibold">Skills</span>
        <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
          {loading ? "…" : skills.length}
        </span>
      </Accordion.Header>

      <Accordion.Body>
        <div className="d-flex justify-content-end mb-3">
          <Button size="sm" onClick={openAdd}>
            <i className="bi bi-plus-lg me-1" />
            Add Skill
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
        ) : sortedSkills.length === 0 ? (
          <p className="text-secondary mb-0">
            No project skills added yet.
          </p>
        ) : (
          <div className="d-flex flex-wrap gap-2">
            {sortedSkills.map((skill) => (
              <div
                key={skill._id}
                className="d-inline-flex align-items-center border border-primary-subtle bg-primary-subtle text-primary-emphasis rounded-pill small ps-2 pe-0"
                title={skill.category || undefined}
              >
                <button
                  type="button"
                  className="btn btn-link p-0 text-reset text-decoration-none fw-medium small lh-sm"
                  onClick={() => openEdit(skill)}
                >
                  {skill.name}
                </button>

                <button
                  type="button"
                  className="btn btn-link text-reset opacity-50 px-1 py-0 border-0 small lh-sm"
                  aria-label={`Delete ${skill.name}`}
                  onClick={() => setDeleting(skill)}
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
            ))}
          </div>
        )}

        <EducationSkillModal
          show={showModal}
          skill={editing}
          onHide={() => setShowModal(false)}
          onSave={saveSkill}
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
            <Modal.Title>Delete Project Skill?</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            Are you sure you want to remove{" "}
            <strong>{deleting?.name}</strong> from this project?
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
              {deletingBusy ? "Deleting..." : "Delete Skill"}
            </Button>
          </Modal.Footer>
        </Modal>
      </Accordion.Body>
    </Accordion.Item>
  );
}
