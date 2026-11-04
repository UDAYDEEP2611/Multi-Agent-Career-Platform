import { useState } from "react";
import { Form } from "react-bootstrap";

// Inputs for the Role Details modal

// Type a value and press Enter (or Add) to add it as a chip, up to `max`.
// `suggestions` fill a type-ahead list; `quickPicks` are one-click adds
export function ListInput({
  id, values, onChange, max, maxLength, placeholder, joiner, suggestions, quickPicks, icon = "bi-plus-lg"
}) {
  const [draft, setDraft] = useState("");
  const full = values.length >= max;
  const text = draft.trim().replace(/\s+/g, " ");
  const has = (value) => values.some((item) => item.toLowerCase() === value.toLowerCase());
  const duplicate = Boolean(text) && has(text);
  const listId = suggestions ? `${id}-suggestions` : undefined;
  const picks = (quickPicks || []).filter((value) => !has(value));

  const add = () => {
    if (!text || full || duplicate) return;
    onChange([...values, text]);
    setDraft("");
  };

  return (
    <>
      {values.length > 0 && (
        <div className="role-tokens">
          {values.map((value, index) => (
            <span key={value} className="d-inline-flex align-items-center gap-2">
              {joiner && index > 0 && <span className="role-joiner">{joiner}</span>}
              <span className="role-token">
                {value}
                <button
                  type="button"
                  onClick={() => onChange(values.filter((item) => item !== value))}
                  aria-label={`Remove ${value}`}
                >
                  <i className="bi bi-x" aria-hidden="true" />
                </button>
              </span>
            </span>
          ))}
        </div>
      )}

      <div className={`role-input ${full ? "is-full" : ""}`}>
        <i className={`bi ${icon} role-input-icon`} aria-hidden="true" />
        <Form.Control
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={full ? `You've added the maximum of ${max}` : placeholder}
          maxLength={maxLength}
          disabled={full}
          list={listId}
          autoComplete="off"
        />
        <button type="button" className="role-input-add" onClick={add} disabled={!text || full || duplicate}>
          Add
        </button>
      </div>

      {suggestions && (
        <datalist id={listId}>
          {suggestions.filter((value) => !has(value)).map((value) => <option key={value} value={value} />)}
        </datalist>
      )}

      <div className="role-input-meta">
        <span>{duplicate ? "Already added" : full ? "Remove one to add another" : "Press Enter to add"}</span>
      </div>

      {picks.length > 0 && !full && (
        <div className="role-picks">
          <span className="role-picks-label">Popular</span>
          {picks.map((value) => (
            <button key={value} type="button" className="role-pick" onClick={() => onChange([...values, value])}>
              <i className="bi bi-plus" aria-hidden="true" />
              {value.replace(/, United States$/, "")}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// Pill toggles for a fixed list of choices; `max` caps how many can be on
export function ChoiceChips({ label, choices, values, onChange, max }) {
  const atMax = max !== undefined && values.length >= max;

  const toggle = (choice) => {
    if (values.includes(choice)) onChange(values.filter((item) => item !== choice));
    else if (!atMax) onChange([...values, choice]);
  };

  return (
    <div className="role-chips" role="group" aria-label={label}>
      {choices.map((choice) => {
        const on = values.includes(choice);
        return (
          <button
            key={choice}
            type="button"
            className={`role-chip ${on ? "is-on" : ""}`}
            onClick={() => toggle(choice)}
            aria-pressed={on}
            disabled={!on && atMax}
          >
            <i className={`bi ${on ? "bi-check-circle-fill" : "bi-circle"}`} aria-hidden="true" />
            {choice}
          </button>
        );
      })}
    </div>
  );
}

// Big tiles for a short list of choices, each with an icon and a line of text
export function ChoiceTiles({ label, tiles, values, onChange }) {
  const toggle = (value) =>
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

  return (
    <div className="role-tiles" role="group" aria-label={label}>
      {tiles.map((tile) => {
        const on = values.includes(tile.value);
        return (
          <button
            key={tile.value}
            type="button"
            className={`role-tile ${on ? "is-on" : ""}`}
            onClick={() => toggle(tile.value)}
            aria-pressed={on}
          >
            <i className={`bi ${tile.icon} role-tile-icon`} aria-hidden="true" />
            <span className="role-tile-title">{tile.value}</span>
            <span className="role-tile-text">{tile.text}</span>
            <i className={`bi ${on ? "bi-check-circle-fill" : "bi-circle"} role-tile-check`} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
