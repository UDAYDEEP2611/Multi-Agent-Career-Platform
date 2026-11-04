import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Accordion,
  Alert,
  Button,
  Modal,
  Spinner
} from "react-bootstrap";

import ExperienceProjectModal from "../Experience/ExperienceProjectModal";
import { projectStatusColors } from "../Experience/projectStatus";

import {
  getEducationProjects,
  createEducationProject,
  updateEducationProject,
  deleteEducationProject
} from "../../api/educationProjectApi";
import VisibilityToggles from "../Common/VisibilityToggles";

// Projects panel of the Education Details accordion.
// Owns its own data, modal and delete confirmation.
export default function EducationProjectsSection({
  education,
  eventKey = "projects"
}) {
  const educationId = education._id;
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getEducationProjects(educationId)
      .then(({ data }) => {
        if (active) setProjects(data.projects || []);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load projects"
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

  const projectPath = (project) =>
    `/dashboard/education/${educationId}/projects/${project._id}`;

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (project) => {
    setEditing(project);
    setShowModal(true);
  };

  const saveProject = async (payload) => {
    const { data } = editing
      ? await updateEducationProject(
          educationId,
          editing._id,
          payload
        )
      : await createEducationProject(educationId, payload);

    setProjects((previous) =>
      editing
        ? previous.map((item) =>
            item._id === data.project._id
              ? data.project
              : item
          )
        : [data.project, ...previous]
    );

    setError("");

    // New projects open their page to add tasks, contributors, skills and files
    if (!editing) {
      navigate(projectPath(data.project));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteEducationProject(
        educationId,
        deleting._id
      );

      setProjects((previous) =>
        previous.filter(
          (item) => item._id !== deleting._id
        )
      );

      setDeleting(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete project"
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header>
        <span className="fw-semibold">Projects</span>
        <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
          {loading ? "…" : projects.length}
        </span>
      </Accordion.Header>

      <Accordion.Body>
        <div className="d-flex justify-content-end mb-3">
          <Button size="sm" onClick={openAdd}>
            <i className="bi bi-plus-lg me-1" />
            Add Project
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
        ) : projects.length === 0 ? (
          <p className="text-secondary mb-0">
            No projects added yet.
          </p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {projects.map((project) => (
              <div
                key={project._id}
                className="d-flex justify-content-between gap-3 border-bottom pb-3"
              >
                <div className="fw-semibold">
                  <Link
                    to={projectPath(project)}
                    className="text-decoration-none"
                  >
                    {project.title}
                    <i className="bi bi-chevron-right ms-1 small" />
                  </Link>
                  <span
                    className={`badge rounded-pill fw-normal ms-2 ${
                      projectStatusColors[project.status] || "text-bg-secondary"
                    }`}
                  >
                    {project.status}
                  </span>
                  <div><VisibilityToggles section="education_project" item={project} className="mt-2" /></div>
                </div>

                <div className="btn-group btn-group-sm flex-shrink-0 align-self-start">
                  <Button
                    as={Link}
                    to={projectPath(project)}
                    variant="outline-primary"
                    title="Open project: tasks, contributors, skills, files"
                  >
                    <i className="bi bi-box-arrow-in-right me-1" />
                    Open
                  </Button>

                  <Button
                    variant="outline-secondary"
                    title="Edit"
                    onClick={() => openEdit(project)}
                  >
                    <i className="bi bi-pencil" />
                  </Button>

                  <Button
                    variant="outline-danger"
                    title="Delete"
                    onClick={() => setDeleting(project)}
                  >
                    <i className="bi bi-trash" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ExperienceProjectModal
          show={showModal}
          project={editing}
          parent={{ ...education, ongoing: education.currentlyStudying }}
          parentLabel="education"
          defaultStatus="Planned"
          onHide={() => setShowModal(false)}
          onSave={saveProject}
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
            <Modal.Title>Delete Project?</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            Delete <strong>{deleting?.title}</strong>?
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
              {deletingBusy ? "Deleting..." : "Delete Project"}
            </Button>
          </Modal.Footer>
        </Modal>
      </Accordion.Body>
    </Accordion.Item>
  );
}
