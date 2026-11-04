import { Badge, Button, Card, Form } from "react-bootstrap";
import { EXTRA_SECTIONS } from "./resumeTemplates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatDate = (date) => (date ? `${date.month ? `${MONTHS[date.month - 1]} ` : ""}${date.year}` : "");
const range = (item) =>
  [formatDate(item.start), item.current ? "Present" : formatDate(item.end)].filter(Boolean).join(" – ");

// One section: an include switch, select all / none, and a checkbox per item
function SectionCard({ title, icon, sectionKey, idsKey, items, describe, selection, onChange, children }) {
  const on = selection.sections[sectionKey];
  const chosen = idsKey ? selection[idsKey] : [];

  const setSection = (value) =>
    onChange({ ...selection, sections: { ...selection.sections, [sectionKey]: value } });
  const setIds = (ids) => onChange({ ...selection, [idsKey]: ids });
  const toggle = (id) => setIds(chosen.includes(id) ? chosen.filter((item) => item !== id) : [...chosen, id]);

  return (
    <Card className={`shadow-sm mb-3 ${on ? "" : "opacity-75"}`}>
      <Card.Header className="bg-white d-flex flex-wrap align-items-center gap-2 py-3">
        <i className={`bi ${icon} text-primary`} aria-hidden="true" />
        <span className="fw-semibold">{title}</span>
        {idsKey && (
          <Badge bg="light" text="dark" className="fw-normal">
            {chosen.length} of {items.length} selected
          </Badge>
        )}
        <Form.Check
          type="switch"
          id={`include-${sectionKey}`}
          className="ms-auto mb-0"
          label="Include"
          checked={on}
          onChange={(e) => setSection(e.target.checked)}
        />
      </Card.Header>

      {on && (
        <Card.Body>
          {children}

          {idsKey && items.length === 0 && (
            <p className="text-muted small mb-0">Nothing added yet in this section.</p>
          )}

          {idsKey && items.length > 0 && (
            <>
              <div className="d-flex gap-2 mb-2">
                <Button size="sm" variant="link" className="p-0" onClick={() => setIds(items.map((item) => item.id))}>
                  Select all
                </Button>
                <span className="text-muted">·</span>
                <Button size="sm" variant="link" className="p-0" onClick={() => setIds([])}>
                  Select none
                </Button>
              </div>

              {items.map((item) => (
                <Form.Check
                  key={item.id}
                  id={`pick-${item.id}`}
                  className="resume-pick"
                  checked={chosen.includes(item.id)}
                  onChange={() => toggle(item.id)}
                  label={describe(item)}
                />
              ))}
            </>
          )}
        </Card.Body>
      )}
    </Card>
  );
}

function SkillPicker({ skills, selection, onChange }) {
  const chosen = selection.skillIds;
  const toggle = (id) =>
    onChange({ ...selection, skillIds: chosen.includes(id) ? chosen.filter((item) => item !== id) : [...chosen, id] });

  const groups = [
    ["Technical", skills.filter((skill) => skill.skillType !== "soft")],
    ["Soft skills", skills.filter((skill) => skill.skillType === "soft")]
  ].filter(([, list]) => list.length);

  return groups.map(([label, list]) => (
    <div key={label} className="mb-3">
      <div className="small text-muted mb-2">{label}</div>
      <div className="d-flex flex-wrap gap-2">
        {list.map((skill) => {
          const active = chosen.includes(skill.id);
          return (
            <Button
              key={skill.id}
              size="sm"
              variant={active ? "primary" : "outline-secondary"}
              className="rounded-pill"
              onClick={() => toggle(skill.id)}
              aria-pressed={active}
            >
              {active && <i className="bi bi-check2 me-1" aria-hidden="true" />}
              {skill.name}
              {skill.isImportant && <i className="bi bi-star-fill ms-1 small" aria-hidden="true" />}
            </Button>
          );
        })}
      </div>
    </div>
  ));
}

