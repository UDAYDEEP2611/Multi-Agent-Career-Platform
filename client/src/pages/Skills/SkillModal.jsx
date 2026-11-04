import { useState } from "react";
import {
  Modal,
  Form,
  Button,
  Alert
} from "react-bootstrap";

import SkillStars from "./SkillStars";
import SkillAutocomplete from "./SkillAutocomplete";
import { SKILL_LEVELS } from "./skillLevels";
import VisibilityToggles from "../Common/VisibilityToggles";

// Important skills are rated 3/5 or higher (mirrors the server)
const MIN_IMPORTANT_RATING = 3;


const emptyForm = {
  name: "",
  rating: 3,
  lastUsedYear: "",
  skillType: "technical",
  isImportant: false
};

export default function SkillModal({
  show,
  skill,
  importantCount,
  importantIds = [],
  maxImportant,
  existingNames,
  onHide,
  onSave
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [position, setPosition] = useState(1);

  // Positions 1..N in the Important list, counting this skill
  const otherImportantIds = importantIds.filter((id) => id !== skill?._id);
  const positionCount = otherImportantIds.length + 1;

  const handleShow = () => {
    // Already important: its current place; otherwise last
    const current = skill ? importantIds.indexOf(skill._id) : -1;
    setPosition(current >= 0 ? current + 1 : importantIds.length + 1);

    setForm(
      skill
        ? {
            name: skill.name,
            rating: skill.rating,
            lastUsedYear: skill.lastUsedYear ?? "",
            skillType: skill.skillType,
            isImportant: skill.isImportant
          }
        : emptyForm
    );

    setError("");
  };

  const importantFull =
    !skill?.isImportant && importantCount >= maxImportant;

  const change = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  // Important skills must stay at 3/5 or higher
  const setRating = (rating) =>
    setForm((previous) => ({
      ...previous,
      rating,
      isImportant: rating >= MIN_IMPORTANT_RATING ? previous.isImportant : false
    }));

  const submit = async (event) => {
    event.preventDefault();

    if (form.isImportant && form.rating < MIN_IMPORTANT_RATING) {
      setError(`Important skills must be rated ${MIN_IMPORTANT_RATING}/5 or higher`);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave(
        {
        name: form.name.trim(),
        rating: form.rating,
        lastUsedYear:
          form.lastUsedYear === "" ? null : Number(form.lastUsedYear),
        skillType: form.skillType,
        isImportant: form.isImportant
        },
        form.isImportant ? Math.min(position, positionCount) : null
      );

      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save skill"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onShow={handleShow}
      onHide={saving ? undefined : onHide}
      centered
      backdrop={saving ? "static" : true}
      keyboard={!saving}
    >
      <Form onSubmit={submit}>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            {skill ? "Edit Skill" : "Add Skill"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {skill?._id && (
            <div className="d-flex align-items-center gap-2 mb-3 small text-secondary">
              Shows on
              <VisibilityToggles section="skills" item={skill} />
            </div>
          )}
          {error && <Alert variant="danger">{error}</Alert>}

          <Form.Group className="mb-3" controlId="skill-name">
            <Form.Label>Skill Name *</Form.Label>
            <SkillAutocomplete
              value={form.name}
              existingNames={existingNames}
              onChange={(name) =>
                setForm((previous) => ({ ...previous, name }))
              }
              onSelect={(selected) =>
                setForm((previous) => ({
                  ...previous,
                  name: selected.name,
                  skillType: selected.skillType
                }))
              }
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="d-block">Rating *</Form.Label>
            <SkillStars
              rating={form.rating}
              onChange={setRating}
              size="fs-4"
            />
            <span className="small text-secondary ms-2">
              {form.rating}/5 · {SKILL_LEVELS[form.rating]}
            </span>
          </Form.Group>

          <div className="row g-3 mb-3">
            <Form.Group className="col-sm-6">
              <Form.Label>Last Used Year</Form.Label>
              <Form.Control
                type="number"
                name="lastUsedYear"
                value={form.lastUsedYear}
                onChange={change}
                min={1950}
                max={new Date().getFullYear()}
                placeholder="YYYY"
              />
            </Form.Group>

            <Form.Group className="col-sm-6">
              <Form.Label>Skill Type</Form.Label>
              <Form.Select
                name="skillType"
                value={form.skillType}
                onChange={change}
              >
                <option value="technical">Technical</option>
                <option value="soft">Soft skill</option>
              </Form.Select>
            </Form.Group>
          </div>

          <div className="border rounded p-3 bg-body-tertiary">
            <Form.Check
              type="switch"
              id="skill-important"
              name="isImportant"
              label={
                <span className="fw-medium">
                  <i className="bi bi-star-fill text-warning me-1" />
                  Top {maxImportant} important skill
                </span>
              }
              checked={form.isImportant}
              onChange={change}
              disabled={form.rating < MIN_IMPORTANT_RATING || importantFull}
            />

            <div className="small text-secondary mt-1">
              {importantFull
                ? `You already have ${maxImportant} important skills. Remove one to add another.`
                : form.rating < MIN_IMPORTANT_RATING
                  ? `Rate this skill ${MIN_IMPORTANT_RATING}/5 or higher to mark it as important.`
                  : `${importantCount}/${maxImportant} important skills used.`}
            </div>

            {form.isImportant && (
              <Form.Group
                className="d-flex align-items-center gap-2 mt-3"
                controlId="skill-important-position"
              >
                <Form.Label className="mb-0 small fw-medium text-nowrap">
                  Position in list
                </Form.Label>

                <Form.Select
                  size="sm"
                  style={{ width: "auto" }}
                  value={Math.min(position, positionCount)}
                  onChange={(event) => setPosition(Number(event.target.value))}
                >
                  {Array.from({ length: positionCount }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                      {i === 0 ? " (first)" : i === positionCount - 1 ? " (last)" : ""}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={saving}
            onClick={onHide}
          >
            Cancel
          </Button>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Skill"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
