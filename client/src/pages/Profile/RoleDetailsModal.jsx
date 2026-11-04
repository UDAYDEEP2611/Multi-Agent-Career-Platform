import { useState } from "react";
import { Modal, Button, Form, Alert, Spinner } from "react-bootstrap";

import { ChoiceChips, ChoiceTiles, ListInput } from "./RoleChips";
import RoleSummary from "./RoleSummary";
import {
  EMPLOYMENT_TYPES, INDUSTRIES, ROLE_LIMITS, SERVICES, WORKPLACE_TYPES, emptyRoleDetails
} from "./roleOptions";
import { POPULAR_LOCATIONS, US_LOCATIONS } from "./usLocations";

const WORKPLACE_TILES = [
  { value: "On-site", icon: "bi-building", text: "At the office" },
  { value: "Hybrid", icon: "bi-arrow-left-right", text: "A mix of both" },
  { value: "Remote", icon: "bi-house-door", text: "From anywhere" }
].filter((tile) => WORKPLACE_TYPES.includes(tile.value));

// The parts of the form, counted by the progress bar
const PARTS = ["headline", "targetRoles", "industries", "employmentTypes", "workplaceTypes", "services", "locations"];

// One part of the form: an icon, a title, a hint, and a count or a tick when filled
function Section({ id, icon, tone, title, hint, count, filled, children }) {
  return (
    <section className={`role-section role-tone-${tone}`}>
      <header className="role-section-head">
        <span className="role-section-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span>
        <div className="flex-grow-1 min-w-0">
          {id
            ? <label htmlFor={id} className="role-section-title">{title}</label>
            : <h3 className="role-section-title">{title}</h3>}
          {hint && <p className="role-section-hint">{hint}</p>}
        </div>
        {count && <span className={`role-count ${filled ? "is-filled" : ""}`}>{count}</span>}
        {!count && filled && <i className="bi bi-check-circle-fill role-filled" aria-label="Filled" />}
      </header>
      {children}
    </section>
  );
}

// A numbered heading over a group of sections
function Group({ number, title, children }) {
  return (
    <div className="role-group">
      <h2 className="role-group-title"><span>{number}</span>{title}</h2>
      {children}
    </div>
  );
}

