import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Accordion, Button, Alert, Spinner, Modal } from "react-bootstrap";

import { getExperience } from "../../api/experienceApi";

import {
  getExperienceTasks,
  createExperienceTask,
  updateExperienceTask,
  deleteExperienceTask
} from "../../api/experienceTaskApi";

import ExperienceTaskModal from "./ExperienceTaskModal";
import ExperienceSkillModal from "./ExperienceSkillModal";

import {
  getExperienceSkills,
  createExperienceSkill,
  updateExperienceSkill,
  deleteExperienceSkill
} from "../../api/experienceSkillApi";

import ExperienceMediaModal from "./ExperienceMediaModal";

import {
  getExperienceMedia,
  createExperienceMedia,
  updateExperienceMedia,
  deleteExperienceMedia
} from "../../api/experienceMediaApi";

import {
  uploadItemFile,
  deleteItemFile,
  itemFileUrl
} from "../../api/experienceFileApi";

import FileChip from "./FileChip";

import ExperienceProjectModal from "./ExperienceProjectModal";

import {
  getExperienceProjects,
  createExperienceProject,
  updateExperienceProject,
  deleteExperienceProject
} from "../../api/experienceProjectApi";

import { projectStatusColors } from "./projectStatus";

import ExperienceAchievementModal from "./ExperienceAchievementModal";

import {
  getExperienceAchievements,
  createExperienceAchievement,
  updateExperienceAchievement,
  deleteExperienceAchievement
} from "../../api/experienceAchievementApi";

import ExperienceVolunteeringModal from "./ExperienceVolunteeringModal";

import {
  getExperienceVolunteering,
  createExperienceVolunteering,
  updateExperienceVolunteering,
  deleteExperienceVolunteering
} from "../../api/experienceVolunteeringApi";

import ExperienceRecordModal from "./ExperienceRecordModal";

import {
  getExperienceRecords,
  createExperienceRecord,
  updateExperienceRecord,
  deleteExperienceRecord
} from "../../api/experienceRecordApi";
import useRememberedSections from "../Layout/useRememberedSections";
import SkillAssociationSection from "../Skills/SkillAssociationSection";
import LimitedAddBar from "../Common/LimitedAddBar";
import { MAX_ITEMS } from "../../limits";
import VisibilityToggles from "../Common/VisibilityToggles";

