import { useCallback, useEffect, useLayoutEffect, useState } from "react";

import { getPortfolioShowcase } from "../../api/portfolioApi";
import { AGENT_EVENTS } from "../../api/agentApi";
import { SKILL_LEVELS } from "../Skills/skillLevels";

// Shared pieces for the portfolio designs: loading the signed-in user's
// portfolio, formatting it, and the "not added yet" state each section shows

// Where each section is edited
export const SECTIONS = {
  profile: { label: "profile", to: "/dashboard/profile" },
  about: { label: "summary", to: "/dashboard/summary" },
  experience: { label: "experience", to: "/dashboard/experience" },
  projects: { label: "projects", to: "/dashboard/projects" },
  skills: { label: "skills", to: "/dashboard/skills" },
  education: { label: "education", to: "/dashboard/education" },
  certifications: { label: "certifications", to: "/dashboard/certifications" },
  achievements: { label: "achievements", to: "/dashboard/achievements" },
  recommendations: { label: "recommendations", to: "/dashboard/recommendations" },
  volunteering: { label: "volunteering", to: "/dashboard/volunteering" },
  publications: { label: "publications", to: "/dashboard/publications" },
  patents: { label: "patents", to: "/dashboard/patents" },
  interests: { label: "interests", to: "/dashboard/interests" }
};

// Optional sections: shown only when they have items
export const EXTRA_SECTIONS = ["volunteering", "publications", "patents", "interests"];

// True when any optional section has something to show
export const hasExtras = (data) => EXTRA_SECTIONS.some((key) => data[key]?.length);

// { status: "loading" | "ready" | "error", data, error, setHeroSummaries }
// setHeroSummaries(map) swaps in the hero summaries the server sent back
// audience: "portfolio" (entries with Show in portfolio on) or "resume".
// Reloads when an entry is switched on or off.
export function usePortfolioShowcase(audience = "portfolio") {
  const [state, setState] = useState({ status: "loading", data: null, error: "" });
  const setHeroSummaries = useCallback((heroSummaries) => setState((current) => (
    current.data ? { ...current, data: { ...current.data, heroSummaries } } : current
  )), []);

  useEffect(() => {
    let active = true;
    const load = () => getPortfolioShowcase(audience)
      .then(({ data }) => active && setState({ status: "ready", data: data.portfolio, error: "" }))
      .catch((err) => active && setState((current) => (current.data ? current : {
        status: "error",
        data: null,
        error: err.response?.data?.message || "Unable to load your portfolio"
      })));
    load();
    window.addEventListener(AGENT_EVENTS.portfolio, load);
    return () => {
      active = false;
      window.removeEventListener(AGENT_EVENTS.portfolio, load);
    };
  }, [audience]);

  return { ...state, setHeroSummaries };
}

const LOCATION_KEY = "uuv.portfolio.showLocation";

// Whether the portfolios show where you live; off unless you turn it on,
// remembered in this browser
export function useShowLocation() {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(LOCATION_KEY) === "1";
    } catch {
      return false;
    }
  });

  const update = (value) => {
    setShow(value);
    try {
      localStorage.setItem(LOCATION_KEY, value ? "1" : "0");
    } catch {
      // Private mode: the choice just isn't remembered
    }
  };

  return [show, update];
}

const unplace = (items = []) => items.map((item) => ({ ...item, location: "" }));

// The portfolio as the designs should show it: without any locations unless asked
export function withLocation(data, show) {
  if (!data || show) return data;
  return {
    ...data,
    contact: { ...data.contact, location: "" },
    experiences: unplace(data.experiences),
    projects: unplace(data.projects),
    educations: unplace(data.educations),
    volunteering: unplace(data.volunteering),
    openTo: data.openTo && { ...data.openTo, locations: [] }
  };
}

const MODE_KEY = "uuv.portfolio.mode";
const MODES = ["auto", "light", "dark"];

const appTheme = () =>
  document.documentElement.getAttribute("data-bs-theme") === "dark" ? "dark" : "light";

// Names and big titles never split mid-word: a heading whose longest word is
// wider than its box gets a smaller font until the word fits on one line
const FIT_SELECTOR = "h1, h2, [class$='-name'], [class*='-name '], .mid-logo, .fresh-logo";

function fitHeadings(root) {
  root.querySelectorAll(FIT_SELECTOR).forEach((el) => {
    if (el.classList.contains("visually-hidden")) return;
    el.style.fontSize = "";
    el.style.maxWidth = "";
    if (!el.clientWidth) return;
    let size = parseFloat(getComputedStyle(el).fontSize);
    // A long word can stretch its columns past the page edge too; then read
    // the real space with the text tiny and hold the heading to it
    if (el.getBoundingClientRect().right > root.getBoundingClientRect().right + 1) {
      el.style.fontSize = "1px";
      el.style.maxWidth = `${el.offsetWidth}px`;
      el.style.fontSize = "";
    }
    const floor = size * 0.3;
    // Re-read the width each step: in a content-sized column it shrinks with the text
    for (let step = 0; step < 10 && el.scrollWidth > el.clientWidth + 1 && size > floor; step += 1) {
      size = Math.max(floor, size * (el.clientWidth / el.scrollWidth) * 0.98);
      el.style.fontSize = `${size}px`;
    }
    el.style.maxWidth = "";
  });
}

