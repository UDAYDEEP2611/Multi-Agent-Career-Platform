// Small "used / max" counter shown under a text field
export default function CharCount({ value, max }) {
  const length = (value || "").length;

  return (
    <div
      className={`form-text text-end ${length >= max ? "text-danger" : ""}`}
    >
      {length}/{max}
    </div>
  );
}
