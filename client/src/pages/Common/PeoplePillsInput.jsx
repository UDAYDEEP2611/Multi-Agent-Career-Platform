import { Button, Form } from "react-bootstrap";

import { addTypedName } from "./addTypedName";

const pillStyle = { fontSize: "0.85rem", paddingTop: "0.4rem", paddingBottom: "0.4rem" };

// A fixed "You" pill, then the other people as removable pills, then an
// input with an Add button (Enter works too). noun: "author", "inventor".
export default function PeoplePillsInput({ names, onChange, text, onTextChange, max, noun }) {
  const full = names.length >= max;

  const add = () => {
    onChange(addTypedName(names, text, max));
    onTextChange("");
  };

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-2">
        <span className="badge rounded-pill text-bg-light border fw-medium d-inline-flex align-items-center px-3" style={pillStyle}>
          <i className="bi bi-person-fill me-1" />
          You
        </span>

        {names.map((name) => (
          <span
            key={name}
            className="badge rounded-pill bg-primary-subtle text-primary-emphasis border border-primary-subtle fw-medium d-inline-flex align-items-center gap-1 ps-3 pe-2"
            style={pillStyle}
          >
            {name}
            <button
              type="button"
              className="btn-close ms-1"
              style={{ fontSize: "0.55rem" }}
              onClick={() => onChange(names.filter((item) => item !== name))}
              aria-label={`Remove ${name}`}
            />
          </span>
        ))}
      </div>

      <div className="d-flex gap-2">
        <Form.Control
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          maxLength={100}
          placeholder={full ? `Limit of ${max} reached` : `${noun[0].toUpperCase()}${noun.slice(1)} name`}
          disabled={full}
          aria-label={`${noun} name`}
        />
        <Button
          variant="outline-primary"
          className="flex-shrink-0"
          disabled={!text.trim() || full}
          onClick={add}
        >
          <i className="bi bi-plus-lg me-1" />
          Add {noun}
        </Button>
      </div>
    </>
  );
}
