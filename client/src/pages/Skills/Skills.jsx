import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Modal,
  Nav,
  ProgressBar,
  Spinner,
  Tab
} from "react-bootstrap";

import SkillModal from "./SkillModal";
import { normalizeSkillName } from "./normalizeSkillName";
import { SKILL_LEVELS } from "./skillLevels";

import {
  getUserSkills,
  createUserSkill,
  updateUserSkill,
  deleteUserSkill,
  reorderSkills
} from "../../api/userSkillApi";

// Fallbacks until the server sends its limits
const DEFAULT_LIMITS = { maxSkills: 120, maxImportant: 50 };

const TAB_STORAGE_KEY = "skills-tab";

// The first 15 important skills, in the user's order, are the very important
// ones: the key skills on the resumes
const VERY_IMPORTANT = 15;

// The user's order first (unplaced skills after), then highest rating,
// then most recently used
const sortSkills = (a, b) =>
  (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) ||
  b.rating - a.rating ||
  (b.lastUsedYear ?? 0) - (a.lastUsedYear ?? 0) ||
  a.name.localeCompare(b.name);

// Each skill is in exactly one tab: important ones in Important, the rest
// by type
const TABS = [
  {
    key: "important",
    label: "Important",
    icon: "bi-star-fill",
    matches: (skill) => skill.isImportant
  },
  {
    key: "technical",
    label: "Technical",
    icon: "bi-code-slash",
    matches: (skill) => !skill.isImportant && skill.skillType !== "soft"
  },
  {
    key: "soft",
    label: "Soft skills",
    icon: "bi-people",
    matches: (skill) => !skill.isImportant && skill.skillType === "soft"
  }
];

function readSavedTab() {
  try {
    const saved = sessionStorage.getItem(TAB_STORAGE_KEY);
    return TABS.some((tab) => tab.key === saved) ? saved : "important";
  } catch {
    return "important";
  }
}

