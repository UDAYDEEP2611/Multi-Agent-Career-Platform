import { useState } from "react";

// Open/closed state for an "alwaysOpen" accordion, remembered for the
// browser tab so sections stay open when the user navigates away and back.
// Returns props to spread onto <Accordion>.
export default function useRememberedSections(storageKey, defaultKeys) {
  const [activeKey, setActiveKey] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      return Array.isArray(saved) ? saved : defaultKeys;
    } catch {
      return defaultKeys;
    }
  });

  const onSelect = (keys) => {
    const next = Array.isArray(keys) ? keys : [];
    setActiveKey(next);

    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage can be unavailable (private mode); state still works
    }
  };

  return { activeKey, onSelect };
}
