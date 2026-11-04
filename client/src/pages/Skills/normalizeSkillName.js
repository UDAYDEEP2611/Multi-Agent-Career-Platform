// Same rule as the server: "  React   JS " and "react js" match
export const normalizeSkillName = (name) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();
