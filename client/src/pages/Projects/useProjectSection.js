import { useEffect, useState } from "react";

import {
  getProjectSection,
  createProjectSectionItem,
  updateProjectSectionItem,
  deleteProjectSectionItem
} from "../../api/projectApi";

// Loads and edits one list inside a project ("achievements" or "links").
// itemKey: the single-item key in API responses ("achievement" / "link")
export default function useProjectSection(projectId, section, itemKey) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getProjectSection(projectId, section)
      .then(({ data }) => {
        if (active) setItems(data[section] || []);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || `Unable to load ${section}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId, section]);

  const save = async (editing, payload) => {
    const { data } = editing
      ? await updateProjectSectionItem(projectId, section, editing._id, payload)
      : await createProjectSectionItem(projectId, section, payload);

    const saved = data[itemKey];

    setItems((previous) =>
      editing
        ? previous.map((item) => (item._id === saved._id ? saved : item))
        : [...previous, saved]
    );
    setError("");
  };

  const remove = async (item) => {
    await deleteProjectSectionItem(projectId, section, item._id);
    setItems((previous) => previous.filter((entry) => entry._id !== item._id));
    setError("");
  };

  return { items, loading, error, setError, save, remove };
}
