import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Accordion, Alert, Button, Card, Spinner } from "react-bootstrap";

import { getProject, updateProject } from "../../api/projectApi";
import { projectStatusColors } from "../Experience/projectStatus";
import ProjectModal from "./ProjectModal";
import ProjectLinkButtons from "./ProjectLinkButtons";
import ProjectSectionPanel from "./ProjectSectionPanel";
import { achievementsConfig, linksConfig } from "./projectSectionConfigs";
import { formatProjectDates } from "./projectOptions";
import EducationProjectTasksSection from "../Education/EducationProjectTasksSection";
import EducationProjectContributorsSection from "../Education/EducationProjectContributorsSection";
import EducationProjectMediaSection from "../Education/EducationProjectMediaSection";
import SkillAssociationSection from "../Skills/SkillAssociationSection";
import useRememberedSections from "../Layout/useRememberedSections";

// Tasks, Contributors and Media reuse the Education project panels:
// educationId={null} points them at /api/projects/:projectId/...
export default function ProjectDetails() {
  const { projectId } = useParams();
  const openSections = useRememberedSections(
    `open-sections:project:${projectId}`,
    ["tasks"]
  );

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let active = true;

    getProject(projectId)
      .then(({ data }) => {
        if (active) setProject(data.project);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load project");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  const saveProject = async (payload) => {
    const { data } = await updateProject(projectId, payload);
    setProject(data.project);
  };

  const backLink = (
    <Link to="/dashboard/projects" className="text-decoration-none">
      <i className="bi bi-arrow-left me-2" />
      Back to Projects
    </Link>
  );

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container-fluid">
        {backLink}
        <Alert variant="danger" className="mt-3">
          {error || "Project not found."}
        </Alert>
      </div>
    );
  }

  const dates = formatProjectDates(project);

  return (
    <div className="container-fluid">
      {backLink}

      <Card className="border-0 shadow-sm my-4">
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div className="d-flex flex-wrap align-items-center gap-1">
              {project.featured && (
                <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle fw-medium">
                  <i className="bi bi-star-fill me-1" />
                  Featured
                </span>
              )}
              <span className="badge rounded-pill text-bg-light border fw-normal">
                {project.projectType}
              </span>
              <span
                className={`badge rounded-pill fw-normal ${
                  projectStatusColors[project.status] || "text-bg-secondary"
                }`}
              >
                {project.status}
              </span>
              <span className="badge rounded-pill text-bg-light border fw-normal">
                <i className={`bi ${project.visibility === "Private" ? "bi-lock-fill" : "bi-globe"} me-1`} />
                {project.visibility}
              </span>
            </div>

            <Button size="sm" variant="outline-secondary" onClick={() => setShowModal(true)}>
              <i className="bi bi-pencil me-1" />
              Edit
            </Button>
          </div>

          <div className="d-flex justify-content-between align-items-baseline flex-wrap column-gap-3 mt-2">
            <h4 className="fw-bold mb-0">{project.title}</h4>
            {dates && <div className="fw-bold">{dates}</div>}
          </div>

          {project.role && <div className="fst-italic">{project.role}</div>}

          <p
            className={`mt-3 mb-0 ${project.description ? "" : "text-secondary"}`}
            style={{ whiteSpace: "pre-line" }}
          >
            {project.description || "No description added."}
          </p>

          <div className="mt-3">
            <ProjectLinkButtons project={project} />
          </div>
        </Card.Body>
      </Card>

      <Accordion alwaysOpen {...openSections} className="mb-3 shadow-sm">
        <EducationProjectTasksSection educationId={null} projectId={projectId} />
        <EducationProjectContributorsSection educationId={null} projectId={projectId} />
        <SkillAssociationSection
          key={projectId}
          sourceType="project"
          sourceId={projectId}
          eventKey="skills"
          title="Skills & Tech Stack"
        />
        <EducationProjectMediaSection educationId={null} projectId={projectId} />
        <ProjectSectionPanel
          key={`achievements-${projectId}`}
          projectId={projectId}
          eventKey="achievements"
          config={achievementsConfig}
        />
        <ProjectSectionPanel
          key={`links-${projectId}`}
          projectId={projectId}
          eventKey="links"
          config={linksConfig}
        />
      </Accordion>

      <ProjectModal
        show={showModal}
        project={project}
        onHide={() => setShowModal(false)}
        onSave={saveProject}
      />
    </div>
  );
}
