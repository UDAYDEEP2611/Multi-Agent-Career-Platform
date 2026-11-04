import { useLocation, useNavigate } from "react-router-dom";

import accounts from "./demoAccounts.json";
import { demoAccount, endDemo } from "./demoMode";

// Says plainly, on every page, that this is sample data
export default function DemoBanner() {
  useLocation();
  const navigate = useNavigate();
  const account = accounts.find(({ id }) => id === demoAccount());
  if (!account) return null;

  return (
    <div className="alert alert-warning rounded-0 mb-0 py-2 px-3 small text-center d-print-none" role="status">
      Demo: viewing as <strong>{account.name}</strong>. This is sample data, and changes aren't saved.
      <button
        type="button"
        className="btn btn-link btn-sm align-baseline p-0 ms-2"
        onClick={() => {
          endDemo();
          navigate("/login");
        }}
      >
        Exit demo
      </button>
    </div>
  );
}
