import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Accordion,
  Alert,
  Card,
  Spinner
} from "react-bootstrap";

import { getEducation } from "../../api/educationApi";
import EducationTasksSection from "./EducationTasksSection";
import EducationSkillsSection from "./EducationSkillsSection";
import EducationCoursesSection from "./EducationCoursesSection";
import EducationEntriesSection from "./EducationEntriesSection";
import {
  getEducationAchievements,
  createEducationAchievement,
  updateEducationAchievement,
  deleteEducationAchievement,
  getEducationCertifications,
  createEducationCertification,
  updateEducationCertification,
  deleteEducationCertification
} from "../../api/educationAchievementApi";
import EducationVolunteeringSection from "./EducationVolunteeringSection";
import EducationMediaSection from "./EducationMediaSection";
import EducationProjectsSection from "./EducationProjectsSection";
import useRememberedSections from "../Layout/useRememberedSections";
import SkillAssociationSection from "../Skills/SkillAssociationSection";
import { MAX_ITEMS } from "../../limits";

const shortMonths = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const formatMonthYear = (month, year) =>
  year ? `${month ? shortMonths[month - 1] + " " : ""}${year}` : "";

const achievementsConfig = {
  title: "Activities & Achievements",
  itemLabel: "Achievement",
  types: ["Achievement", "Activity", "Competition", "Leadership", "Other"],
  titlePlaceholder: "Title",
  emptyText: "No activities or achievements added yet.",
  maxItems: MAX_ITEMS.achievements,
  listKey: "achievements",
  itemKey: "achievement",
  api: {
    getAll: getEducationAchievements,
    create: createEducationAchievement,
    update: updateEducationAchievement,
    remove: deleteEducationAchievement
  }
};

const certificationsConfig = {
  title: "Certifications & Honors",
  itemLabel: "Certification / Honor",
  types: ["Certification", "Honor", "Award", "Scholarship", "Other"],
  titlePlaceholder: "Title",
  emptyText: "No certifications or honors added yet.",
  listKey: "certifications",
  itemKey: "certification",
  api: {
    getAll: getEducationCertifications,
    create: createEducationCertification,
    update: updateEducationCertification,
    remove: deleteEducationCertification
  }
};

export default function EducationDetails() {
  const { educationId } = useParams();
  const openSections = useRememberedSections(
    `open-sections:education:${educationId}`,
    ["tasks"]
  );

  const [education, setEducation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getEducation(educationId)
      .then(({ data }) => {
        if (active) setEducation(data.education);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load education"
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

  const backLink = (
    <Link
      to="/dashboard/education"
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

  if (error || !education) {
    return (
      <div className="container-fluid">
        {backLink}
        <Alert variant="danger" className="mt-3">
          {error || "Education not found."}
        </Alert>
      </div>
    );
  }

  const start = formatMonthYear(education.startMonth, education.startYear);
  const end = education.currentlyStudying
    ? "Present"
    : formatMonthYear(education.endMonth, education.endYear);

  return (
    <div className="container-fluid">
      {backLink}

      <Card className="border-0 shadow-sm my-4">
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-baseline flex-wrap column-gap-3">
            <h5 className="fw-bold mb-0">{education.institution}</h5>

            {(start || end) && (
              <div className="fw-bold">
                {[start, end].filter(Boolean).join(" – ")}
              </div>
            )}
          </div>

          <div className="d-flex justify-content-between align-items-baseline flex-wrap column-gap-3 fst-italic">
            <div>
              {education.degree}
              {education.fieldOfStudy && ` · ${education.fieldOfStudy}`}
            </div>

            {education.location && <div>{education.location}</div>}
          </div>

          {education.grade && (
            <div className="mt-2">GPA / Grade: {education.grade}</div>
          )}

          {education.description && (
            <p className="mt-3 mb-0" style={{ whiteSpace: "pre-line" }}>
              {education.description}
            </p>
          )}
        </Card.Body>
      </Card>

      <Accordion alwaysOpen {...openSections} className="mb-3 shadow-sm">
        <EducationTasksSection educationId={educationId} />
        <EducationSkillsSection educationId={educationId} />
        <SkillAssociationSection
          key={educationId}
          sourceType="education"
          sourceId={educationId}
        />
        <EducationCoursesSection educationId={educationId} />
        <EducationEntriesSection
          educationId={educationId}
          eventKey="achievements"
          config={achievementsConfig}
        />
        <EducationEntriesSection
          educationId={educationId}
          eventKey="certifications"
          config={certificationsConfig}
        />
        <EducationVolunteeringSection educationId={educationId} />
        <EducationMediaSection educationId={educationId} />
        <EducationProjectsSection education={education} />

      </Accordion>
    </div>
  );
}
