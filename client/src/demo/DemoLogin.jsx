import { useNavigate } from "react-router-dom";

import { publicUrl } from "../staticSite";
import accounts from "./demoAccounts.json";
import { startDemo } from "./demoMode";

// The public demo's sign-in: pick a made-up account, no password
export default function DemoLogin() {
  const navigate = useNavigate();

  const open = (account) => {
    startDemo(account.id);
    navigate(account.role === "admin" ? "/dashboard/admin" : "/dashboard");
  };

  return (
    <main className="auth-page">
      <div className="auth-container">
        <img src={publicUrl("logo-icon.png")} alt="UltraUnityVerse logo" width="64" height="64" className="d-block mx-auto mb-3" />
        <h1>Try the demo</h1>
        <p className="auth-subtitle">
          Choose an account to look around. These are made-up people with sample data, and changes aren't saved.
        </p>
        <div className="d-grid gap-2">
          {accounts.map((account) => (
            <button key={account.id} type="button" className="btn btn-outline-primary text-start d-flex align-items-center gap-3" onClick={() => open(account)}>
              <i className={`bi ${account.icon} fs-4`} aria-hidden="true" />
              <span>
                <strong className="d-block">{account.name}</strong>
                <small>{account.title}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
