// http(s) URL with a host, at most 2048 characters
module.exports = function validUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) {
    return false;
  }

  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
};
