import { AxiosError } from "axios";

// The GitHub Pages build has no server. Its demo accounts answer from
// demoData.json instead: replies recorded from a real server for made-up people.
const KEY = "uuv-demo-account";
const NOT_SAVED = "This is a demo, so changes aren't saved.";

let openAccount = null;

export const demoAccount = () => {
  try {
    return localStorage.getItem(KEY) || openAccount;
  } catch {
    return openAccount;
  }
};

export const startDemo = (id) => {
  openAccount = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Without storage the demo lasts until the page reloads
  }
};

export const endDemo = () => {
  openAccount = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was stored
  }
};

const withoutTrailingSlash = (path) => path.replace(/\/+$/, "");

async function recordedReply(url) {
  // Written out so normal builds leave the sample data out altogether
  const { default: data } = import.meta.env.VITE_STATIC_SITE === "true" ? await import("./demoData.json") : { default: {} };
  const replies = data[demoAccount()] || {};
  const { pathname, search } = new URL(url);
  const path = withoutTrailingSlash(pathname);
  return replies[`${path}${search}`] ?? replies[path];
}

// Stands in for the network on every API client
export async function demoAdapter(config) {
  const url = config.baseURL ? `${config.baseURL.replace(/\/$/, "")}/${String(config.url || "").replace(/^\//, "")}` : config.url;
  const address = new URL(url);
  new URLSearchParams(config.params || {}).forEach((value, key) => address.searchParams.set(key, value));
  const method = (config.method || "get").toLowerCase();
  const reply = (status, data) => ({ data, status, statusText: "", headers: {}, config });
  const refuse = (status, message) => {
    throw new AxiosError(message, "ERR_BAD_REQUEST", config, null, reply(status, { success: false, message }));
  };

  if (!demoAccount()) refuse(401, "Choose a demo account first.");
  if (method === "post" && address.pathname === "/api/auth/logout") {
    endDemo();
    return reply(200, { success: true });
  }
  if (method !== "get") refuse(403, NOT_SAVED);

  const recorded = await recordedReply(address.href);
  if (recorded === undefined) refuse(404, "This isn't included in the demo.");
  return reply(200, recorded);
}

// The streaming calls use fetch rather than an API client
export const demoFetch = async () =>
  new Response(JSON.stringify({ success: false, message: NOT_SAVED }), {
    status: 403,
    headers: { "Content-Type": "application/json" }
  });
