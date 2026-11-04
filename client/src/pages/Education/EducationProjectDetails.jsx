import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Accordion,
  Alert,
  Card,
  Spinner
} from "react-bootstrap";

import { getEducationProject } from "../../api/educationProjectApi";
import { projectStatusColors } from "../Experience/projectStatus";
import EducationProjectTasksSection from "./EducationProjectTasksSection";
import EducationProjectContributorsSection from "./EducationProjectContributorsSection";
import EducationProjectSkillsSection from "./EducationProjectSkillsSection";
import EducationProjectMediaSection from "./EducationProjectMediaSection";
import useRememberedSections from "../Layout/useRememberedSections";
import SkillAssociationSection from "../Skills/SkillAssociationSection";

const shortMonths = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const formatMonthYear = (month, year) =>
  year ? `${month ? shortMonths[month - 1] + " " : ""}${year}` : "";

export default function EducationProjectDetails() {
  const { educationId, projectId } = useParams();
  const openSections = useRememberedSections(
    `open-sections:education-project:${projectId}`,
    ["tasks"]
  );

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getEducationProject(educationId, projectId)
      .then(({ data }) => {
        if (active) setProject(data.project);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load project"
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

  const backLink = (
    <Link
      to={`/dashboard/education/${educationId}`}
      className="text-decoration-none"
    >
      <i className="bi bi-arrow-left me-2" />
      Back to Education
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

  const start = formatMonthYear(project.startMonth, project.startYear);
  const end = formatMonthYear(project.endMonth, project.endYear);

  return (
    <div className="container-fluid">
      {backLink}

      <Card className="border-0 shadow-sm my-4">
        <Card.Body className="p-4">
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
        </Card.Body>
      </Card>

      <Accordion alwaysOpen {...openSections} className="mb-3 shadow-sm">
        <EducationProjectTasksSection
          educationId={educationId}
          projectId={projectId}
        />
        <EducationProjectContributorsSection
          educationId={educationId}
          projectId={projectId}
        />
        <EducationProjectSkillsSection
          educationId={educationId}
          projectId={projectId}
        />
        <SkillAssociationSection
          key={projectId}
          sourceType="education_project"
          sourceId={projectId}
        />
        <EducationProjectMediaSection
          educationId={educationId}
          projectId={projectId}
        />
      </Accordion>
    </div>
  );
}
