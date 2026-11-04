
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import { getCurrentUser, logoutUser } from "../../api/authApi";
import { CvMakerIcon, JobPilotIcon } from "./FeatureIcons";
import useTheme from "./useTheme";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const navRef = useRef(null);

  // The navbar's real height, as --uuv-navbar-h, so the sticky sidebar
  // pins just under it whatever the font size or wrapping
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--uuv-navbar-h", `${Math.round(nav.getBoundingClientRect().height)}px`);
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    update();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((response) => {
        if (active) setUser(response.data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [location.pathname]);

  const handleLogout = async () => {
    setError("");

    try {
      await logoutUser();
      setUser(null);
      closeMenu();
      navigate("/login", { replace: true });
    } catch {
      setError("Logout failed. Please try again.");
    }
  };

  const closeMenu = () => setMenuOpen(false);
  const onPortfolios = location.pathname.startsWith("/dashboard/portfolios") || location.pathname.startsWith("/portfolio/");
  const onResumes = location.pathname.startsWith("/dashboard/resumes") || location.pathname.startsWith("/resume/");
  const servicesActive = onPortfolios || onResumes;

  return (
    <>
      <nav ref={navRef} className="navbar navbar-expand-lg navbar-dark uuv-navbar sticky-top">
        <div className="container-fluid px-3 px-lg-5">
          <Link
            className="navbar-brand d-flex align-items-center gap-2"
            to={user ? (user.role === "admin" ? "/dashboard/admin" : "/dashboard") : "/"}
            onClick={closeMenu}
          >
            <img src="/logo-icon.png" alt="" className="uuv-brand-logo" width="36" height="36" />
            <span className="uuv-brand-text">
              UltraUnityVerse
            </span>
          </Link>

          <button
            className="navbar-toggler"
            type="button"
            aria-controls="mainNavbar"
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div
            className={`collapse navbar-collapse${menuOpen ? " show" : ""}`}
            id="mainNavbar"
          >
            <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-3">
              {/* Home is the public welcome page, so only visitors need it */}
              {!loading && !user && (
                <li className="nav-item">
                  <NavLink
                    to="/"
                    end
                    onClick={closeMenu}
                    className="nav-link"
                  >
                    Home
                  </NavLink>
                </li>
              )}

              {!loading && !user && (
                <>
                  <li className="nav-item">
                    <NavLink to="/about" onClick={closeMenu} className="nav-link">About</NavLink>
                  </li>
                  <li className="nav-item">
                    <NavLink to="/services" onClick={closeMenu} className="nav-link">Services</NavLink>
                  </li>
                </>
              )}

              {!loading && user ? (
                <>
                  <li className="nav-item">
                    <NavLink
                      to={user.role === "admin" ? "/dashboard/admin" : "/dashboard"}
                      onClick={closeMenu}
                      // CV Maker, JobPilot and My Portfolios live under /dashboard but have their own links
                      className={({ isActive }) =>
                        `nav-link${isActive && !location.pathname.startsWith("/dashboard/resume") &&
                          !location.pathname.startsWith("/dashboard/portfolios") && !location.pathname.startsWith("/dashboard/resumes") ? " active" : ""}`}
                    >
                      {user.role === "admin" ? "Admin Console" : "Dashboard"}
                    </NavLink>
                  </li>

                  {user.role !== "admin" && (
                    <li className="nav-item">
                      <NavLink to="/dashboard/resume" onClick={closeMenu} className="nav-link">
                        <CvMakerIcon className="me-1" />CV Maker
                      </NavLink>
                    </li>
                  )}

                  {user.role !== "admin" && (
                    <li className="nav-item">
                      <NavLink to="/dashboard/resume-match" onClick={closeMenu} className="nav-link">
                        <JobPilotIcon className="me-1" />JobPilot
                      </NavLink>
                    </li>
                  )}

                  {user.role !== "admin" && (
                    // Services: what the portfolio turns into, Portfolios first, then Resumes
                    <Dropdown as="li" className="nav-item">
                      <Dropdown.Toggle
                        as="button"
                        type="button"
                        className={`nav-link btn btn-link uuv-services-toggle${servicesActive ? " active" : ""}`}
                      >
                        <i className="bi bi-grid-1x2 me-1" aria-hidden="true"></i>Services
                      </Dropdown.Toggle>
                      <Dropdown.Menu className="shadow-sm uuv-services-menu">
                        <Dropdown.Item as={Link} to="/dashboard/portfolios" onClick={closeMenu} active={onPortfolios}>
                          <i className="bi bi-easel me-2" aria-hidden="true"></i>Portfolios
                          <small className="d-block text-secondary">40 website designs of your portfolio</small>
                        </Dropdown.Item>
                        <Dropdown.Item as={Link} to="/dashboard/resumes" onClick={closeMenu} active={onResumes}>
                          <i className="bi bi-file-earmark-richtext me-2" aria-hidden="true"></i>Resumes
                          <small className="d-block text-secondary">Designed resumes to save as PDF</small>
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  )}

                  <Dropdown as="li" className="nav-item" align="end">
                    <Dropdown.Toggle
                      as="button"
                      type="button"
                      className="nav-link btn btn-link uuv-user-toggle"
                      title={user.username}
                      aria-label="Account menu"
                    >
                      <i className={`bi ${user.role === "admin" ? "bi-shield-lock" : "bi-person-circle"} fs-5`}></i>
                    </Dropdown.Toggle>

                    <Dropdown.Menu className="shadow-sm">
                      <Dropdown.Header>
                        <div className="fw-semibold text-body-emphasis">
                          {user.username}
                          {user.role === "admin" && (
                            <span className="badge bg-dark ms-2 fw-normal">Admin</span>
                          )}
                        </div>
                        <div className="small text-truncate" style={{ maxWidth: 220 }}>{user.email}</div>
                      </Dropdown.Header>
                      <Dropdown.Divider />

                      {user.role !== "admin" && (
                        <Dropdown.Item as={Link} to="/dashboard/profile" onClick={closeMenu}>
                          <i className="bi bi-person me-2"></i>My Profile
                        </Dropdown.Item>
                      )}
                      <Dropdown.Item
                        as={Link}
                        to={user.role === "admin" ? "/dashboard/admin/audit" : "/dashboard/activity"}
                        onClick={closeMenu}
                      >
                        <i className="bi bi-shield-lock me-2"></i>
                        {user.role === "admin" ? "Audit Log" : "Activity Log"}
                      </Dropdown.Item>
                      <Dropdown.Item as={Link} to="/dashboard/change-password" onClick={closeMenu}>
                        <i className="bi bi-key me-2"></i>Reset Password
                      </Dropdown.Item>

                      <Dropdown.Divider />
                      {/* A switch, not a link: keep the menu open while toggling */}
                      <div className="dropdown-item d-flex align-items-center justify-content-between gap-3 uuv-theme-switch">
                        <label htmlFor="uuv-theme-switch" className="mb-0 flex-grow-1" role="button">
                          <i className={`bi ${theme === "dark" ? "bi-moon-stars" : "bi-sun"} me-2`}></i>Dark mode
                        </label>
                        <div className="form-check form-switch mb-0">
                          <input
                            id="uuv-theme-switch"
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            checked={theme === "dark"}
                            onChange={toggleTheme}
                          />
                        </div>
                      </div>

                      <Dropdown.Divider />
                      <Dropdown.Item as="button" className="text-danger" onClick={handleLogout}>
                        <i className="bi bi-box-arrow-right me-2"></i>Logout
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>

                  <li className="nav-item">
                    <button
                      type="button"
                      className="btn btn-outline-light btn-sm uuv-logout-btn"
                      onClick={handleLogout}
                      title="Logout"
                      aria-label="Logout"
                    >
                      <i className="bi bi-box-arrow-right"></i>
                    </button>
                  </li>
                </>
              ) : !loading ? (
                <>
                  <li className="nav-item">
                    <NavLink
                      to="/login"
                      onClick={closeMenu}
                      className="nav-link"
                    >
                      Login
                    </NavLink>
                  </li>

                  <li className="nav-item">
                    <Link
                      to="/signup"
                      onClick={closeMenu}
                      className="btn uuv-signup-btn px-4"
                    >
                      Sign Up
                    </Link>
                  </li>
                </>
              ) : null}
            </ul>
          </div>
        </div>
      </nav>

      {error && (
        <div className="alert alert-danger m-2" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
