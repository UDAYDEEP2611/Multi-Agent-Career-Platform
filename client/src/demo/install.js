import axios from "axios";

import { API_URL, STATIC_SITE } from "../staticSite";
import { demoAdapter, demoFetch } from "./demoMode";

// Imported before anything else: API clients copy axios's defaults when created
if (STATIC_SITE) {
  axios.defaults.adapter = demoAdapter;

  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) =>
    String(input?.url ?? input).startsWith(`${API_URL}/api/`) ? demoFetch(input, init) : realFetch(input, init);
}