const shortMonths = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function ExperienceDetails() {
  const { experienceId } = useParams();
  const openSections = useRememberedSections(
    `open-sections:experience:${experienceId}`,
    ["tasks"]
  );
  const navigate = useNavigate();

  const [experience, setExperience] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

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

  const [achievements, setAchievements] = useState([]);

  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState(null);
  const [deletingAchievement, setDeletingAchievement] = useState(null);
  const [deletingAchievementBusy, setDeletingAchievementBusy] = useState(false);

  const [volunteering, setVolunteering] = useState([]);

  const [showVolunteeringModal, setShowVolunteeringModal] = useState(false);
  const [editingVolunteering, setEditingVolunteering] = useState(null);
  const [deletingVolunteering, setDeletingVolunteering] = useState(null);
  const [deletingVolunteeringBusy, setDeletingVolunteeringBusy] = useState(false);

  const [records, setRecords] = useState([]);

  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [deletingRecordBusy, setDeletingRecordBusy] = useState(false);

  const [projects, setProjects] = useState([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [deletingProjectBusy, setDeletingProjectBusy] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.all([
      getExperience(experienceId),
      getExperienceTasks(experienceId),
      getExperienceSkills(experienceId),
      getExperienceMedia(experienceId),
      getExperienceAchievements(experienceId),
      getExperienceVolunteering(experienceId),
      getExperienceRecords(experienceId),
      getExperienceProjects(experienceId)
    ])
      .then(([
        experienceResponse,
        tasksResponse,
        skillsResponse,
        mediaResponse,
        achievementsResponse,
        volunteeringResponse,
        recordsResponse,
        projectsResponse
      ]) => {
        if (!active) return;

        setExperience(experienceResponse.data.experience);
        setTasks(tasksResponse.data.tasks || []);
        setSkills(skillsResponse.data.skills || []);
        setMediaItems(mediaResponse.data.media || []);
        setAchievements(
          achievementsResponse.data.achievements || []
        );
        setVolunteering(
          volunteeringResponse.data.volunteering || []
        );
        setRecords(recordsResponse.data.records || []);
        setProjects(projectsResponse.data.projects || []);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load experience details."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [experienceId]);

  const openAddTask = () => {
    setEditingTask(null);
    setShowTaskModal(true);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setShowTaskModal(true);
  };

  const saveTask = async (description) => {
    const { data } = editingTask
      ? await updateExperienceTask(
          experienceId,
          editingTask._id,
          description
        )
      : await createExperienceTask(experienceId, description);

    setTasks((previous) =>
      editingTask
        ? previous.map((item) =>
            item._id === data.task._id ? data.task : item
          )
        : [...previous, data.task]
    );

    setError("");
  };

  const confirmDelete = async () => {
    if (!deletingTask) return;

    setDeletingBusy(true);

    try {
      await deleteExperienceTask(
        experienceId,
        deletingTask._id
      );

      setTasks((previous) =>
        previous.filter((item) => item._id !== deletingTask._id)
      );

      setDeletingTask(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete task."
      );
    } finally {
      setDeletingBusy(false);
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
      ? await updateExperienceSkill(
          experienceId,
          editingSkill._id,
          payload
        )
      : await createExperienceSkill(experienceId, payload);

    setSkills((previous) =>
      editingSkill
        ? previous.map((item) =>
            item._id === data.skill._id ? data.skill : item
          )
        : [...previous, data.skill]
    );

    setError("");
  };

  const confirmDeleteSkill = async () => {
    if (!deletingSkill) return;

    setDeletingSkillBusy(true);

    try {
      await deleteExperienceSkill(
        experienceId,
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
        "Unable to delete skill."
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

  // Saves an item, then uploads or removes its attached file. The modal
  // switches to editing the saved item, so retrying after a failed upload
  // updates it instead of creating a duplicate.
  const saveWithFile = async ({
    section,
    responseKey,
    editing,
    setEditing,
    setItems,
    create,
    update,
    payload,
    changes
  }) => {
    const { data } = editing
      ? await update(experienceId, editing._id, payload)
      : await create(experienceId, payload);

    let saved = data[responseKey];

    const store = (item) =>
      setItems((previous) =>
        previous.some((existing) => existing._id === item._id)
          ? previous.map((existing) =>
              existing._id === item._id ? item : existing
            )
          : [item, ...previous]
      );

    store(saved);
    setEditing(saved);

    if (changes?.file) {
      const response = await uploadItemFile(
        experienceId,
        section,
        saved._id,
        changes.file
      );
      saved = response.data[responseKey];
    } else if (changes?.removeFile && saved.file) {
      const response = await deleteItemFile(
        experienceId,
        section,
        saved._id
      );
      saved = response.data[responseKey];
    }

    store(saved);
    setError("");
  };

  const saveMedia = (payload, changes) =>
    saveWithFile({
      section: "media",
      responseKey: "media",
      editing: editingMedia,
      setEditing: setEditingMedia,
      setItems: setMediaItems,
      create: createExperienceMedia,
      update: updateExperienceMedia,
      payload,
      changes
    });

  const confirmDeleteMedia = async () => {
    if (!deletingMedia) return;

    setDeletingMediaBusy(true);

    try {
      await deleteExperienceMedia(
        experienceId,
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
        "Unable to delete media."
      );
    } finally {
      setDeletingMediaBusy(false);
    }
  };

  const openAddAchievement = () => {
    setEditingAchievement(null);
    setShowAchievementModal(true);
  };

  const openEditAchievement = (achievement) => {
    setEditingAchievement(achievement);
    setShowAchievementModal(true);
  };

  const saveAchievement = (payload, changes) =>
    saveWithFile({
      section: "achievements",
      responseKey: "achievement",
      editing: editingAchievement,
      setEditing: setEditingAchievement,
      setItems: setAchievements,
      create: createExperienceAchievement,
      update: updateExperienceAchievement,
      payload,
      changes
    });

  const confirmDeleteAchievement = async () => {
    if (!deletingAchievement) return;

    setDeletingAchievementBusy(true);

    try {
      await deleteExperienceAchievement(
        experienceId,
        deletingAchievement._id
      );

      setAchievements((previous) =>
        previous.filter(
          (item) => item._id !== deletingAchievement._id
        )
      );

      setDeletingAchievement(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete achievement."
      );
    } finally {
      setDeletingAchievementBusy(false);
    }
  };

  const openAddVolunteering = () => {
    setEditingVolunteering(null);
    setShowVolunteeringModal(true);
  };

  const openEditVolunteering = (item) => {
    setEditingVolunteering(item);
    setShowVolunteeringModal(true);
  };

  const saveVolunteering = (payload, changes) =>
    saveWithFile({
      section: "volunteering",
      responseKey: "volunteering",
      editing: editingVolunteering,
      setEditing: setEditingVolunteering,
      setItems: setVolunteering,
      create: createExperienceVolunteering,
      update: updateExperienceVolunteering,
      payload,
      changes
    });

  const confirmDeleteVolunteering = async () => {
    if (!deletingVolunteering) return;

    setDeletingVolunteeringBusy(true);

    try {
      await deleteExperienceVolunteering(
        experienceId,
        deletingVolunteering._id
      );

      setVolunteering((previous) =>
        previous.filter(
          (item) => item._id !== deletingVolunteering._id
        )
      );

      setDeletingVolunteering(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete volunteering record."
      );
    } finally {
      setDeletingVolunteeringBusy(false);
    }
  };

  const formatMonthYear = (month, year) =>
    year ? `${month ? shortMonths[month - 1] + " " : ""}${year}` : "";

  const openAddRecord = () => {
    setEditingRecord(null);
    setShowRecordModal(true);
  };

  const openEditRecord = (record) => {
    setEditingRecord(record);
    setShowRecordModal(true);
  };

  const saveRecord = (payload, changes) =>
    saveWithFile({
      section: "records",
      responseKey: "record",
      editing: editingRecord,
      setEditing: setEditingRecord,
      setItems: setRecords,
      create: createExperienceRecord,
      update: updateExperienceRecord,
      payload,
      changes
    });

  const confirmDeleteRecord = async () => {
    if (!deletingRecord) return;

    setDeletingRecordBusy(true);

    try {
      await deleteExperienceRecord(
        experienceId,
        deletingRecord._id
      );

      setRecords((previous) =>
        previous.filter(
          (item) => item._id !== deletingRecord._id
        )
      );

      setDeletingRecord(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete record."
      );
    } finally {
      setDeletingRecordBusy(false);
    }
  };

  const openAddProject = () => {
    setEditingProject(null);
    setShowProjectModal(true);
  };

  const openEditProject = (project) => {
    setEditingProject(project);
    setShowProjectModal(true);
  };

  const saveProject = async (payload) => {
    const { data } = editingProject
      ? await updateExperienceProject(
          experienceId,
          editingProject._id,
          payload
        )
      : await createExperienceProject(
          experienceId,
          payload
        );

    setProjects((previous) =>
      editingProject
        ? previous.map((item) =>
            item._id === data.project._id
              ? data.project
              : item
          )
        : [data.project, ...previous]
    );

    setError("");

    // New projects open their page to add tasks, contributors, skills and files
    if (!editingProject) {
      navigate(`/dashboard/experience/${experienceId}/projects/${data.project._id}`);
    }
  };

  const confirmDeleteProject = async () => {
    if (!deletingProject) return;

    setDeletingProjectBusy(true);

    try {
      await deleteExperienceProject(
        experienceId,
        deletingProject._id
      );

      setProjects((previous) =>
        previous.filter(
          (item) => item._id !== deletingProject._id
        )
      );

      setDeletingProject(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete project"
      );
    } finally {
      setDeletingProjectBusy(false);
    }
  };

  if (loading) return <Spinner animation="border" />;

  return (
    <div className="container-fluid">
      <Link to="/dashboard/experience" className="text-decoration-none">
        ← Back to Experience
      </Link>

      {error && (
        <Alert variant="danger" className="mt-3">
          {error}
        </Alert>
      )}

      {experience && (
        <>
          <div className="card border-0 shadow-sm my-4">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-baseline flex-wrap column-gap-3">
                <h5 className="fw-bold mb-0">{experience.organization}</h5>

                <div className="fw-bold">
                  {formatMonthYear(
                    experience.startMonth,
                    experience.startYear
                  )}
                  {" – "}
                  {experience.currentlyWorking
                    ? "Present"
                    : formatMonthYear(
                        experience.endMonth,
                        experience.endYear
                      )}
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-baseline flex-wrap column-gap-3 fst-italic">
                <div>
                  {experience.jobTitle}
                  {experience.employmentType && (
                    <span className="text-secondary">
                      {" "}({experience.employmentType})
                    </span>
                  )}
                </div>

                {(experience.location || experience.locationType) && (
                  <div>
                    {[experience.location, experience.locationType]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>

              {experience.summary && (
                <p className="mt-3 mb-0" style={{ whiteSpace: "pre-line" }}>
                  {experience.summary}
                </p>
              )}

              {experience.highlights && (
                <p className="mt-3 mb-0" style={{ whiteSpace: "pre-line" }}>
                  {experience.highlights}
                </p>
              )}
            </div>
          </div>

          <Accordion alwaysOpen {...openSections} className="mb-3 shadow-sm">
            <Accordion.Item eventKey="tasks">
              <Accordion.Header>
                <span className="fw-semibold">Tasks & Highlights</span>
                <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
                  {tasks.length}
                </span>
              </Accordion.Header>

              <Accordion.Body>
                <LimitedAddBar
                  count={tasks.length}
                  max={MAX_ITEMS.tasks}
                  noun="tasks"
                  label="Add Task"
                  onAdd={openAddTask}
                />

                {tasks.length === 0 ? (
                  <p className="text-secondary mb-0">
                    No tasks added yet. This section is optional.
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

            <Accordion.Item eventKey="skills">
              <Accordion.Header>
                <span className="fw-semibold">Skills</span>
                <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
                  {skills.length}
                </span>
              </Accordion.Header>

              <Accordion.Body>
                <LimitedAddBar
                  count={skills.length}
                  max={MAX_ITEMS.skills}
                  noun="skills"
                  label="Add Skill"
                  onAdd={openAddSkill}
                />

                {skills.length === 0 ? (
                  <p className="text-secondary mb-0">
                    No skills added yet. This section is optional.
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
              key={experienceId}
              sourceType="experience"
              sourceId={experienceId}
            />

            <Accordion.Item eventKey="projects">
              <Accordion.Header>
                <span className="fw-semibold">Projects</span>
                <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
                  {projects.length}
                </span>
              </Accordion.Header>

              <Accordion.Body>
                <div className="d-flex justify-content-end mb-3">
                  <Button size="sm" onClick={openAddProject}>
                    <i className="bi bi-plus-lg me-1" />
                    Add Project
                  </Button>
                </div>

                {projects.length === 0 ? (
                  <p className="text-secondary mb-0">
                    No projects added yet. This section is optional.
                  </p>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {projects.map((project) => {
                      return (
                        <div
                          key={project._id}
                          className="d-flex justify-content-between gap-3 border-bottom pb-3"
                        >
                          <div>
                            <div className="fw-semibold">
                              <Link
                                to={`/dashboard/experience/${experienceId}/projects/${project._id}`}
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
                            </div>
                            <VisibilityToggles section="experience_project" item={project} className="mt-2" />
                          </div>

                          <div className="btn-group btn-group-sm flex-shrink-0 align-self-start">
                            <Button
                              as={Link}
                              to={`/dashboard/experience/${experienceId}/projects/${project._id}`}
                              variant="outline-primary"
                              title="Open project: tasks, contributors, skills, files"
                            >
                              <i className="bi bi-box-arrow-in-right me-1" />
                              Open
                            </Button>

                            <Button
                              variant="outline-secondary"
                              title="Edit"
                              onClick={() => openEditProject(project)}
                            >
                              <i className="bi bi-pencil" />
                            </Button>

                            <Button
                              variant="outline-danger"
                              title="Delete"
                              onClick={() => setDeletingProject(project)}
                            >
                              <i className="bi bi-trash" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="media">
              <Accordion.Header>
                <span className="fw-semibold">Media</span>
                <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
                  {mediaItems.length}
                </span>
              </Accordion.Header>

              <Accordion.Body>
                <LimitedAddBar
                  count={mediaItems.length}
                  max={MAX_ITEMS.media}
                  noun="media items"
                  label="Add Media"
                  onAdd={openAddMedia}
                />

                {mediaItems.length === 0 ? (
                  <p className="text-secondary mb-0">
                    No media added yet. This section is optional.
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
                            <span className="badge rounded-pill text-bg-light border fw-normal">
                              {item.mediaType}
                            </span>

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

                          <div className="mt-2 text-break">
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="fw-semibold text-decoration-none"
                              >
                                {item.title}
                                <i className="bi bi-box-arrow-up-right ms-2 small" />
                              </a>
                            ) : (
                              <span className="fw-semibold">{item.title}</span>
                            )}
                          </div>

                          {item.file && (
                            <FileChip
                              href={itemFileUrl(experienceId, "media", item)}
                              file={item.file}
                              className="mt-3"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="achievements">
              <Accordion.Header>
                <span className="fw-semibold">Activities & Achievements</span>
                <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
                  {achievements.length}
                </span>
              </Accordion.Header>

              <Accordion.Body>
                <LimitedAddBar
                  count={achievements.length}
                  max={MAX_ITEMS.achievements}
                  noun="achievements"
                  label="Add Achievement"
                  onAdd={openAddAchievement}
                />

                {achievements.length === 0 ? (
                  <p className="text-secondary mb-0">
                    No achievements added yet. This section is optional.
                  </p>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {achievements.map((item) => (
                      <div
                        key={item._id}
                        className="d-flex justify-content-between gap-3 border-bottom pb-3"
                      >
                        <div>
                          <div className="fw-semibold">{item.title}</div>

                          <div className="text-secondary small mt-1">
                            {[
                              item.type,
                              item.issuedBy,
                              item.year
                                ? `${item.month ? shortMonths[item.month - 1] + " " : ""}${item.year}`
                                : null
                            ].filter(Boolean).join(" · ")}
                          </div>

                          {item.description && (
                            <p
                              className="mt-2 mb-0"
                              style={{ whiteSpace: "pre-line" }}
                            >
                              {item.description}
                            </p>
                          )}

                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="d-inline-block mt-2 small text-decoration-none"
                            >
                              View link
                              <i className="bi bi-box-arrow-up-right ms-1" />
                            </a>
                          )}

                          {item.file && (
                            <div className="mt-2">
                              <FileChip
                                href={itemFileUrl(experienceId, "achievements", item)}
                                file={item.file}
                              />
                            </div>
                          )}
                        </div>

                        <div className="btn-group btn-group-sm flex-shrink-0 align-self-start">
                          <Button
                            variant="outline-secondary"
                            title="Edit"
                            onClick={() => openEditAchievement(item)}
                          >
                            <i className="bi bi-pencil" />
                          </Button>

                          <Button
                            variant="outline-danger"
                            title="Delete"
                            onClick={() => setDeletingAchievement(item)}
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

            <Accordion.Item eventKey="volunteering">
              <Accordion.Header>
                <span className="fw-semibold">Volunteering</span>
                <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
                  {volunteering.length}
                </span>
              </Accordion.Header>

              <Accordion.Body>
                <LimitedAddBar
                  count={volunteering.length}
                  max={MAX_ITEMS.volunteering}
                  noun="volunteering entries"
                  label="Add Volunteering"
                  onAdd={openAddVolunteering}
                />

                {volunteering.length === 0 ? (
                  <p className="text-secondary mb-0">
                    No volunteering records added yet. This section is optional.
                  </p>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {volunteering.map((item) => {
                      const start = formatMonthYear(item.startMonth, item.startYear);
                      const end = item.currentlyVolunteering
                        ? "Present"
                        : formatMonthYear(item.endMonth, item.endYear);

                      return (
                        <div
                          key={item._id}
                          className="d-flex justify-content-between gap-3 border-bottom pb-3"
                        >
                          <div>
                            <div className="fw-semibold">
                              {item.role}
                            </div>

                            <div className="text-secondary">
                              {item.organization}
                            </div>

                            <div className="text-secondary small mt-1">
                              {[
                                item.cause,
                                item.location,
                                [start, end].filter(Boolean).join(" – ")
                              ].filter(Boolean).join(" · ")}
                            </div>

                            {item.description && (
                              <p
                                className="mt-2 mb-0"
                                style={{ whiteSpace: "pre-line" }}
                              >
                                {item.description}
                              </p>
                            )}

                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="d-inline-block mt-2 small text-decoration-none"
                              >
                                View link
                                <i className="bi bi-box-arrow-up-right ms-1" />
                              </a>
                            )}

                            {item.file && (
                              <div className="mt-2">
                                <FileChip
                                  href={itemFileUrl(experienceId, "volunteering", item)}
                                  file={item.file}
                                />
                              </div>
                            )}
                          </div>

                          <div className="btn-group btn-group-sm flex-shrink-0 align-self-start">
                            <Button
                              variant="outline-secondary"
                              title="Edit"
                              onClick={() => openEditVolunteering(item)}
                            >
                              <i className="bi bi-pencil" />
                            </Button>

                            <Button
                              variant="outline-danger"
                              title="Delete"
                              onClick={() => setDeletingVolunteering(item)}
                            >
                              <i className="bi bi-trash" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Accordion.Body>
            </Accordion.Item>

            <Accordion.Item eventKey="records">
              <Accordion.Header>
                <span className="fw-semibold">Records</span>
                <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
                  {records.length}
                </span>
              </Accordion.Header>

              <Accordion.Body>
                <div className="d-flex justify-content-end mb-3">
                  <Button size="sm" onClick={openAddRecord}>
                    <i className="bi bi-plus-lg me-1" />
                    Add Record
                  </Button>
                </div>

                {records.length === 0 ? (
                  <p className="text-secondary mb-0">
                    No records added yet. This section is optional.
                  </p>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {records.map((item) => (
                      <div
                        key={item._id}
                        className="d-flex justify-content-between gap-3 border-bottom pb-3"
                      >
                        <div>
                          <div className="fw-semibold">
                            {item.title}
                            <span
                              className={`badge rounded-pill fw-normal ms-2 ${
                                item.visibility === "Private"
                                  ? "text-bg-secondary"
                                  : "text-bg-primary"
                              }`}
                            >
                              <i
                                className={`bi ${
                                  item.visibility === "Private"
                                    ? "bi-lock"
                                    : "bi-globe"
                                } me-1`}
                              />
                              {item.visibility}
                            </span>
                          </div>

                          <div className="text-secondary small mt-1">
                            {[
                              item.recordType,
                              item.issuedBy,
                              formatMonthYear(item.month, item.year)
                            ].filter(Boolean).join(" · ")}
                          </div>

                          {item.description && (
                            <p
                              className="mt-2 mb-0"
                              style={{ whiteSpace: "pre-line" }}
                            >
                              {item.description}
                            </p>
                          )}

                          {item.referenceNumber && (
                            <div className="text-secondary small mt-2">
                              Reference: {item.referenceNumber}
                            </div>
                          )}

                          {item.referenceUrl && (
                            <a
                              href={item.referenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="d-inline-block mt-2 small text-decoration-none"
                            >
                              View link
                              <i className="bi bi-box-arrow-up-right ms-1" />
                            </a>
                          )}

                          {item.file && (
                            <div className="mt-2">
                              <FileChip
                                href={itemFileUrl(experienceId, "records", item)}
                                file={item.file}
                              />
                            </div>
                          )}
                        </div>

                        <div className="btn-group btn-group-sm flex-shrink-0 align-self-start">
                          <Button
                            variant="outline-secondary"
                            title="Edit"
                            onClick={() => openEditRecord(item)}
                          >
                            <i className="bi bi-pencil" />
                          </Button>

                          <Button
                            variant="outline-danger"
                            title="Delete"
                            onClick={() => setDeletingRecord(item)}
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
          </Accordion>
        </>
      )}

      <ExperienceTaskModal
        show={showTaskModal}
        task={editingTask}
        onHide={() => setShowTaskModal(false)}
        onSave={saveTask}
      />

      <Modal
        show={!!deletingTask}
        onHide={() => !deletingBusy && setDeletingTask(null)}
        centered
        backdrop={deletingBusy ? "static" : true}
      >
        <Modal.Header closeButton={!deletingBusy}>
          <Modal.Title>Delete Task?</Modal.Title>
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
            onClick={confirmDelete}
          >
            {deletingBusy ? "Deleting..." : "Delete Task"}
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
          <Modal.Title>Delete Skill?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Are you sure you want to delete{" "}
          <strong>{deletingSkill?.name}</strong> from this experience?
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

      <ExperienceMediaModal
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

      <ExperienceAchievementModal
        show={showAchievementModal}
        achievement={editingAchievement}
        onHide={() => setShowAchievementModal(false)}
        onSave={saveAchievement}
      />

      <Modal
        show={!!deletingAchievement}
        onHide={() => {
          if (!deletingAchievementBusy) setDeletingAchievement(null);
        }}
        centered
        backdrop={deletingAchievementBusy ? "static" : true}
        keyboard={!deletingAchievementBusy}
      >
        <Modal.Header closeButton={!deletingAchievementBusy}>
          <Modal.Title>Delete Achievement?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Are you sure you want to delete{" "}
          <strong>{deletingAchievement?.title}</strong>?
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={deletingAchievementBusy}
            onClick={() => setDeletingAchievement(null)}
          >
            Cancel
          </Button>

          <Button
            variant="danger"
            disabled={deletingAchievementBusy}
            onClick={confirmDeleteAchievement}
          >
            {deletingAchievementBusy
              ? "Deleting..."
              : "Delete Achievement"}
          </Button>
        </Modal.Footer>
      </Modal>

      <ExperienceVolunteeringModal
        show={showVolunteeringModal}
        volunteering={editingVolunteering}
        onHide={() => setShowVolunteeringModal(false)}
        onSave={saveVolunteering}
      />

      <Modal
        show={!!deletingVolunteering}
        onHide={() => {
          if (!deletingVolunteeringBusy) setDeletingVolunteering(null);
        }}
        centered
        backdrop={deletingVolunteeringBusy ? "static" : true}
        keyboard={!deletingVolunteeringBusy}
      >
        <Modal.Header closeButton={!deletingVolunteeringBusy}>
          <Modal.Title>Delete Volunteering?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Are you sure you want to delete the volunteering record for{" "}
          <strong>{deletingVolunteering?.organization}</strong>?
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={deletingVolunteeringBusy}
            onClick={() => setDeletingVolunteering(null)}
          >
            Cancel
          </Button>

          <Button
            variant="danger"
            disabled={deletingVolunteeringBusy}
            onClick={confirmDeleteVolunteering}
          >
            {deletingVolunteeringBusy
              ? "Deleting..."
              : "Delete Volunteering"}
          </Button>
        </Modal.Footer>
      </Modal>

      <ExperienceRecordModal
        show={showRecordModal}
        record={editingRecord}
        onHide={() => setShowRecordModal(false)}
        onSave={saveRecord}
      />

      <Modal
        show={!!deletingRecord}
        onHide={() => {
          if (!deletingRecordBusy) setDeletingRecord(null);
        }}
        centered
        backdrop={deletingRecordBusy ? "static" : true}
        keyboard={!deletingRecordBusy}
      >
        <Modal.Header closeButton={!deletingRecordBusy}>
          <Modal.Title>Delete Record?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Are you sure you want to delete{" "}
          <strong>{deletingRecord?.title}</strong>?
          This action cannot be undone.
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={deletingRecordBusy}
            onClick={() => setDeletingRecord(null)}
          >
            Cancel
          </Button>

          <Button
            variant="danger"
            disabled={deletingRecordBusy}
            onClick={confirmDeleteRecord}
          >
            {deletingRecordBusy ? "Deleting..." : "Delete Record"}
          </Button>
        </Modal.Footer>
      </Modal>

      <ExperienceProjectModal
        show={showProjectModal}
        project={editingProject}
        parent={experience && { ...experience, ongoing: experience.currentlyWorking }}
        onHide={() => setShowProjectModal(false)}
        onSave={saveProject}
      />

      <Modal
        show={!!deletingProject}
        onHide={() => {
          if (!deletingProjectBusy) setDeletingProject(null);
        }}
        centered
        backdrop={deletingProjectBusy ? "static" : true}
        keyboard={!deletingProjectBusy}
      >
        <Modal.Header closeButton={!deletingProjectBusy}>
          <Modal.Title>Delete Project?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Delete <strong>{deletingProject?.title}</strong>?
          This action cannot be undone.
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={deletingProjectBusy}
            onClick={() => setDeletingProject(null)}
          >
            Cancel
          </Button>

          <Button
            variant="danger"
            disabled={deletingProjectBusy}
            onClick={confirmDeleteProject}
          >
            {deletingProjectBusy ? "Deleting..." : "Delete Project"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
