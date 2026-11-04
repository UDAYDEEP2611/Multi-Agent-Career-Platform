// The GitHub Pages build (npm run deploy) has no server behind it: only the
// public pages work, so anything that needs one says so instead of failing.
export const STATIC_SITE = import.meta.env.VITE_STATIC_SITE === "true";

// A file from client/public, wherever the site is hosted
export const publicUrl = (file) => `${import.meta.env.BASE_URL}${file}`;
