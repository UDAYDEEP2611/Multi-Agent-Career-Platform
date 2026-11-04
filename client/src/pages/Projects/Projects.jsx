import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Modal,
  Spinner
} from "react-bootstrap";

import ProjectModal from "./ProjectModal";
import ProjectCard from "./ProjectCard";

import {
  getProjects,
  createProject,
  updateProject,
  deleteProject
} from "../../api/projectApi";

const toMonths = (year, month, fallback) => (year ? year * 12 + (month || fallback) : 0);

// Featured first, then ongoing / most recently ended, then newest start
const newestFirst = (a, b) =>
  Number(b.featured) - Number(a.featured) ||
  (b.ongoing ? Infinity : toMonths(b.endYear, b.endMonth, 12)) -
    (a.ongoing ? Infinity : toMonths(a.endYear, a.endMonth, 12)) ||
  toMonths(b.startYear, b.startMonth, 1) - toMonths(a.startYear, a.startMonth, 1) ||
  new Date(b.createdAt) - new Date(a.createdAt);

export default function Projects() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // Carousel: which ends are reached, so the arrows can be disabled
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });

  const updateEdges = () => {
    const track = trackRef.current;
    if (!track) return;

    setEdges({
      atStart: track.scrollLeft <= 1,
      atEnd: track.scrollLeft + track.clientWidth >= track.scrollWidth - 1
    });
  };

  // Recheck when the track resizes or its cards change
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new ResizeObserver(updateEdges);
    observer.observe(track);
    for (const card of track.children) observer.observe(card);

    return () => observer.disconnect();
  }, [projects, loading]);

  const scrollCards = (direction) => {
    const track = trackRef.current;
    track?.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: "smooth" });
  };

  useEffect(() => {
    let active = true;

    getProjects()
      .then(({ data }) => {
        if (active) setProjects(data.projects || []);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load projects");
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

  const openEdit = (project) => {
    setEditing(project);
    setShowModal(true);
  };

  const saveProject = async (payload) => {
    if (editing) {
      const { data } = await updateProject(editing._id, payload);
      setProjects((previous) =>
        previous.map((item) => (item._id === data.project._id ? data.project : item))
      );
      return;
    }

    // New projects open their page so sections can be added
    const { data } = await createProject(payload);
    navigate(`/dashboard/projects/${data.project._id}`);
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteProject(deleting._id);
      setProjects((previous) => previous.filter((item) => item._id !== deleting._id));
      setDeleting(null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete project");
    } finally {
      setDeletingBusy(false);
    }
  };

  const sorted = [...projects].sort(newestFirst);

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="fw-bold mb-1">Projects</h1>
          <p className="text-secondary mb-0">
            Personal, academic, open source and research work.
          </p>
        </div>

        <Button onClick={openAdd}>
          <i className="bi bi-plus-lg me-2" />
          Add Project
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
      ) : projects.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 px-4">
            <div
              className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 72, height: 72 }}
            >
              <i className="bi bi-folder-fill fs-2" />
            </div>

            <h5 className="fw-semibold mb-2">No projects added yet</h5>

            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: 420 }}>
              Add projects you built outside a job or course: personal,
              open source, research and more.
            </p>

            <Button onClick={openAdd} className="px-4">
              <i className="bi bi-plus-lg me-2" />
              Add Your First Project
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small text-secondary">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>

            <div className="btn-group btn-group-sm">
              <Button
                variant="outline-secondary"
                onClick={() => scrollCards(-1)}
                disabled={edges.atStart}
                aria-label="Previous projects"
                title="Previous"
              >
                <i className="bi bi-chevron-left" />
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => scrollCards(1)}
                disabled={edges.atEnd}
                aria-label="Next projects"
                title="Next"
              >
                <i className="bi bi-chevron-right" />
              </Button>
            </div>
          </div>

          <div
            ref={trackRef}
            onScroll={updateEdges}
            className="d-flex gap-3 overflow-x-auto pb-3"
            style={{ scrollSnapType: "x mandatory", scrollPaddingLeft: 2 }}
            tabIndex={0}
            role="region"
            aria-label="Projects"
          >
          {sorted.map((project) => (
            <div
              key={project._id}
              className="flex-shrink-0 py-1 ps-1"
              style={{ width: "min(340px, 85%)", scrollSnapAlign: "start" }}
            >
              <ProjectCard
                project={project}
                onEdit={openEdit}
                onDelete={setDeleting}
              />
            </div>
          ))}
          </div>
        </>
      )}

      <ProjectModal
        show={showModal}
        project={editing}
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
          Delete <strong>{deleting?.title}</strong> with its tasks, contributors,
          media, achievements and links? This action cannot be undone. Your
          skills stay on the Skills page.
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" disabled={deletingBusy} onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={deletingBusy} onClick={confirmDelete}>
            {deletingBusy ? "Deleting..." : "Delete Project"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
