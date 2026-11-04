import { useEffect, useState } from "react";

import { AGENT_EVENTS, getResumeSettings, updateResumeSettings } from "../../api/agentApi";

// What the designed resumes include, kept up to date when the assistant
// changes it. Until it loads, the defaults: every job, two schools and
// projects, every certification, key skills only.
export const DEFAULT_RESUME_SETTINGS = {
  limits: { experience: 0, education: 2, projects: 2, certifications: 0 },
  extras: [],
  allSkills: false,
  columns: {},
  hiddenFields: [],
  skillStyle: "",
  tweaks: {},
  order: [],
  rewrites: {},
  designs: {}
};

// One design's settings: the shared ones with that resume's own changes (made
// in its AI chat) on top. Mirrors effectiveResumeSettings on the server.
export function settingsFor(settings, designId) {
  const own = settings?.designs?.[designId] || {};
  return {
    limits: { ...settings.limits, ...(own.limits || {}) },
    extras: own.extras || settings.extras,
    allSkills: own.allSkills ?? settings.allSkills,
    columns: { ...(settings.columns || {}), ...(own.columns || {}) },
    hiddenFields: own.hiddenFields || settings.hiddenFields || [],
    skillStyle: own.skillStyle || settings.skillStyle || "",
    tweaks: { ...(settings.tweaks || {}), ...(own.tweaks || {}) },
    order: own.order?.length ? own.order : settings.order || [],
    // Wording changed for resumes only: the portfolio keeps the original
    rewrites: {
      ...(settings.rewrites || {}),
      ...(own.rewrites || {}),
      replace: [...(settings.rewrites?.replace || []), ...(own.rewrites?.replace || [])],
      contact: { ...(settings.rewrites?.contact || {}), ...(own.rewrites?.contact || {}) },
      titles: { ...(settings.rewrites?.titles || {}), ...(own.rewrites?.titles || {}) }
    },
    hiddenEntries: own.hiddenEntries || [],
    accent: own.accent || ""
  };
}

export default function useResumeSettings() {
  const [settings, setSettings] = useState(DEFAULT_RESUME_SETTINGS);

  useEffect(() => {
    let active = true;
    const load = () => getResumeSettings().then(({ data }) => active && setSettings(data.settings)).catch(() => {});
    load();
    window.addEventListener(AGENT_EVENTS.designs, load);
    return () => {
      active = false;
      window.removeEventListener(AGENT_EVENTS.designs, load);
    };
  }, []);

  // changes: shared ones, or one design's own with { designId, ... }
  const update = async (changes) => {
    const { data } = await updateResumeSettings(changes);
    setSettings(data.settings);
  };

  return [settings, update, setSettings];
}
