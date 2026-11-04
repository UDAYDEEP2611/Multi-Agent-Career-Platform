import { useState } from "react";
import { Form } from "react-bootstrap";

const OTHER = "__other__";

// Grouped dropdown whose last choice, "Other", shows a text box for a value
// that isn't listed. Saved values not in the list open as "Other".
// value / onChange(value) work with the plain text value.
// groups: { "Group label": ["Option", ...], ... }
export default function SelectWithOther({
  value,
  onChange,
  groups,
  placeholder,
  otherPlaceholder,
  label,
  maxLength = 150,
  required = false
}) {
  const [otherChosen, setOtherChosen] = useState(false);

  const options = Object.values(groups).flat();
  const isOther = otherChosen || (value !== "" && !options.includes(value));

  const choose = (event) => {
    const choice = event.target.value;

    setOtherChosen(choice === OTHER);
    onChange(choice === OTHER ? "" : choice);
  };

  return (
    <>
      <Form.Select
        value={isOther ? OTHER : value}
        onChange={choose}
        required={required}
        aria-label={label}
      >
        <option value="">{placeholder}</option>

        {Object.entries(groups).map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </optgroup>
        ))}

        <option value={OTHER}>Other (type your own)</option>
      </Form.Select>

      {isOther && (
        <Form.Control
          className="mt-2"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          required={required}
          placeholder={otherPlaceholder}
          aria-label={`Other ${label.toLowerCase()}`}
          autoFocus={otherChosen}
        />
      )}
    </>
  );
}
