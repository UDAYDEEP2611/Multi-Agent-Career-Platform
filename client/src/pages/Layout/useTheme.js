import { useEffect, useState } from "react";

const STORAGE_KEY = "uuv-theme";

// The saved theme, or the system preference when nothing is saved.
// index.html applies the same choice before React loads, so pages don't flash.
function initialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage can be unavailable (private mode)
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Light/dark theme through Bootstrap's data-bs-theme on <html>
export default function useTheme() {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Theme still applies for this visit
    }
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));
  return { theme, toggleTheme };
}
