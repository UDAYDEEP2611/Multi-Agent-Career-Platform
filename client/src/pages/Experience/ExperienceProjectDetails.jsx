import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Accordion, Button, Modal, Alert, Spinner } from "react-bootstrap";

import { getExperienceProject } from "../../api/experienceProjectApi";

import {
  getProjectTasks,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask
} from "../../api/experienceProjectTaskApi";

import ExperienceProjectTaskModal from "./ExperienceProjectTaskModal";
import { projectStatusColors } from "./projectStatus";

import ExperienceProjectContributorModal from "./ExperienceProjectContributorModal";

import {
  getProjectContributors,
  createProjectContributor,
  updateProjectContributor,
  deleteProjectContributor
} from "../../api/experienceProjectContributorApi";

import ExperienceSkillModal from "./ExperienceSkillModal";

import {
  getProjectSkills,
  createProjectSkill,
  updateProjectSkill,
  deleteProjectSkill
} from "../../api/experienceProjectSkillApi";

import ExperienceProjectMediaModal from "./ExperienceProjectMediaModal";
import { mediaIcon, formatSize } from "./projectMediaDisplay";

import {
  getProjectMedia,
  createProjectMediaLink,
  uploadProjectMediaFile,
  updateProjectMedia,
  deleteProjectMedia,
  downloadProjectMedia
} from "../../api/experienceProjectMediaApi";
import useRememberedSections from "../Layout/useRememberedSections";
import SkillAssociationSection from "../Skills/SkillAssociationSection";


const shortMonths = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const formatMonthYear = (month, year) =>
  year ? `${month ? shortMonths[month - 1] + " " : ""}${year}` : "";

