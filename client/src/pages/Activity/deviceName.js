// "Chrome on macOS" from a browser's user-agent string (best effort)
export function deviceName(userAgent = "") {
  if (!userAgent) return "Unknown device";

  const browser =
    /Edg\//.test(userAgent) ? "Edge"
      : /OPR\/|Opera/.test(userAgent) ? "Opera"
        : /Firefox\//.test(userAgent) ? "Firefox"
          : /Chrome\//.test(userAgent) ? "Chrome"
            : /Safari\//.test(userAgent) ? "Safari"
              : /node|axios|curl|supertest/i.test(userAgent) ? "Script"
                : "Browser";

  const system =
    /iPhone|iPad/.test(userAgent) ? "iOS"
      : /Android/.test(userAgent) ? "Android"
        : /Mac OS X|Macintosh/.test(userAgent) ? "macOS"
          : /Windows/.test(userAgent) ? "Windows"
            : /Linux/.test(userAgent) ? "Linux"
              : "";

  return system ? `${browser} on ${system}` : browser;
}
