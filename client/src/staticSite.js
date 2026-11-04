// The GitHub Pages build (npm run deploy) has no server behind it: only the
// public pages work, so anything that needs one says so instead of failing.
export const STATIC_SITE = import.meta.env.VITE_STATIC_SITE === "true";

// A file from client/public, wherever the site is hosted
// Where the server is. A hosted build sets this to "" because the server
// serves the app itself.
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5050";
export const publicUrl = (file) => `${import.meta.env.BASE_URL}${file}`;
