import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Accordion,
  Alert,
  Button,
  Form,
  Spinner
} from "react-bootstrap";

import { getUserSkills } from "../../api/userSkillApi";
import {
  getSourceSkills,
  createSkillAssociation,
  deleteSkillAssociation
} from "../../api/skillAssociationApi";
import { SKILL_LEVELS } from "./skillLevels";

// Accordion panel that links master skills (Skills page) to one record.
// Linking never creates or deletes the master skill itself.
// sourceType: experience | education | experience_project | education_project
export default function SkillAssociationSection({
  sourceType,
  sourceId,
  eventKey = "linkedSkills",
  title = "Linked Profile Skills"
}) {
  const [allSkills, setAllSkills] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [selectedSkillId, setSelectedSkillId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([getUserSkills(), getSourceSkills(sourceType, sourceId)])
      .then(([skillsResponse, linksResponse]) => {
        if (!active) return;
        setAllSkills(skillsResponse.data.skills || []);
        setAssociations(linksResponse.data.associations || []);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load linked skills"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sourceType, sourceId]);

  const linkedIds = new Set(associations.map((item) => item.skillId._id));
  const available = allSkills.filter((skill) => !linkedIds.has(skill._id));
  const availableImportant = available.filter((skill) => skill.isImportant);
  const availableOther = available.filter((skill) => !skill.isImportant);

  const addLink = async () => {
    if (!selectedSkillId) return;

    setSaving(true);
    setError("");

    try {
      const { data } = await createSkillAssociation({
        skillId: selectedSkillId,
        sourceType,
        sourceId
      });

      setAssociations((previous) => [...previous, data.association]);
      setSelectedSkillId("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to link skill"
      );
    } finally {
      setSaving(false);
    }
  };

  const removeLink = async (associationId) => {
    setSaving(true);
    setError("");

    try {
      await deleteSkillAssociation(associationId);

      setAssociations((previous) =>
        previous.filter((item) => item._id !== associationId)
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to remove linked skill"
      );
    } finally {
      setSaving(false);
    }
  };

  const option = (skill) => (
    <option key={skill._id} value={skill._id}>
      {skill.name} ({SKILL_LEVELS[skill.rating]})
    </option>
  );

  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header>
        <span className="fw-semibold">{title}</span>
        <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
          {loading ? "…" : associations.length}
        </span>
      </Accordion.Header>

      <Accordion.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-3">
            <Spinner animation="border" size="sm" />
          </div>
        ) : allSkills.length === 0 ? (
          <p className="text-secondary mb-0">
            Your Skills list is empty.{" "}
            <Link to="/dashboard/skills">Add skills</Link> first, then link
            them here.
          </p>
        ) : (
          <>
            <p className="small text-secondary mb-2">
              <i className="bi bi-info-circle me-1" />
              Pick from the skills on your{" "}
              <Link to="/dashboard/skills">Skills</Link> page. Linking doesn't
              add a second copy of the skill.
            </p>

            <div className="d-flex gap-2 mb-3">
              <Form.Select
                value={selectedSkillId}
                onChange={(event) => setSelectedSkillId(event.target.value)}
                disabled={saving || available.length === 0}
                aria-label="Skill to link"
              >
                <option value="">
                  {available.length === 0
                    ? "All your skills are linked"
                    : "Select a skill"}
                </option>

                {availableImportant.length > 0 && (
                  <optgroup label="Important">
                    {availableImportant.map(option)}
                  </optgroup>
                )}

                {availableOther.length > 0 && (
                  <optgroup label="Other skills">
                    {availableOther.map(option)}
                  </optgroup>
                )}
              </Form.Select>

              <Button
                className="flex-shrink-0"
                disabled={!selectedSkillId || saving}
                onClick={addLink}
              >
                <i className="bi bi-link-45deg me-1" />
                Link
              </Button>
            </div>

            {associations.length === 0 ? (
              <p className="text-secondary mb-0">No linked skills yet.</p>
            ) : (
              <div className="d-flex flex-wrap gap-2">
                {associations.map((item) => (
                  <span
                    key={item._id}
                    className="badge rounded-pill bg-primary-subtle text-primary-emphasis border border-primary-subtle fw-medium d-inline-flex align-items-center gap-1 py-2 px-3"
                  >
                    {item.skillId.isImportant && (
                      <i className="bi bi-star-fill text-warning" />
                    )}
                    {item.skillId.name}
                    <span className="fw-normal opacity-75">
                      ({SKILL_LEVELS[item.skillId.rating]})
                    </span>

                    <button
                      type="button"
                      className="btn-close ms-1"
                      style={{ fontSize: "0.6rem" }}
                      disabled={saving}
                      onClick={() => removeLink(item._id)}
                      aria-label={`Unlink ${item.skillId.name}`}
                      title="Unlink"
                    />
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </Accordion.Body>
    </Accordion.Item>
  );
}
