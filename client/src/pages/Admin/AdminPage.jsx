import { Alert } from "react-bootstrap";
import { useCurrentUser } from "../Layout/currentUserContext";

// Header and admin check shared by the admin pages. The server checks the
// role on every admin request; this only decides what to show.
export default function AdminPage({ title, description, actions, children }) {
  const user = useCurrentUser();

  if (user?.role !== "admin") {
    return (
      <div className="container-fluid">
        <Alert variant="warning">
          <i className="bi bi-shield-lock me-2" />
          This page is only for admins.
        </Alert>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="fw-bold mb-1">{title}</h1>
          {description && <p className="text-secondary mb-0">{description}</p>}
        </div>
        {actions}
      </div>

      {children}
    </div>
  );
}
