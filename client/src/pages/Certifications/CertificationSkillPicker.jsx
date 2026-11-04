import { useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";

import SkillAutocomplete from "../Skills/SkillAutocomplete";
import { SKILL_LEVELS } from "../Skills/skillLevels";
import { normalizeSkillName } from "../Skills/normalizeSkillName";
import { checkSkillName, createUserSkill } from "../../api/userSkillApi";

// Skill pills plus an input. Each name is checked first (spelling, already
// on the Skills page, look-alikes); a new skill is added to the Skills page
// right away, and onAdd({ skillId, name }) puts it on the certification.
export default function CertificationSkillPicker({ skills, disabled, onAdd, onRemove }) {
  const [text, setText] = useState("");
  const [rating, setRating] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // { name, skillType, similar, suggestion, checkedBy } awaiting a choice
  const [review, setReview] = useState(null);

  const chosenNames = skills.map((skill) => normalizeSkillName(skill.name));
  const isChosen = (name) => chosenNames.includes(normalizeSkillName(name));

  const pick = (skill) => {
    if (!isChosen(skill.name)) onAdd({ skillId: skill._id, name: skill.name });
    setText("");
    setReview(null);
  };

  const create = async (name, skillType) => {
    setBusy(true);
    setError("");

    try {
      const { data } = await createUserSkill({ name, rating, skillType });
      pick(data.skill);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to add skill");
    } finally {
      setBusy(false);
    }
  };

  const check = async (rawName, catalogType) => {
    const name = rawName.trim().replace(/\s+/g, " ");
    if (!name || busy) return;

    if (isChosen(name)) {
      setText("");
      return;
    }

    setBusy(true);
    setError("");
    setReview(null);

    let result;

    try {
      ({ data: result } = await checkSkillName(name));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to check skill");
      setBusy(false);
      return;
    }

    setBusy(false);

    const skillType = catalogType || result.skillType;

    if (result.existing) {
      pick(result.existing);
    } else if (result.similar.length > 0 || result.suggestion) {
      setReview({ ...result, name, skillType });
    } else {
      await create(name, skillType);
    }
  };

  const similarToSuggestion =
    review?.suggestion &&
    review.similar.some(
      (skill) => normalizeSkillName(skill.name) === normalizeSkillName(review.suggestion)
    );

  return (
    <>
      {skills.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-2">
          {skills.map((skill) => (
            <span
              key={skill.skillId}
              className="badge rounded-pill bg-primary-subtle text-primary-emphasis border border-primary-subtle fw-medium d-inline-flex align-items-center gap-1 ps-3 pe-2"
              style={{ fontSize: "0.85rem", paddingTop: "0.4rem", paddingBottom: "0.4rem" }}
            >
              {skill.name}
              <button
                type="button"
                className="btn-close ms-1"
                style={{ fontSize: "0.55rem" }}
                disabled={disabled}
                onClick={() => onRemove(skill)}
                aria-label={`Remove ${skill.name}`}
              />
            </span>
          ))}
        </div>
      )}

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")} className="py-2 small">
          {error}
        </Alert>
      )}

      <div className="d-flex gap-2 flex-wrap flex-sm-nowrap">
        <div className="flex-grow-1">
          <SkillAutocomplete
            value={text}
            required={false}
            disabled={disabled || busy}
            existingNames={chosenNames}
            onChange={(value) => {
              setText(value);
              setReview(null);
            }}
            onSelect={(selected) => {
              setText(selected.name);
              check(selected.name, selected.skillType);
            }}
            onEnter={() => check(text)}
          />
        </div>

        <Form.Select
          size="sm"
          style={{ width: "auto" }}
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          disabled={disabled || busy}
          aria-label="Level for a new skill"
          title="Level used if this skill is new to your Skills page"
        >
          {[1, 2, 3, 4, 5].map((level) => (
            <option key={level} value={level}>
              {SKILL_LEVELS[level]}
            </option>
          ))}
        </Form.Select>

        <Button
          variant="outline-primary"
          className="flex-shrink-0"
          disabled={!text.trim() || disabled || busy}
          onClick={() => check(text)}
        >
          {busy ? (
            "Checking..."
          ) : (
            <>
              <i className="bi bi-plus-lg me-1" />
              Add skill
            </>
          )}
        </Button>
      </div>

      {review && (
        <div className="border rounded p-3 mt-2 bg-warning-subtle">
          <div className="small fw-medium mb-2">
            <i className={`bi ${review.checkedBy === "ai" ? "bi-stars" : "bi-spellcheck"} me-1`} />
            {review.similar.length > 0
              ? `“${review.name}” looks like a skill you already have.`
              : `Did you mean “${review.suggestion}”?`}
          </div>

          <div className="d-flex flex-wrap gap-2">
            {review.similar.map((skill) => (
              <Button key={skill._id} size="sm" onClick={() => pick(skill)}>
                Use {skill.name}
                <span className="opacity-75"> (in your Skills)</span>
              </Button>
            ))}

            {review.suggestion && !similarToSuggestion && (
              <Button
                size="sm"
                variant={review.similar.length ? "outline-primary" : "primary"}
                disabled={busy}
                onClick={() => create(review.suggestion, review.skillType)}
              >
                Add “{review.suggestion}”
              </Button>
            )}

            <Button
              size="sm"
              variant="outline-secondary"
              disabled={busy}
              onClick={() => create(review.name, review.skillType)}
            >
              Keep “{review.name}”
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
