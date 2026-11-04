import { useEffect, useRef, useSyncExternalStore } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import { useCurrentUser } from "./currentUserContext";

const addPortfolioItem = {
  path: "/dashboard/portfolios",
  icon: "bi-easel",
  label: "My Portfolios"
};

const menuItems = [
  { path: "/dashboard/profile", icon: "bi-person", label: "Profile" },
  { path: "/dashboard/summary", icon: "bi-card-text", label: "Summary" },
  { path: "/dashboard/experience", icon: "bi-briefcase", label: "Experience" },
  { path: "/dashboard/education", icon: "bi-mortarboard", label: "Education" },
  { path: "/dashboard/skills", icon: "bi-lightning", label: "Skills" },
  { path: "/dashboard/certifications", icon: "bi-patch-check", label: "Certifications" },
  { path: "/dashboard/projects", icon: "bi-folder", label: "Projects" }
];

// Optional sections, grouped under "More sections"
const extraItems = [
  { path: "/dashboard/recommendations", icon: "bi-chat-quote", label: "Recommendations" },
  { path: "/dashboard/achievements", icon: "bi-trophy", label: "Activity & Achievements" },
  { path: "/dashboard/volunteering", icon: "bi-people", label: "Volunteering" },
  { path: "/dashboard/interests", icon: "bi-heart", label: "Interests" },
  { path: "/dashboard/publications", icon: "bi-journal-text", label: "Publications" },
  { path: "/dashboard/patents", icon: "bi-lightbulb", label: "Patents" }
];

const adminItems = [
  { path: "/dashboard/admin", icon: "bi-speedometer2", label: "Overview", end: true },
  { path: "/dashboard/admin/users", icon: "bi-people", label: "Users" },
  { path: "/dashboard/admin/sessions", icon: "bi-broadcast", label: "Sessions" },
  { path: "/dashboard/admin/databases", icon: "bi-database", label: "Databases" },
  { path: "/dashboard/admin/storage", icon: "bi-pie-chart", label: "Storage" },
  { path: "/dashboard/admin/system", icon: "bi-cpu", label: "System & Cache" },
  { path: "/dashboard/admin/audit", icon: "bi-journal-check", label: "Audit Log" }
];

// Below Bootstrap's lg breakpoint the sidebar becomes one swipeable row
const COMPACT_QUERY = "(max-width: 991.98px)";

function useCompact() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(COMPACT_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false
  );
}

// In the compact row, keep the current page's link scrolled into view
function useActiveInView(compact) {
  const ref = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const bar = ref.current;
    const active = bar?.querySelector(".sidebar-link.active");
    if (!compact || !bar || !active) return;
    const left = active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [compact, pathname]);

  return ref;
}

const linkClass = ({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`;

const links = (items) => (
  <nav className="nav flex-column gap-1">
    {items.map((item) => (
      <NavLink key={item.path} to={item.path} end={item.end} className={linkClass}>
        <i className={`bi ${item.icon}`}></i>
        <span>{item.label}</span>
      </NavLink>
    ))}
  </nav>
);

// One sidebar item that opens the optional sections in a menu to the right
// of the sidebar. "fixed" lets the menu leave the scrolling sidebar; the
// menu's bottom lines up with the item so it grows upward, and it keeps
// clear of the top navbar.
function MoreSections({ compact }) {
  const { pathname } = useLocation();
  const current = extraItems.find((item) => pathname.startsWith(item.path));

  return (
    // In the compact row the menu drops down instead of out to the right
    <Dropdown drop={compact ? "down" : "end"} align="end" className="sidebar-more-wrap">
      <Dropdown.Toggle
        as="button"
        type="button"
        className={`sidebar-link sidebar-more border-0 text-start ${current ? "active" : "bg-transparent"}`}
      >
        <i className="bi bi-grid"></i>
        <span className="flex-grow-1">{current ? current.label : "More sections"}</span>
      </Dropdown.Toggle>

      <Dropdown.Menu
        className="sidebar-more-menu shadow border py-2"
        popperConfig={{
          strategy: "fixed",
          modifiers: [
            { name: "offset", options: { offset: compact ? [0, 6] : [0, 12] } },
            { name: "preventOverflow", options: { padding: { top: 84, bottom: 12, left: 12, right: 12 } } },
            { name: "flip", enabled: false }
          ]
        }}
      >
        <Dropdown.Header className="text-uppercase small fw-bold">More sections</Dropdown.Header>
        {extraItems.map((item) => (
          <Dropdown.Item
            key={item.path}
            as={NavLink}
            to={item.path}
            className="d-flex align-items-center gap-3 py-2 px-3"
          >
            <i className={`bi ${item.icon}`}></i>
            {item.label}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

// Admin accounts have no portfolio, so they only see the admin console
export default function Sidebar() {
  const user = useCurrentUser();
  const compact = useCompact();
  const ref = useActiveInView(compact);

  if (user?.role === "admin") {
    return (
      <aside className="uuv-sidebar" ref={ref} aria-label="Admin console">
        <div className="sidebar-heading">ADMIN CONSOLE</div>
        {links(adminItems)}
      </aside>
    );
  }

  return (
    <aside className="uuv-sidebar" ref={ref} aria-label="Portfolio sections">
      <NavLink
        to={addPortfolioItem.path}
        className={({ isActive }) =>
          `sidebar-link sidebar-headline ${isActive ? "active" : ""}`
        }
      >
        <i className={`bi ${addPortfolioItem.icon}`}></i>
        <span>{addPortfolioItem.label}</span>
      </NavLink>

      <div className="sidebar-heading">PORTFOLIO SECTIONS</div>
      {links(menuItems)}

      <div className="sidebar-more-slot">
        <MoreSections compact={compact} />
      </div>

      <div className="sidebar-heading sidebar-heading-account">ACCOUNT</div>
      {links([{ path: "/dashboard/activity", icon: "bi-shield-lock", label: "Activity Log" }])}
    </aside>
  );
}
