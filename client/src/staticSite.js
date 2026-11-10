// The GitHub Pages build (npm run deploy) has no server behind it: the public
// pages work as usual, and signing in opens a demo that answers from JSON.
export const STATIC_SITE = import.meta.env.VITE_STATIC_SITE === "true";

// Where the server is. A hosted build sets this to "" because the server
// serves the app itself.
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5050";

// A file from client/public, wherever the site is hosted
export const publicUrl = (file) => `${import.meta.env.BASE_URL}${file}`;

// The demo's Contact Us form and newsletter sign-up go to the AI proxy
// (ai-proxy/), which keeps them as JSON, when the build names one
export const DEMO_FORMS = STATIC_SITE && Boolean(import.meta.env.VITE_AI_PROXY_URL);
