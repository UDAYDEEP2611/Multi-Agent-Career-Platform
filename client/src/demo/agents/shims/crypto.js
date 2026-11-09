// The agents use hashes only as cache keys and version labels, so the demo
// gives them a quick non-cryptographic one (FNV-1a) with the same interface.
function fnv(text, seed) {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function createHash() {
  let text = "";
  return {
    update(value) {
      text += String(value);
      return this;
    },
    digest() {
      return [0x811c9dc5, 0x01000193, 0x050c5d1f, 0x9e3779b9, 0x7f4a7c15].map((seed) => fnv(text, seed)).join("");
    }
  };
}

export const randomUUID = () => crypto.randomUUID();

export default { createHash, randomUUID };
