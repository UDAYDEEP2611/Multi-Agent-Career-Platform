import { useEffect, useState } from "react";

import { AGENT_EVENTS, getCustomDesign, getCustomDesigns } from "../../api/agentApi";

// Custom designs: a built-in design plus the user's colour, fonts, corners,
// light or dark, and section layout. The design agent makes them; this file
// turns one into something the base design can render.

// The CSS variable each design paints its accent with (its --pfb-accent
// points at it). Designs not listed only get --pfb-accent.
const ACCENT_VARS = {
  arcade: "--arc-hot", atlas: "--at-route", bento: "--ben-accent", blueprint: "--bp-ink", boarding: "--bd-accent",
  botanical: "--bo-sage", brutal: "--bru-ink", candy: "--cd-hot", circuit: "--ci-copper", cosmos: "--cos-a",
  dossier: "--ds-red", essay: "--es-accent", executive: "--ex-gold", gazette: "--gz-ink", ide: "--ide-status",
  launch: "--ln-a", ledger: "--lg-accent", memphis: "--mp-pink", metro: "--mt-c", museum: "--mu-gold",
  neon: "--neo-pink", noir: "--nr-ink", polaroid: "--pol-pin", resume: "--rs-accent", sidebar: "--sb-accent",
  slate: "--sl-accent", split: "--sp-accent", studio: "--st-accent", swiss: "--sw-red", timeline: "--tl-a",
  vinyl: "--vn-orange", zen: "--zen-red"
};

const CORNERS = { sharp: "0px", soft: "10px", round: "22px" };

const PREFIX = "custom-";
export const customIdOf = (designId) => (designId?.startsWith(PREFIX) ? designId.slice(PREFIX.length) : null);
export const customRoute = (id) => `/portfolio/${PREFIX}${id}`;

const fontStack = (font, fallback) => `"${font.replace(/"/g, "")}", ${fallback}`;
const SAFE_HEX = /^#[0-9a-f]{6}$/i;

// Scoped CSS for one custom design; scope is a class on a wrapper element
export function customCss(custom, scope) {
  if (!custom) return "";
  const root = `.${scope} .pf`;
  const rules = [];
  const vars = [];

  if (SAFE_HEX.test(custom.accent)) {
    vars.push(`--pfb-accent: ${custom.accent} !important;`);
    if (ACCENT_VARS[custom.baseId]) vars.push(`${ACCENT_VARS[custom.baseId]}: ${custom.accent} !important;`);
  }
  if (CORNERS[custom.corners]) vars.push(`--pfb-radius: ${CORNERS[custom.corners]} !important;`);
  if (vars.length) rules.push(`${root} { ${vars.join(" ")} }`);

  // In dark mode the accent is lightened, so a deep colour stays readable
  // on dark backgrounds
  if (SAFE_HEX.test(custom.accent)) {
    const light = `color-mix(in srgb, ${custom.accent} 55%, #ffffff)`;
    const dark = [`--pfb-accent: ${light} !important;`];
    if (ACCENT_VARS[custom.baseId]) dark.push(`${ACCENT_VARS[custom.baseId]}: ${light} !important;`);
    rules.push(`.${scope}[data-pf-mode="dark"] .pf, .${scope} [data-pf-mode="dark"] .pf { ${dark.join(" ")} }`);
  }

  // Text font everywhere except icon fonts; heading font on headings and names
  if (custom.font) {
    rules.push(`${root}, ${root} *:not(i):not(.bi):not([class*="bi-"]) { font-family: ${fontStack(custom.font, "system-ui, sans-serif")} !important; }`);
  }
  if (custom.headingFont) {
    rules.push(`${root} :is(h1, h2, h3, [class$="-name"], [class*="-name "], [class$="-heading"]) { font-family: ${fontStack(custom.headingFont, "Georgia, serif")} !important; }`);
  }
  if (CORNERS[custom.corners]) {
    rules.push(`${root} :is(.pfb-card, .pfb-item, .pfb-tags span, .pfb-skill, .pf-open-to, [class*="-card"], [class*="-tile"]) { border-radius: ${CORNERS[custom.corners]} !important; }`);
  }
  return rules.join("\n");
}

// Where each section's items are in the portfolio data
const DATA_KEYS = { experience: "experiences", education: "educations" };

// The portfolio data as the custom design shows it: its layout, its own
// hero summary, only the first N items where it limits a section, and
// hidden optional sections emptied (so even designs that lay out sections
// by hand leave them out)
export function withCustomLayout(data, custom) {
  if (!data || !custom) return data;
  const hidden = custom.hidden || [];
  const limited = Object.fromEntries(Object.entries(custom.limits || {})
    .map(([id, count]) => [DATA_KEYS[id] || id, count])
    .filter(([key, count]) => Array.isArray(data[key]) && Number.isInteger(count) && count > 0)
    .map(([key, count]) => [key, data[key].slice(0, count)]));
  const emptied = Object.fromEntries(hidden
    .filter((id) => !["about", "experience", "education", "skills"].includes(id) && Array.isArray(data[id]))
    .map((id) => [id, []]));
  return {
    ...data,
    ...limited,
    ...emptied,
    layout: { hidden, order: custom.order || [], titles: custom.titles || {} },
    heroSummary: custom.heroSummary || data.heroSummary
  };
}

// One custom design, kept up to date when the design agent changes it
export function useCustomDesign(id) {
  const [state, setState] = useState({ status: id ? "loading" : "none", design: null });

  useEffect(() => {
    if (!id) return undefined;
    let active = true;
    const load = () => getCustomDesign(id)
      .then(({ data }) => active && setState({ status: "ready", design: data.design }))
      .catch(() => active && setState({ status: "missing", design: null }));
    load();
    window.addEventListener(AGENT_EVENTS.designs, load);
    return () => {
      active = false;
      window.removeEventListener(AGENT_EVENTS.designs, load);
    };
  }, [id]);

  return id ? state : { status: "none", design: null };
}

// All the user's custom designs, for the gallery
export function useCustomDesigns() {
  const [designs, setDesigns] = useState([]);

  useEffect(() => {
    let active = true;
    const load = () => getCustomDesigns().then(({ data }) => active && setDesigns(data.designs)).catch(() => {});
    load();
    window.addEventListener(AGENT_EVENTS.designs, load);
    return () => {
      active = false;
      window.removeEventListener(AGENT_EVENTS.designs, load);
    };
  }, []);

  return [designs, setDesigns];
}
