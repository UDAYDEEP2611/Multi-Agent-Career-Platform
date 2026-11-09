import { gather } from "../../demoStore";
import { currentStore } from "../current";

// The resume data the server reads from MongoDB, built from the demo data

// audience: "portfolio" or "resume" leaves out the entries switched off for
// it; left out, everything is kept
export const gatherResumeData = async (userId, account, { audience } = {}) => gather(currentStore(), audience);

export const lines = (text) =>
  String(text || "")
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-•*▪◦]\s*/, "").trim())
    .filter(Boolean);
