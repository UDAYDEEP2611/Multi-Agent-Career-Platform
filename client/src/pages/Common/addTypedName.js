// Adds a typed name to `names` unless it's empty, a repeat (ignoring case)
// or the list is full. Used on Add and on save, so a typed name isn't lost.
export function addTypedName(names, text, max) {
  const name = text.trim().replace(/\s+/g, " ");
  const repeat = names.some((item) => item.toLowerCase() === name.toLowerCase());

  return !name || repeat || names.length >= max ? names : [...names, name];
}
