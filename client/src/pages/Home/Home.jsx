import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Spinner } from "react-bootstrap";

import { getCurrentUser } from "../../api/authApi";
import GuestHome from "./GuestHome";

// The public welcome page. Signed-in people go straight to their
// workspace: admins to the admin console, users to their dashboard.
export default function Home() {
  const [state, setState] = useState({ loading: true, user: null });

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then(({ data }) => active && setState({ loading: false, user: data.user }))
      .catch(() => active && setState({ loading: false, user: null }));

    return () => {
      active = false;
    };
  }, []);

  if (state.user) {
    return (
      <Navigate
        to={state.user.role === "admin" ? "/dashboard/admin" : "/dashboard"}
        replace
      />
    );
  }

  return (
    <main className="container py-5">
      <div className="row align-items-center min-vh-75">
        {state.loading ? (
          <div className="text-center"><Spinner animation="border" /></div>
        ) : (
          <GuestHome />
        )}
      </div>
    </main>
  );
}