export function useFitHeadings(ref, deps = []) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const run = () => fitHeadings(root);
    run();
    let lastWidth = root.clientWidth;
    // Only width changes matter; refitting changes the height
    const observer = new ResizeObserver(() => {
      if (root.clientWidth === lastWidth) return;
      lastWidth = root.clientWidth;
      run();
    });
    observer.observe(root);
    const print = window.matchMedia("print");
    print.addEventListener("change", run);
    window.addEventListener("beforeprint", run);
    window.addEventListener("afterprint", run);
    // Web fonts change word widths without changing the page width
    document.fonts?.ready.then(run);
    document.fonts?.addEventListener("loadingdone", run);
    return () => {
      observer.disconnect();
      print.removeEventListener("change", run);
      window.removeEventListener("beforeprint", run);
      window.removeEventListener("afterprint", run);
      document.fonts?.removeEventListener("loadingdone", run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Light or dark for the portfolios: "auto" follows the app's theme, or pick one.
// { mode, setMode, resolved: "light" | "dark" }
export function usePortfolioMode() {
  const [mode, setModeState] = useState(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      return MODES.includes(saved) ? saved : "auto";
    } catch {
      return "auto";
    }
  });
  const [theme, setTheme] = useState(appTheme);

  // Follow the app theme while on "auto"
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(appTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-bs-theme"] });
    return () => observer.disconnect();
  }, []);

  const setMode = (value) => {
    setModeState(value);
    try {
      localStorage.setItem(MODE_KEY, value);
    } catch {
      // Private mode: the choice just isn't remembered
    }
  };

  return { mode, setMode, resolved: mode === "auto" ? theme : mode };
}

export const MODE_OPTIONS = [
  { value: "auto", label: "Auto", icon: "bi-circle-half" },
  { value: "light", label: "Light", icon: "bi-sun" },
  { value: "dark", label: "Dark", icon: "bi-moon-stars" }
];

// Section titles the shared blocks use
export const SECTION_TITLES = {
  about: "About me",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  achievements: "Achievements",
  recommendations: "Recommendations",
  volunteering: "Volunteering",
  publications: "Publications",
  patents: "Patents",
  interests: "Interests"
};

const CORE_SECTIONS = ["about", "experience", "education", "skills"];
const OPTIONAL_SECTIONS = ["projects", "certifications", "achievements", "recommendations", ...EXTRA_SECTIONS];

// The sections a portfolio shows, in order: the core four always (they say
// "please add it" when empty), the rest only when they have items. A custom
// design's layout (data.layout: { hidden, order }) can leave sections out
// and change the order.
export function sectionPlan(data) {
  const plan = [...CORE_SECTIONS, ...OPTIONAL_SECTIONS.filter((key) => data[key]?.length)];
  const { hidden = [], order = [] } = data.layout || {};
  const shown = plan.filter((key) => !hidden.includes(key));
  if (!order.length) return shown;
  const rank = (key) => (order.includes(key) ? order.indexOf(key) : order.length + plan.indexOf(key));
  return [...shown].sort((a, b) => rank(a) - rank(b));
}

// A section's title, renamed by a custom design if it was
export const titleOf = (data, id) => data.layout?.titles?.[id] || SECTION_TITLES[id];

// What a hero needs, worked out once
export function heroOf(data) {
  const { contact } = data;
  const [first, ...rest] = (contact.name || "").split(/\s+/);
  const current = data.experiences.find((job) => job.current) || data.experiences[0];
  return {
    name: contact.name,
    first,
    last: rest.join(" "),
    initials: initials(contact.name),
    role: data.headline || "Your job title",
    lede: ledeOf(data),
    links: contactLinks(contact),
    stats: statsOf(data),
    location: contact.location,
    current: current ? [current.title, current.organization].filter(Boolean).join(" @ ") : "",
    skills: topSkills(data.skills)
  };
}

