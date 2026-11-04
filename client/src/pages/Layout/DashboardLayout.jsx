import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useCurrentUser } from "./currentUserContext";
import ChatWidget from "../Chat/ChatWidget";
import DraftBuffer from "../Chat/DraftBuffer";
import { sectionForPath } from "../Chat/bufferSections";

export default function DashboardLayout() {
  const user = useCurrentUser();
  const { pathname } = useLocation();
  // Bumped when a buffered entry is added, so the section page reloads
  const [refresh, setRefresh] = useState(0);
  const section = sectionForPath(pathname);

  // Admin accounts have no portfolio: every other page (except changing
  // their password) leads to the console
  if (
    user?.role === "admin" &&
    !pathname.startsWith("/dashboard/admin") &&
    pathname !== "/dashboard/change-password"
  ) {
    return <Navigate to="/dashboard/admin" replace />;
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-content">
        {section && <DraftBuffer key={section} section={section} onAdded={() => setRefresh((n) => n + 1)} />}
        <Outlet key={refresh} />
      </main>

      {user?.role !== "admin" && <ChatWidget />}
    </div>
  );
}