export default function Skills() {
  const [skills, setSkills] = useState([]);
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState(readSavedTab);
  const [search, setSearch] = useState("");
  const [reordering, setReordering] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getUserSkills()
      .then(({ data }) => {
        if (!active) return;
        setSkills(data.skills || []);
        if (data.limits) setLimits(data.limits);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load skills"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const byTab = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((tab) => [
          tab.key,
          skills.filter(tab.matches).sort(sortSkills)
        ])
      ),
    [skills]
  );

  const query = search.trim().toLowerCase();
  const visible = byTab[activeTab].filter((skill) =>
    skill.name.toLowerCase().includes(query)
  );

  const importantCount = byTab.important.length;
  const full = skills.length >= limits.maxSkills;

  // Names already in the profile (except the one being edited)
  const existingNames = skills
    .filter((skill) => skill._id !== editing?._id)
    .map((skill) => normalizeSkillName(skill.name));

  // Moves a skill in the current tab one place left (-1) or right (+1)
  // and saves the tab's new order
  const moveSkill = async (index, step) => {
    const ordered = [...byTab[activeTab]];
    const target = index + step;

    if (target < 0 || target >= ordered.length) return;

    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];

    const previous = skills;
    const positions = new Map(ordered.map((skill, i) => [skill._id, i]));

    setSkills((current) =>
      current.map((skill) =>
        positions.has(skill._id)
          ? { ...skill, sortOrder: positions.get(skill._id) }
          : skill
      )
    );
    setSavingOrder(true);

    try {
      await reorderSkills(activeTab, ordered.map((skill) => skill._id));
      setError("");
    } catch (err) {
      setSkills(previous);
      setError(
        err.response?.data?.message ||
        "Unable to save the new order"
      );
    } finally {
      setSavingOrder(false);
    }
  };

  const selectTab = (key) => {
    setActiveTab(key);
    setReordering(false);

    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, key);
    } catch {
      // Remembering the tab is optional
    }
  };

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (skill) => {
    setEditing(skill);
    setShowModal(true);
  };

  // position: 1-based place in the Important list, or null
  const saveSkill = async (payload, position) => {
    const { data } = editing
      ? await updateUserSkill(editing._id, payload)
      : await createUserSkill(payload);

    const saved = data.skill;

    let next = editing
      ? skills.map((skill) => (skill._id === saved._id ? saved : skill))
      : [...skills, saved];


    setError("");

    if (saved.isImportant && position) {
      const others = byTab.important
        .map((skill) => skill._id)
        .filter((id) => id !== saved._id);
      const ordered = [...others];
      ordered.splice(position - 1, 0, saved._id);

      try {
        await reorderSkills("important", ordered);

        const places = new Map(ordered.map((id, index) => [id, index]));
        next = next.map((skill) =>
          places.has(skill._id)
            ? { ...skill, sortOrder: places.get(skill._id) }
            : skill
        );
      } catch (err) {
        // The skill itself is saved; only its position failed
        setError(
          err.response?.data?.message ||
          "Skill saved, but its position couldn't be set. Use Reorder to move it."
        );
      }
    }

    setSkills(next);
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteUserSkill(deleting._id);

      setSkills((previous) =>
        previous.filter((skill) => skill._id !== deleting._id)
      );

      setDeleting(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete skill"
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  const emptyText = () => {
    if (query) return "No matching skills found.";

    if (activeTab === "important") {
      return `No important skills yet. Edit a skill rated 3/5 or higher and turn on "Top ${limits.maxImportant} important skill".`;
    }

    return activeTab === "soft"
      ? "No soft skills yet."
      : "No technical skills yet.";
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="fw-bold mb-1">Skills</h1>
          <p className="text-secondary mb-0">
            Manage your technical and soft skills.
          </p>
        </div>

        <Button onClick={openAdd} disabled={full}>
          <i className="bi bi-plus-lg me-2" />
          Add Skill
        </Button>
      </div>

      {error && (
        <Alert
          variant="danger"
          dismissible
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : skills.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 px-4">
            <div
              className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 72, height: 72 }}
            >
              <i className="bi bi-lightning-charge-fill fs-2" />
            </div>

            <h5 className="fw-semibold mb-2">No skills added yet</h5>

            <p
              className="text-secondary mx-auto mb-4"
              style={{ maxWidth: 420 }}
            >
              Add up to {limits.maxSkills} skills, rate each one, and pick
              your top {limits.maxImportant} to highlight.
            </p>

            <Button onClick={openAdd} className="px-4">
              <i className="bi bi-plus-lg me-2" />
              Add Your First Skill
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between small mb-2">
                <span className="fw-semibold">Skills added</span>
                <span className={full ? "text-danger" : "text-secondary"}>
                  {skills.length}/{limits.maxSkills}
                </span>
              </div>

              <ProgressBar
                now={(skills.length / limits.maxSkills) * 100}
                variant={full ? "danger" : "primary"}
                style={{ height: 6 }}
              />
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm">
            <Tab.Container activeKey={activeTab} onSelect={selectTab}>
              <Card.Header className="bg-body border-bottom-0 pt-3 px-4">
                <Nav variant="tabs" className="flex-nowrap overflow-x-auto overflow-y-hidden">
                  {TABS.map((tab) => {
                    const isActive = tab.key === activeTab;

                    return (
                      <Nav.Item key={tab.key}>
                        <Nav.Link
                          eventKey={tab.key}
                          className={`text-nowrap ${
                            isActive ? "fw-semibold" : "text-secondary"
                          }`}
                        >
                          <i
                            className={`bi ${tab.icon} me-2 ${
                              tab.key === "important" ? "text-warning" : ""
                            }`}
                          />
                          {tab.label}
                          <span
                            className={`badge rounded-pill ms-2 fw-normal ${
                              isActive
                                ? "text-bg-primary"
                                : "text-bg-light border"
                            }`}
                          >
                            {tab.key === "important"
                              ? `${importantCount}/${limits.maxImportant}`
                              : byTab[tab.key].length}
                          </span>
                        </Nav.Link>
                      </Nav.Item>
                    );
                  })}
                </Nav>
              </Card.Header>

              <Card.Body className="p-4" style={{ minHeight: 320 }}>
                <Form.Control
                  type="search"
                  className="mb-3"
                  placeholder="Search skills..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search skills"
                />

                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                  <p className="small text-secondary mb-0">
                    {reordering
                      ? "Use the arrows to move skills. Changes save automatically."
                      : activeTab === "important"
                        ? "Shown in your chosen order. Click a skill to edit it or change its position."
                        : "Highest level first until you reorder. Click a skill to edit it."}
                  </p>

                  {byTab[activeTab].length > 1 && !query && (
                    <Button
                      size="sm"
                      variant={reordering ? "primary" : "outline-secondary"}
                      onClick={() => setReordering((value) => !value)}
                    >
                      <i className={`bi ${reordering ? "bi-check-lg" : "bi-arrow-left-right"} me-1`} />
                      {reordering ? "Done" : "Reorder"}
                    </Button>
                  )}
                </div>

                {visible.length === 0 ? (
                  <p className="text-secondary mb-0 py-3">{emptyText()}</p>
                ) : (
                  <>
                    {(activeTab === "important" && !query
                      ? [
                        { key: "very", title: `Very important · top ${VERY_IMPORTANT}`, note: "the key skills on your resumes", from: 0, items: visible.slice(0, VERY_IMPORTANT) },
                        { key: "rest", title: "Important", note: "Rated 3–5/5", from: VERY_IMPORTANT, items: visible.slice(VERY_IMPORTANT) }
                      ].filter((group) => group.items.length)
                      : [{ key: "all", from: 0, items: visible }]
                    ).map((group) => (
                      <div key={group.key} className={group.title ? "mb-3" : ""}>
                        {group.title && (
                          <h3 className="h6 fw-semibold mb-2 d-flex align-items-baseline gap-2">
                            <i className={`bi ${group.key === "very" ? "bi-stars text-warning" : "bi-star-fill text-warning opacity-50"}`} aria-hidden="true" />
                            {group.title}
                            <span className="small fw-normal text-secondary">{group.note}</span>
                          </h3>
                        )}
                        <div className="d-flex flex-wrap gap-2">
                          {group.items.map((skill, offset) => {
                            const index = group.from + offset;
                            return (
                    <span
                              key={skill._id}
                              className="badge rounded-pill bg-primary-subtle text-primary-emphasis border border-primary-subtle fw-medium d-inline-flex align-items-center gap-1 ps-3 pe-2"
                              style={{ fontSize: "0.85rem", paddingTop: "0.4rem", paddingBottom: "0.4rem" }}
                            >
                              {reordering && !query && (
                                <button
                                  type="button"
                                  className="btn btn-link p-0 text-reset lh-1"
                                  style={{ fontSize: "inherit" }}
                                  disabled={savingOrder || index === 0}
                                  aria-label={`Move ${skill.name} earlier`}
                                  title="Move earlier"
                                  onClick={() => moveSkill(index, -1)}
                                >
                                  <i className="bi bi-chevron-left" />
                                </button>
                              )}
      
                              <button
                                type="button"
                                className="btn btn-link p-0 text-reset text-decoration-none fw-medium"
                                style={{ fontSize: "inherit" }}
                                title={`${skill.skillType === "soft" ? "Soft skill" : "Technical"} · ${
                                  skill.lastUsedYear
                                    ? `Last used ${skill.lastUsedYear}`
                                    : "Last used —"
                                } · Click to edit`}
                                onClick={() => openEdit(skill)}
                              >
                                {skill.name}{" "}
                                <span className="fw-normal opacity-75">
                                  ({SKILL_LEVELS[skill.rating]})
                                </span>
                                {(skill.showInPortfolio === false || skill.showInResume === false) && (
                                  <i
                                    className="bi bi-eye-slash ms-1 opacity-75"
                                    title={[skill.showInPortfolio === false && "Hidden from your portfolio", skill.showInResume === false && "Left off your resumes"].filter(Boolean).join("; ")}
                                  />
                                )}
                              </button>
      
                              {reordering && !query && (
                                <button
                                  type="button"
                                  className="btn btn-link p-0 text-reset lh-1"
                                  style={{ fontSize: "inherit" }}
                                  disabled={savingOrder || index === visible.length - 1}
                                  aria-label={`Move ${skill.name} later`}
                                  title="Move later"
                                  onClick={() => moveSkill(index, 1)}
                                >
                                  <i className="bi bi-chevron-right" />
                                </button>
                              )}
      
                              <button
                                type="button"
                                className="btn-close ms-1"
                                style={{ fontSize: "0.55rem" }}
                                title="Delete"
                                aria-label={`Delete ${skill.name}`}
                                onClick={() => setDeleting(skill)}
                              />
                            </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </Card.Body>
            </Tab.Container>
          </Card>
        </>
      )}

      <SkillModal
        show={showModal}
        skill={editing}
        importantCount={importantCount}
        importantIds={byTab.important.map((skill) => skill._id)}
        maxImportant={limits.maxImportant}
        existingNames={existingNames}
        onHide={() => setShowModal(false)}
        onSave={saveSkill}
      />

      <Modal
        show={!!deleting}
        onHide={() => {
          if (!deletingBusy) setDeleting(null);
        }}
        centered
        backdrop={deletingBusy ? "static" : true}
        keyboard={!deletingBusy}
      >
        <Modal.Header closeButton={!deletingBusy}>
          <Modal.Title>Delete Skill?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Delete <strong>{deleting?.name}</strong>? This action cannot be
          undone.
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={deletingBusy}
            onClick={() => setDeleting(null)}
          >
            Cancel
          </Button>

          <Button
            variant="danger"
            disabled={deletingBusy}
            onClick={confirmDelete}
          >
            {deletingBusy ? "Deleting..." : "Delete Skill"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