// Buttons for adding the optional sections that have something in them
function AddSections({ sources, selection, onChange }) {
  const available = EXTRA_SECTIONS.filter((section) => sources[section.key]?.length);
  const missing = EXTRA_SECTIONS.filter((section) => !sources[section.key]?.length);

  const toggle = (key) =>
    onChange({ ...selection, sections: { ...selection.sections, [key]: !selection.sections[key] } });

  return (
    <Card className="shadow-sm mb-3 border-dashed">
      <Card.Body>
        <div className="fw-semibold mb-1">
          <i className="bi bi-plus-square text-primary me-2" aria-hidden="true" />Add more sections
        </div>
        <p className="small text-muted mb-2">Pick a section, then choose which items go in it.</p>

        <div className="d-flex flex-wrap gap-2">
          {available.map((section) => {
            const on = selection.sections[section.key];
            return (
              <Button
                key={section.key}
                size="sm"
                variant={on ? "primary" : "outline-primary"}
                onClick={() => toggle(section.key)}
                aria-pressed={on}
              >
                <i className={`bi ${on ? "bi-check2" : "bi-plus"} me-1`} aria-hidden="true" />
                {section.title}
                <Badge bg={on ? "light" : "primary"} text={on ? "primary" : undefined} className="ms-2">
                  {sources[section.key].length}
                </Badge>
              </Button>
            );
          })}
          {available.length === 0 && (
            <span className="small text-muted">Nothing to add yet.</span>
          )}
        </div>

        {missing.length > 0 && (
          <div className="small text-muted mt-2">
            Empty in your portfolio: {missing.map((section) => section.title).join(", ")}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

const extraDescribe = (item) =>
  itemLabel(item.title, [item.subtitle, formatDate(item.date) || range(item)].filter(Boolean).join(" · "));

const itemLabel = (title, subtitle) => (
  <span>
    <span className="fw-medium">{title}</span>
    {subtitle && <span className="d-block small text-muted">{subtitle}</span>}
  </span>
);

export default function ResumeSelector({ sources, selection, onChange }) {
  return (
    <>
      <SectionCard
        title="Professional Summary"
        icon="bi-card-text"
        sectionKey="summary"
        selection={selection}
        onChange={onChange}
      >
        {sources.summary ? (
          <p className="small text-muted mb-0 resume-summary-preview">{sources.summary}</p>
        ) : (
          <p className="small text-muted mb-0">
            You haven't written a summary yet. With AI on, one is written from your experience and skills.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Experience"
        icon="bi-briefcase"
        sectionKey="experience"
        idsKey="experienceIds"
        items={sources.experiences}
        describe={(item) => itemLabel(`${item.title} · ${item.organization}`, `${range(item)} · ${item.bullets.length} bullet points`)}
        selection={selection}
        onChange={onChange}
      />

      <SectionCard
        title="Projects"
        icon="bi-folder"
        sectionKey="projects"
        idsKey="projectIds"
        items={sources.projects}
        describe={(item) => itemLabel(item.title, range(item))}
        selection={selection}
        onChange={onChange}
      />

      <SectionCard
        title="Education"
        icon="bi-mortarboard"
        sectionKey="education"
        idsKey="educationIds"
        items={sources.educations}
        describe={(item) =>
          itemLabel(
            [item.degree, item.fieldOfStudy].filter(Boolean).join(", ") || item.institution,
            [item.institution, range(item)].filter(Boolean).join(" · ")
          )}
        selection={selection}
        onChange={onChange}
      />

      <SectionCard
        title="Skills"
        icon="bi-lightning"
        sectionKey="skills"
        selection={selection}
        onChange={onChange}
      >
        {sources.skills.length ? (
          <>
            <p className="small text-muted">
              {selection.skillIds.length} of {sources.skills.length} selected. Pick the skills that fit the job; 10–25 is a good range.
            </p>
            <SkillPicker skills={sources.skills} selection={selection} onChange={onChange} />
          </>
        ) : (
          <p className="text-muted small mb-0">Nothing added yet in this section.</p>
        )}
      </SectionCard>

      <AddSections sources={sources} selection={selection} onChange={onChange} />

      {EXTRA_SECTIONS.filter((section) => selection.sections[section.key]).map((section) => (
        <SectionCard
          key={section.key}
          title={section.title}
          icon={section.icon}
          sectionKey={section.key}
          idsKey={section.idsKey}
          items={sources[section.key]}
          describe={extraDescribe}
          selection={selection}
          onChange={onChange}
        />
      ))}
    </>
  );
}
