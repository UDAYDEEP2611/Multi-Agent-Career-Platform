import { useEffect, useRef } from "react";

const SCRIPT = "https://accounts.google.com/gsi/client";

// Google's script loads once, and is set up once for the whole app
let loading = null;
let setUpFor = "";
let onCredential = () => {};

function loadGoogle() {
  loading ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      loading = null;
      reject(new Error("Google's sign-in script didn't load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

// Google's own button. onCredential(idToken) runs after the person picks an account.
export default function GoogleButton({ clientId, text = "continue_with", onCredential: handle, onError }) {
  const box = useRef(null);
  const latest = useRef(handle);

  useEffect(() => {
    latest.current = handle;
  });

  useEffect(() => {
    let active = true;

    loadGoogle()
      .then(() => {
        if (!active || !box.current) return;
        const { id } = window.google.accounts;
        if (setUpFor !== clientId) {
          id.initialize({ client_id: clientId, callback: ({ credential }) => onCredential(credential) });
          setUpFor = clientId;
        }
        onCredential = (credential) => latest.current(credential);
        id.renderButton(box.current, {
          theme: document.documentElement.getAttribute("data-bs-theme") === "dark" ? "filled_black" : "outline",
          size: "large",
          text,
          width: Math.min(box.current.offsetWidth || 320, 400)
        });
      })
      .catch((error) => active && onError?.(error.message));

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, text]);

  return <div ref={box} className="google-button-box" />;
}
