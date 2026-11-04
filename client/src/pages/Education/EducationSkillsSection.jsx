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
  getEducationSkills,
  createEducationSkill,
  updateEducationSkill,
  deleteEducationSkill
} from "../../api/educationSkillApi";
import LimitedAddBar from "../Common/LimitedAddBar";
import { MAX_ITEMS } from "../../limits";

// Skills panel of the Education Details accordion.
// Owns its own data, modal and delete confirmation.
export default function EducationSkillsSection({
  educationId,
  eventKey = "skills"
}) {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);

  const [deletingSkill, setDeletingSkill] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getEducationSkills(educationId)
      .then(({ data }) => {
        if (active) {
          setSkills(data.skills || []);
        }
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
  }, [educationId]);

  const sortedSkills = [...skills].sort(
    (a, b) =>
      a.order - b.order ||
      new Date(a.createdAt) - new Date(b.createdAt)
  );

  const openAdd = () => {
    setEditingSkill(null);
    setShowModal(true);
  };

  const openEdit = (skill) => {
    setEditingSkill(skill);
    setShowModal(true);
  };

  const saveSkill = async (payload) => {
    const { data } = editingSkill
      ? await updateEducationSkill(
          educationId,
          editingSkill._id,
          payload
        )
      : await createEducationSkill(
          educationId,
          payload
        );

    setSkills((previous) =>
      editingSkill
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
    if (!deletingSkill) return;

    setDeletingBusy(true);

    try {
      await deleteEducationSkill(
        educationId,
        deletingSkill._id
      );

      setSkills((previous) =>
        previous.filter(
          (item) => item._id !== deletingSkill._id
        )
      );

      setDeletingSkill(null);
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
        <LimitedAddBar
          count={skills.length}
          max={MAX_ITEMS.skills}
          noun="skills"
          label="Add Skill"
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
        ) : sortedSkills.length === 0 ? (
          <p className="text-secondary mb-0">
            No skills added yet.
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
                  onClick={() => setDeletingSkill(skill)}
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
            ))}
          </div>
        )}

        <EducationSkillModal
          show={showModal}
          skill={editingSkill}
          onHide={() => setShowModal(false)}
          onSave={saveSkill}
        />

        <Modal
          show={!!deletingSkill}
          onHide={() => {
            if (!deletingBusy) setDeletingSkill(null);
          }}
          centered
          backdrop={deletingBusy ? "static" : true}
          keyboard={!deletingBusy}
        >
          <Modal.Header closeButton={!deletingBusy}>
            <Modal.Title>Delete Skill?</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            Delete{" "}
            <strong>{deletingSkill?.name}</strong>?
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="outline-secondary"
              disabled={deletingBusy}
              onClick={() => setDeletingSkill(null)}
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
