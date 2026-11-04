import { useEffect, useState } from "react";

import { getGoogleConfig } from "../../api/authApi";

// The site's Google client id ("" when Google isn't set up), or null while loading
export function useGoogleClientId() {
  const [clientId, setClientId] = useState(null);

  useEffect(() => {
    let active = true;
    getGoogleConfig()
      .then(({ data }) => active && setClientId(data.clientId || ""))
      .catch(() => active && setClientId(""));
    return () => {
      active = false;
    };
  }, []);

  return clientId;
}