export default function RoleDetailsModal({ show, onHide, roleDetails, onSave }) {
  const [form, setForm] = useState(emptyRoleDetails);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm({ ...emptyRoleDetails, ...(roleDetails || {}) });
    setError("");
  };

  const set = (name) => (value) => setForm((previous) => ({ ...previous, [name]: value }));
  const filled = (name) => (Array.isArray(form[name]) ? form[name].length > 0 : Boolean(form[name]?.trim()));
  const done = PARTS.filter(filled).length;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onSave(form);
      onHide();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to save role details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onShow={handleShow}
      onHide={saving ? undefined : onHide}
      size="lg"
      centered
      scrollable
      backdrop={saving ? "static" : true}
      keyboard={!saving}
      contentClassName="role-modal"
    >
      <Form onSubmit={handleSubmit} className="d-flex flex-column overflow-hidden">
        <Modal.Header closeButton={!saving} closeVariant="white" className="role-hero">
          <div className="role-hero-body">
            <span className="role-hero-icon"><i className="bi bi-briefcase-fill" aria-hidden="true" /></span>
            <div className="min-w-0 flex-grow-1">
              <Modal.Title as="h2" className="role-hero-title">Your job preferences</Modal.Title>
              <p className="role-hero-text">
                The roles, job types, places and industries you're open to, so recommendations fit what you want.
              </p>
              <div className="role-progress">
                <div
                  className="role-progress-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={PARTS.length}
                  aria-valuenow={done}
                  aria-label="Parts filled"
                >
                  <span style={{ width: `${(done / PARTS.length) * 100}%` }} />
                </div>
                <span>{done}/{PARTS.length} filled</span>
              </div>
            </div>
          </div>
        </Modal.Header>

        <Modal.Body className="role-body">
          {error && <Alert variant="danger">{error}</Alert>}

          <Group number="1" title="What you're looking for">
            <Section
              id="role-headline"
              icon="bi-type"
              tone="blue"
              title="Headline"
              hint="One line about what you do."
              count={`${form.headline.length}/${ROLE_LIMITS.maxHeadlineLength}`}
              filled={filled("headline")}
            >
              <Form.Control
                id="role-headline"
                className="role-text"
                value={form.headline}
                onChange={(event) => set("headline")(event.target.value)}
                maxLength={ROLE_LIMITS.maxHeadlineLength}
                placeholder="e.g. AI/ML Engineer building LLM agents and RAG systems"
              />
            </Section>

            <Section
              id="role-titles"
              icon="bi-bullseye"
              tone="blue"
              title="Roles you're targeting"
              hint="The job titles you want next."
              count={`${form.targetRoles.length}/${ROLE_LIMITS.maxRoles}`}
              filled={filled("targetRoles")}
            >
              <ListInput
                id="role-titles"
                icon="bi-search"
                values={form.targetRoles}
                onChange={set("targetRoles")}
                max={ROLE_LIMITS.maxRoles}
                maxLength={ROLE_LIMITS.maxRoleLength}
                placeholder="e.g. Generative AI Engineer"
                joiner="or"
              />
            </Section>

            <Section
              icon="bi-buildings"
              tone="blue"
              title="Industries"
              hint="Fields you'd like to work in."
              count={`${form.industries.length}/${ROLE_LIMITS.maxIndustries}`}
              filled={filled("industries")}
            >
              <ChoiceChips
                label="Industries"
                choices={INDUSTRIES}
                values={form.industries}
                onChange={set("industries")}
                max={ROLE_LIMITS.maxIndustries}
              />
            </Section>
          </Group>

          <Group number="2" title="How you'd like to work">
            <Section
              icon="bi-file-earmark-text"
              tone="violet"
              title="Open to"
              hint="Every kind of employment you'd consider."
              filled={filled("employmentTypes")}
            >
              <ChoiceChips
                label="Employment types"
                choices={EMPLOYMENT_TYPES}
                values={form.employmentTypes}
                onChange={set("employmentTypes")}
              />
            </Section>

            <Section
              icon="bi-laptop"
              tone="violet"
              title="Workplace"
              hint="Pick all that work for you."
              filled={filled("workplaceTypes")}
            >
              <ChoiceTiles
                label="Workplace types"
                tiles={WORKPLACE_TILES}
                values={form.workplaceTypes}
                onChange={set("workplaceTypes")}
              />
            </Section>

            <Section
              icon="bi-stars"
              tone="violet"
              title="Services you offer"
              hint="Work you're open to outside a regular job."
              filled={filled("services")}
            >
              <ChoiceChips
                label="Services"
                choices={SERVICES}
                values={form.services}
                onChange={set("services")}
              />
            </Section>
          </Group>

          <Group number="3" title="Where">
            <Section
              id="role-locations"
              icon="bi-geo-alt"
              tone="green"
              title="Locations"
              hint="Top US cities and states, or type any other place."
              count={`${form.locations.length}/${ROLE_LIMITS.maxLocations}`}
              filled={filled("locations")}
            >
              <ListInput
                id="role-locations"
                icon="bi-geo-alt"
                values={form.locations}
                onChange={set("locations")}
                max={ROLE_LIMITS.maxLocations}
                maxLength={ROLE_LIMITS.maxLocationLength}
                placeholder="Start typing a city or state"
                suggestions={US_LOCATIONS}
                quickPicks={POPULAR_LOCATIONS}
              />
            </Section>
          </Group>

          {done > 0 && (
            <div className="role-preview">
              <p className="role-preview-label"><i className="bi bi-eye" aria-hidden="true" /> Preview on your profile</p>
              <RoleSummary roles={form} />
            </div>
          )}
        </Modal.Body>

        <Modal.Footer className="role-footer">
          <Button variant="link" className="text-secondary text-decoration-none" onClick={onHide} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" className="role-save" disabled={saving}>
            {saving ? (
              <><Spinner size="sm" className="me-2" />Saving...</>
            ) : (
              <><i className="bi bi-check2 me-1" aria-hidden="true" />Save preferences</>
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
