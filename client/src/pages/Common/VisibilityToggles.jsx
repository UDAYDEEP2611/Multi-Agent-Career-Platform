import { useState } from "react";

import { updateVisibility } from "../../api/visibilityApi";
import { AGENT_EVENTS, announce } from "../../api/agentApi";
import "./visibilityToggles.css";

const SWITCHES = [
  { key: "showInPortfolio", label: "Portfolio", icon: "bi-globe2", on: "Shows on your portfolio websites", off: "Hidden from your portfolio websites" },
  { key: "showInResume", label: "Resume", icon: "bi-file-earmark-person", on: "Shows on your resumes", off: "Left off your resumes" }
];

// Two switches on an entry: show it on the portfolio, show it on resumes.
// Saved straight away; a failed save slides back. Entries saved before these
// existed have no value, which means shown.
export default function VisibilityToggles({ section, item, className = "" }) {
  const [flags, setFlags] = useState({
    showInPortfolio: item.showInPortfolio !== false,
    showInResume: item.showInResume !== false
  });
  const [saving, setSaving] = useState("");
  const [failed, setFailed] = useState(false);

  const toggle = async (key) => {
    const value = !flags[key];
    setFlags((current) => ({ ...current, [key]: value }));
    setSaving(key);
    setFailed(false);
    try {
      await updateVisibility(section, item._id, { [key]: value });
      announce(AGENT_EVENTS.portfolio);
    } catch {
      setFlags((current) => ({ ...current, [key]: !value }));
      setFailed(true);
    } finally {
      setSaving("");
    }
  };

  return (
    <div className={`vis-toggles ${className}`} role="group" aria-label="Where this entry shows">
      {SWITCHES.map(({ key, label, icon, on, off }) => (
        <button
          key={key}
          type="button"
          role="switch"
          aria-checked={flags[key]}
          className={`vis-toggle ${flags[key] ? "is-on" : ""}`}
          disabled={saving === key}
          title={failed ? "Couldn't save that. Please try again." : flags[key] ? on : off}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggle(key);
          }}
        >
          <i className={`bi ${icon}`} aria-hidden="true" />
          <span>{label}</span>
          <span className="vis-toggle-track" aria-hidden="true"><span className="vis-toggle-knob" /></span>
        </button>
      ))}
    </div>
  );
}