export default function ExperienceProjectDetails() {
  const { experienceId, projectId } = useParams();
  const openSections = useRememberedSections(
    `open-sections:experience-project:${projectId}`,
    ["tasks"]
  );

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const [contributors, setContributors] = useState([]);

  const [showContributorModal, setShowContributorModal] = useState(false);
  const [editingContributor, setEditingContributor] = useState(null);
  const [deletingContributor, setDeletingContributor] = useState(null);
  const [deletingContributorBusy, setDeletingContributorBusy] = useState(false);

  const [skills, setSkills] = useState([]);

  const [showSkillModal, setShowSkillModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [deletingSkill, setDeletingSkill] = useState(null);
  const [deletingSkillBusy, setDeletingSkillBusy] = useState(false);

  const [mediaItems, setMediaItems] = useState([]);

  const [showMediaModal, setShowMediaModal] = useState(false);
  const [editingMedia, setEditingMedia] = useState(null);
  const [deletingMedia, setDeletingMedia] = useState(null);
  const [deletingMediaBusy, setDeletingMediaBusy] = useState(false);
  const [downloadingMediaId, setDownloadingMediaId] = useState(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      getExperienceProject(experienceId, projectId),
      getProjectTasks(experienceId, projectId),
      getProjectContributors(experienceId, projectId),
      getProjectSkills(experienceId, projectId),
      getProjectMedia(experienceId, projectId)
    ])
      .then(([
        projectResponse,
        tasksResponse,
        contributorsResponse,
        skillsResponse,
        mediaResponse
      ]) => {
        if (!active) return;

        setProject(projectResponse.data.project);
        setTasks(tasksResponse.data.tasks || []);
        setContributors(
          contributorsResponse.data.contributors || []
        );
        setSkills(skillsResponse.data.skills || []);
        setMediaItems(mediaResponse.data.media || []);
      })
      .catch((err) => {
        if (!active) return;

        setError(
          err.response?.data?.message ||
          "Unable to load project"
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [experienceId, projectId]);

  const openAddTask = () => {
    setEditingTask(null);
    setShowTaskModal(true);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setShowTaskModal(true);
  };

  const saveTask = async (payload) => {
    const { data } = editingTask
      ? await updateProjectTask(
          experienceId,
          projectId,
          editingTask._id,
          payload
        )
      : await createProjectTask(
          experienceId,
          projectId,
          payload
        );

    setTasks((previous) =>
      editingTask
        ? previous.map((item) =>
            item._id === data.task._id ? data.task : item
          )
        : [...previous, data.task]
    );

    setError("");
  };

  const confirmDeleteTask = async () => {
    if (!deletingTask) return;

    setDeletingBusy(true);

    try {
      await deleteProjectTask(
        experienceId,
        projectId,
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

  const openAddContributor = () => {
    setEditingContributor(null);
    setShowContributorModal(true);
  };

  const openEditContributor = (contributor) => {
    setEditingContributor(contributor);
    setShowContributorModal(true);
  };

  const saveContributor = async (payload) => {
    const { data } = editingContributor
      ? await updateProjectContributor(
          experienceId,
          projectId,
          editingContributor._id,
          payload
        )
      : await createProjectContributor(
          experienceId,
          projectId,
          payload
        );

    setContributors((previous) =>
      editingContributor
        ? previous.map((item) =>
            item._id === data.contributor._id
              ? data.contributor
              : item
          )
        : [...previous, data.contributor]
    );

    setError("");
  };

  const confirmDeleteContributor = async () => {
    if (!deletingContributor) return;

    setDeletingContributorBusy(true);

    try {
      await deleteProjectContributor(
        experienceId,
        projectId,
        deletingContributor._id
      );

      setContributors((previous) =>
        previous.filter(
          (item) => item._id !== deletingContributor._id
        )
      );

      setDeletingContributor(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete contributor"
      );
    } finally {
      setDeletingContributorBusy(false);
    }
  };

  const openAddSkill = () => {
    setEditingSkill(null);
    setShowSkillModal(true);
  };

  const openEditSkill = (skill) => {
    setEditingSkill(skill);
    setShowSkillModal(true);
  };

  const saveSkill = async (payload) => {
    const { data } = editingSkill
      ? await updateProjectSkill(
          experienceId,
          projectId,
          editingSkill._id,
          payload
        )
      : await createProjectSkill(
          experienceId,
          projectId,
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

  const confirmDeleteSkill = async () => {
    if (!deletingSkill) return;

    setDeletingSkillBusy(true);

    try {
      await deleteProjectSkill(
        experienceId,
        projectId,
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
      setDeletingSkillBusy(false);
    }
  };

  const openAddMedia = () => {
    setEditingMedia(null);
    setShowMediaModal(true);
  };

  const openEditMedia = (media) => {
    setEditingMedia(media);
    setShowMediaModal(true);
  };

  const saveMedia = async (payload) => {
    let response;

    if (editingMedia) {
      response = await updateProjectMedia(
        experienceId,
        projectId,
        editingMedia._id,
        payload.data
      );
    } else if (payload.type === "File") {
      response = await uploadProjectMediaFile(
        experienceId,
        projectId,
        payload.formData
      );
    } else {
      response = await createProjectMediaLink(
        experienceId,
        projectId,
        payload.data
      );
    }

    const saved = response.data.media;

    setMediaItems((previous) =>
      editingMedia
        ? previous.map((item) =>
            item._id === saved._id ? saved : item
          )
        : [saved, ...previous]
    );

    setError("");
  };

  const confirmDeleteMedia = async () => {
    if (!deletingMedia) return;

    setDeletingMediaBusy(true);

    try {
      await deleteProjectMedia(
        experienceId,
        projectId,
        deletingMedia._id
      );

      setMediaItems((previous) =>
        previous.filter(
          (item) => item._id !== deletingMedia._id
        )
      );

      setDeletingMedia(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete media"
      );
    } finally {
      setDeletingMediaBusy(false);
    }
  };

  const handleDownloadMedia = async (media) => {
    setDownloadingMediaId(media._id);
    setError("");

    try {
      await downloadProjectMedia(
        experienceId,
        projectId,
        media
      );
    } catch {
      setError("Unable to download file");
    } finally {
      setDownloadingMediaId(null);
    }
  };

  const backLink = (
    <Link
      to={`/dashboard/experience/${experienceId}`}
      className="text-decoration-none"
    >
      <i className="bi bi-arrow-left me-2" />
      Back to Experience
    </Link>
  );

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container-fluid">
        {backLink}
        <Alert variant="danger" className="mt-3">
          {error || "Project not found"}
        </Alert>
      </div>
    );
  }

  const start = formatMonthYear(project.startMonth, project.startYear);
  const end = formatMonthYear(project.endMonth, project.endYear);

  return (
    <div className="container-fluid">
      {backLink}

      {error && (
        <Alert
          variant="danger"
          dismissible
          className="mt-3"
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      <div className="card border-0 shadow-sm my-4">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-baseline flex-wrap column-gap-3">
            <h4 className="fw-bold mb-0">
              {project.title}
              <span
                className={`badge rounded-pill fw-normal fs-6 ms-2 align-middle ${
                  projectStatusColors[project.status] || "text-bg-secondary"
                }`}
              >
                {project.status}
              </span>
            </h4>

            {(start || end) && (
              <div className="fw-bold">
                {[start, end].filter(Boolean).join(" – ")}
              </div>
            )}
          </div>

          <p
            className={`mt-3 mb-0 ${project.description ? "" : "text-secondary"}`}
            style={{ whiteSpace: "pre-line" }}
          >
            {project.description || "No description added."}
          </p>
        </div>
      </div>

      <Accordion alwaysOpen {...openSections} className="mb-3 shadow-sm">
        <Accordion.Item eventKey="tasks">
          <Accordion.Header>
            <span className="fw-semibold">Tasks & Responsibilities</span>
            <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
              {tasks.length}
            </span>
          </Accordion.Header>

          <Accordion.Body>
            <div className="d-flex justify-content-end mb-3">
              <Button size="sm" onClick={openAddTask}>
                <i className="bi bi-plus-lg me-1" />
                Add Task
              </Button>
            </div>

            {tasks.length === 0 ? (
              <p className="text-secondary mb-0">
                No project tasks added yet.
              </p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {tasks.map((task) => (
                  <div
                    key={task._id}
                    className="d-flex justify-content-between gap-3 border-bottom pb-3"
                  >
                    <div style={{ whiteSpace: "pre-line" }}>
                      • {task.description}
                    </div>

                    <div className="btn-group btn-group-sm flex-shrink-0 align-self-start">
                      <Button
                        variant="outline-secondary"
                        title="Edit"
                        onClick={() => openEditTask(task)}
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
          </Accordion.Body>
        </Accordion.Item>

        <Accordion.Item eventKey="contributors">
          <Accordion.Header>
            <span className="fw-semibold">Contributors</span>
            <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
              {contributors.length}
            </span>
          </Accordion.Header>

          <Accordion.Body>
            <div className="d-flex justify-content-end mb-3">
              <Button size="sm" onClick={openAddContributor}>
                <i className="bi bi-plus-lg me-1" />
                Add Contributor
              </Button>
            </div>

            {contributors.length === 0 ? (
              <p className="text-secondary mb-0">
                No contributors added yet.
              </p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {contributors.map((item) => (
                  <div
                    key={item._id}
                    className="d-flex justify-content-between gap-3 border-bottom pb-3"
                  >
                    <div className="d-flex gap-3">
                      <div
                        className="rounded-circle bg-primary-subtle text-primary-emphasis fw-semibold d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width: 40, height: 40 }}
                      >
                        {item.name.trim().charAt(0).toUpperCase()}
                      </div>

                      <div>
                        <div className="fw-semibold">
                          {item.name}
                        </div>

                        <div className="text-secondary small">
                          {item.role}
                        </div>

                        {item.contribution && (
                          <p
                            className="mt-2 mb-0"
                            style={{ whiteSpace: "pre-line" }}
                          >
                            {item.contribution}
                          </p>
                        )}

                        {(item.email || item.profileUrl) && (
                          <div className="d-flex flex-wrap column-gap-3 mt-2 small">
                            {item.email && (
                              <a
                                href={`mailto:${item.email}`}
                                className="text-decoration-none"
                              >
                                <i className="bi bi-envelope me-1" />
                                {item.email}
                              </a>
                            )}

                            {item.profileUrl && (
                              <a
                                href={item.profileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-decoration-none"
                              >
                                View profile
                                <i className="bi bi-box-arrow-up-right ms-1" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="btn-group btn-group-sm flex-shrink-0 align-self-start">
                      <Button
                        variant="outline-secondary"
                        title="Edit"
                        onClick={() => openEditContributor(item)}
                      >
                        <i className="bi bi-pencil" />
                      </Button>

                      <Button
                        variant="outline-danger"
                        title="Delete"
                        onClick={() => setDeletingContributor(item)}
                      >
                        <i className="bi bi-trash" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Accordion.Body>
        </Accordion.Item>

        <Accordion.Item eventKey="skills">
          <Accordion.Header>
            <span className="fw-semibold">Skills</span>
            <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
              {skills.length}
            </span>
          </Accordion.Header>

          <Accordion.Body>
            <div className="d-flex justify-content-end mb-3">
              <Button size="sm" onClick={openAddSkill}>
                <i className="bi bi-plus-lg me-1" />
                Add Skill
              </Button>
            </div>

            {skills.length === 0 ? (
              <p className="text-secondary mb-0">
                No project skills added yet.
              </p>
            ) : (
              <div className="d-flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <div
                    key={skill._id}
                    className="d-inline-flex align-items-center border border-primary-subtle bg-primary-subtle text-primary-emphasis rounded-pill small ps-2 pe-0"
                    title={skill.category || undefined}
                  >
                    <button
                      type="button"
                      className="btn btn-link p-0 text-reset text-decoration-none fw-medium small lh-sm"
                      onClick={() => openEditSkill(skill)}
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
          </Accordion.Body>
        </Accordion.Item>

        <SkillAssociationSection
          key={projectId}
          sourceType="experience_project"
          sourceId={projectId}
        />

        <Accordion.Item eventKey="media">
          <Accordion.Header>
            <span className="fw-semibold">Media & Files</span>
            <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
              {mediaItems.length}
            </span>
          </Accordion.Header>

          <Accordion.Body>
            <div className="d-flex justify-content-end mb-3">
              <Button size="sm" onClick={openAddMedia}>
                <i className="bi bi-plus-lg me-1" />
                Add Media
              </Button>
            </div>

            {mediaItems.length === 0 ? (
              <p className="text-secondary mb-0">
                No media or files added yet.
              </p>
            ) : (
              <div
                className="d-grid gap-3"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))"
                }}
              >
                {mediaItems.map((item) => (
                  <div key={item._id} className="d-flex">
                    <div className="border rounded-3 p-3 w-100 d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <i className={`bi fs-3 ${mediaIcon(item)}`} />

                        <div className="btn-group btn-group-sm flex-shrink-0">
                          <Button
                            variant="outline-secondary"
                            title="Edit"
                            onClick={() => openEditMedia(item)}
                          >
                            <i className="bi bi-pencil" />
                          </Button>

                          <Button
                            variant="outline-danger"
                            title="Delete"
                            onClick={() => setDeletingMedia(item)}
                          >
                            <i className="bi bi-trash" />
                          </Button>
                        </div>
                      </div>

                      <div className="fw-semibold mt-2 text-break">
                        {item.title}
                      </div>

                      <div className="text-secondary small text-truncate">
                        {item.mediaType === "File" && item.file
                          ? `${item.file.originalName} · ${formatSize(item.file.size)}`
                          : item.url}
                      </div>

                      <div className="mt-auto pt-2">
                        {item.mediaType === "Link" ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="small text-decoration-none"
                          >
                            Open link
                            <i className="bi bi-box-arrow-up-right ms-1" />
                          </a>
                        ) : (
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 text-decoration-none"
                            disabled={downloadingMediaId === item._id}
                            onClick={() => handleDownloadMedia(item)}
                          >
                            <i className="bi bi-download me-1" />
                            {downloadingMediaId === item._id
                              ? "Downloading..."
                              : "Download"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Accordion.Body>
        </Accordion.Item>

      </Accordion>

      <ExperienceProjectTaskModal
        show={showTaskModal}
        task={editingTask}
        onHide={() => setShowTaskModal(false)}
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
          <Modal.Title>Delete Project Task?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Are you sure you want to delete this task?
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
            onClick={confirmDeleteTask}
          >
            {deletingBusy ? "Deleting..." : "Delete Task"}
          </Button>
        </Modal.Footer>
      </Modal>

      <ExperienceProjectContributorModal
        show={showContributorModal}
        contributor={editingContributor}
        onHide={() => setShowContributorModal(false)}
        onSave={saveContributor}
      />

      <Modal
        show={!!deletingContributor}
        onHide={() => {
          if (!deletingContributorBusy) {
            setDeletingContributor(null);
          }
        }}
        centered
        backdrop={deletingContributorBusy ? "static" : true}
        keyboard={!deletingContributorBusy}
      >
        <Modal.Header closeButton={!deletingContributorBusy}>
          <Modal.Title>Delete Contributor?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Are you sure you want to remove{" "}
          <strong>{deletingContributor?.name}</strong> from this project?
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={deletingContributorBusy}
            onClick={() => setDeletingContributor(null)}
          >
            Cancel
          </Button>

          <Button
            variant="danger"
            disabled={deletingContributorBusy}
            onClick={confirmDeleteContributor}
          >
            {deletingContributorBusy
              ? "Deleting..."
              : "Delete Contributor"}
          </Button>
        </Modal.Footer>
      </Modal>

      <ExperienceSkillModal
        show={showSkillModal}
        skill={editingSkill}
        onHide={() => setShowSkillModal(false)}
        onSave={saveSkill}
      />

      <Modal
        show={!!deletingSkill}
        onHide={() => {
          if (!deletingSkillBusy) setDeletingSkill(null);
        }}
        centered
        backdrop={deletingSkillBusy ? "static" : true}
        keyboard={!deletingSkillBusy}
      >
        <Modal.Header closeButton={!deletingSkillBusy}>
          <Modal.Title>Delete Project Skill?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Are you sure you want to remove{" "}
          <strong>{deletingSkill?.name}</strong> from this project?
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={deletingSkillBusy}
            onClick={() => setDeletingSkill(null)}
          >
            Cancel
          </Button>

          <Button
            variant="danger"
            disabled={deletingSkillBusy}
            onClick={confirmDeleteSkill}
          >
            {deletingSkillBusy ? "Deleting..." : "Delete Skill"}
          </Button>
        </Modal.Footer>
      </Modal>

      <ExperienceProjectMediaModal
        show={showMediaModal}
        media={editingMedia}
        onHide={() => setShowMediaModal(false)}
        onSave={saveMedia}
      />

      <Modal
        show={!!deletingMedia}
        onHide={() => {
          if (!deletingMediaBusy) setDeletingMedia(null);
        }}
        centered
        backdrop={deletingMediaBusy ? "static" : true}
        keyboard={!deletingMediaBusy}
      >
        <Modal.Header closeButton={!deletingMediaBusy}>
          <Modal.Title>Delete Media?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Are you sure you want to delete{" "}
          <strong>{deletingMedia?.title}</strong>?
          {deletingMedia?.mediaType === "File" &&
            " The uploaded file will also be deleted."}
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={deletingMediaBusy}
            onClick={() => setDeletingMedia(null)}
          >
            Cancel
          </Button>

          <Button
            variant="danger"
            disabled={deletingMediaBusy}
            onClick={confirmDeleteMedia}
          >
            {deletingMediaBusy ? "Deleting..." : "Delete Media"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