// Numbers sections in the order they render: "01", "02"...
export function counter() {
  let n = 0;
  return () => String(++n).padStart(2, "0");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// { month: 5, year: 2024 } -> "May 2024"
export const dateText = (date) =>
  date ? [date.month ? MONTHS[date.month - 1] : "", date.year].filter(Boolean).join(" ") : "";

// "Jan 2022 – Present"
export function rangeText(item) {
  const start = dateText(item.start);
  const end = item.current ? "Present" : dateText(item.end);
  return [start, end].filter(Boolean).join(" – ");
}

export const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join("") || "?";

export const firstName = (name = "") => name.split(/\s+/)[0] || name;

export const levelOf = (rating) => SKILL_LEVELS[rating] || "";

// Whole years of work, overlapping jobs counted once
export function yearsOfWork(experiences = []) {
  const now = new Date();
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const index = (date) => (date ? date.year * 12 + ((date.month || 1) - 1) : null);
  const ranges = experiences
    .map((item) => [index(item.start), item.current ? thisMonth : index(item.end)])
    .filter(([start, end]) => start !== null && end !== null && end >= start)
    .sort((a, b) => a[0] - b[0]);

  let months = 0;
  let current = null;
  for (const [start, end] of ranges) {
    if (current && start <= current[1] + 1) current[1] = Math.max(current[1], end);
    else {
      if (current) months += current[1] - current[0] + 1;
      current = [start, end];
    }
  }
  if (current) months += current[1] - current[0] + 1;
  return Math.floor(months / 12);
}

// Headline numbers for a hero, only the ones that aren't zero
export function statsOf(data) {
  const years = yearsOfWork(data.experiences);
  return [
    years && { value: `${years}+`, label: years === 1 ? "Year of experience" : "Years of experience" },
    data.projects.length && { value: data.projects.length, label: data.projects.length === 1 ? "Project" : "Projects" },
    data.skills.length && { value: data.skills.length, label: "Skills" },
    data.certifications.length && { value: data.certifications.length, label: "Certifications" }
  ].filter(Boolean).slice(0, 3);
}

export const technicalSkills = (skills) => skills.filter((skill) => skill.skillType !== "soft");
export const softSkills = (skills) => skills.filter((skill) => skill.skillType === "soft");

// Skills split for the portfolios: the ones marked important are featured,
// the rest (technical, then soft) are listed plainly
export function skillSplit(skills = []) {
  const featured = skills.filter((skill) => skill.isImportant);
  const rest = skills.filter((skill) => !skill.isImportant);
  return { featured, others: [...technicalSkills(rest), ...softSkills(rest)] };
}

// The skills a hero shows: important first, then the other technical ones
export const topSkills = (skills = []) =>
  [...skills.filter((skill) => skill.isImportant), ...technicalSkills(skills.filter((skill) => !skill.isImportant))]
    .map((skill) => skill.name);

// "single" | "pair" | "rail": how a list of projects is laid out
export const projectLayout = (count) => (count <= 1 ? "single" : count === 2 ? "pair" : "rail");

const WORKPLACE_ICONS = { "On-site": "bi-building", Hybrid: "bi-arrow-left-right", Remote: "bi-house-door" };

// "Looking for" rows from Role Details, only the filled ones.
// Each row: { key, label, icon, items: [{ text, icon? }] }
export function openToLines(openTo) {
  if (!openTo) return [];
  const plain = (list = []) => list.map((text) => ({ text }));
  return [
    { key: "roles", label: "Looking for", icon: "bi-bullseye", items: plain(openTo.roleTargeting ? [openTo.roleTargeting] : []) },
    {
      key: "open",
      label: "Open to",
      icon: "bi-briefcase",
      items: [
        ...plain(openTo.employmentTypes),
        ...(openTo.workplaceTypes || []).map((text) => ({ text, icon: WORKPLACE_ICONS[text] || "bi-geo" }))
      ]
    },
    { key: "industries", label: "Industries", icon: "bi-buildings", items: plain(openTo.industries) },
    { key: "services", label: "Services", icon: "bi-stars", items: plain(openTo.services) },
    { key: "locations", label: "Locations", icon: "bi-geo-alt", items: plain(openTo.locations) }
  ].filter((line) => line.items.length);
}

// Contact links that are filled in: [{ icon, label, href }]
export function contactLinks(contact) {
  return [
    contact.email && { icon: "bi-envelope", label: contact.email, href: `mailto:${contact.email}`, short: "Email" },
    contact.linkedin && { icon: "bi-linkedin", label: "LinkedIn", href: contact.linkedin, short: "LinkedIn" },
    contact.github && { icon: "bi-github", label: "GitHub", href: contact.github, short: "GitHub" },
    contact.portfolio && { icon: "bi-globe", label: "Website", href: contact.portfolio, short: "Website" },
    contact.phone && { icon: "bi-telephone", label: contact.phone, href: `tel:${contact.phone.replace(/[^\d+]/g, "")}`, short: "Phone" }
  ].filter(Boolean);
}

export const isExternal = (href) => /^https?:/i.test(href);

// The summary split into paragraphs
export const paragraphs = (text = "") => text.split(/\n{2,}|\n/).map((part) => part.trim()).filter(Boolean);

const wordsIn = (text) => (text.match(/\S+/g) || []).length;

// The hero's summary when the agent hasn't written one for the design: whole
// sentences from the start of the About me, up to about maxWords, so the
// hero never cuts a sentence off
export function shortLede(text, maxWords = 32) {
  const sentences = (paragraphs(text)[0] || "").split(/(?<=[.!?])\s+/);
  let lede = "";
  for (const sentence of sentences) {
    const next = `${lede} ${sentence.trim()}`.trim();
    if (lede && wordsIn(next) > maxWords) break;
    lede = next;
  }
  return lede;
}

// What a hero shows under the name and headline
export const ledeOf = (data) => data.heroSummary || shortLede(data.summary);

// The design's own hero summary, written by the hero summary agent or by you
export const withHeroSummary = (data, designId) =>
  data ? { ...data, heroSummary: data.heroSummaries?.[designId]?.text || "" } : data;
