import { useEffect, useState } from "react";
import axios from "axios";
import { Form, ListGroup, Spinner } from "react-bootstrap";

import { searchSkillCatalog } from "../../api/skillCatalogApi";
import { normalizeSkillName } from "./normalizeSkillName";

// Text box with catalog suggestions. Typing a name that isn't suggested is
// fine: it is saved as a custom skill.
// existingNames: normalized names the user already has (shown as "Added")
// onEnter: called when Enter is pressed without a highlighted suggestion
export default function SkillAutocomplete({
  value,
  onChange,
  onSelect,
  onEnter,
  existingNames = [],
  disabled = false,
  required = true
}) {
  const [results, setResults] = useState({ query: "", items: [] });
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  const query = value.trim();

  useEffect(() => {
    if (!query || disabled) return;

    const controller = new AbortController();

    // Wait for a pause in typing before searching
    const timeout = setTimeout(() => {
      searchSkillCatalog(query, controller.signal)
        .then(({ data }) =>
          setResults({ query, items: data.suggestions || [] })
        )
        .catch((error) => {
          if (!axios.isCancel(error)) setResults({ query, items: [] });
        });
    }, 200);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, disabled]);

  const loading = !!query && results.query !== query;
  const items = query ? results.items : [];
  const added = new Set(existingNames);
  const isAdded = (skill) => added.has(normalizeSkillName(skill.name));
  const exactMatch = items.some(
    (skill) => normalizeSkillName(skill.name) === normalizeSkillName(query)
  );
  const showList = open && !!query && !loading;

  const choose = (skill) => {
    if (isAdded(skill)) return;
    onSelect(skill);
    setOpen(false);
    setHighlighted(-1);
  };

  const keyDown = (event) => {
    if (event.key === "Enter" && onEnter && (!showList || highlighted < 0)) {
      event.preventDefault();
      setOpen(false);
      onEnter();
      return;
    }

    if (!showList || items.length === 0) {
      if (event.key === "ArrowDown") setOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((index) => (index + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => (index <= 0 ? items.length - 1 : index - 1));
    } else if (event.key === "Enter" && highlighted >= 0) {
      // Pick the suggestion instead of submitting the form
      event.preventDefault();
      choose(items[highlighted]);
    } else if (event.key === "Escape" && open) {
      // Close the list without closing the modal
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="position-relative">
      <Form.Control
        value={value}
        disabled={disabled}
        maxLength={100}
        required={required}
        placeholder="Search or type a skill"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlighted(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={keyDown}
      />

      {loading && open && (
        <Spinner
          animation="border"
          size="sm"
          className="position-absolute text-secondary"
          style={{ right: 12, top: 11 }}
        />
      )}

      {showList && (
        <ListGroup
          className="position-absolute w-100 shadow mt-1"
          role="listbox"
          style={{ zIndex: 10, maxHeight: 260, overflowY: "auto" }}
        >
          {items.map((skill, index) => {
            const alreadyAdded = isAdded(skill);

            return (
              <ListGroup.Item
                key={skill._id}
                action
                type="button"
                role="option"
                aria-selected={index === highlighted}
                active={index === highlighted && !alreadyAdded}
                disabled={alreadyAdded}
                // mousedown keeps focus in the input so blur doesn't close
                // the list before the click lands
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(skill)}
                className="d-flex justify-content-between align-items-center"
              >
                <span>{skill.name}</span>

                <small className={index === highlighted && !alreadyAdded ? "" : "text-secondary"}>
                  {alreadyAdded
                    ? "Added"
                    : skill.skillType === "soft"
                      ? "Soft skill"
                      : "Technical"}
                </small>
              </ListGroup.Item>
            );
          })}

          {!exactMatch && (
            <ListGroup.Item className="small text-secondary bg-body-tertiary">
              <i className="bi bi-plus-circle me-1" />
              {items.length === 0 ? "No suggestions. " : ""}
              Save to add “{query}” as a custom skill.
            </ListGroup.Item>
          )}
        </ListGroup>
      )}
    </div>
  );
}
