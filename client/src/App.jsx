import { BrowserRouter, Route, Routes } from "react-router-dom";

import ErrorPage, { StatusRoute } from "./pages/Common/ErrorPage";
import RouteErrorBoundary from "./pages/Common/RouteErrorBoundary";
import Navbar from "./pages/Layout/Navbar";
import ProtectedRoute from "./pages/Auth/ProtectedRoute";
import DashboardLayout from "./pages/Layout/DashboardLayout";
import Footer from "./pages/Layout/Footer";

import Home from "./pages/Home/Home";
import About from "./pages/Info/About";
import Services from "./pages/Info/Services";
import Login from "./pages/Auth/Login";
import Signup from "./pages/Auth/Signup";
import ForgotPassword from "./pages/Auth/ForgotPassword";
import ResetPassword from "./pages/Auth/ResetPassword";
import Dashboard from "./pages/Home/Dashboard";
import Profile from "./pages/Profile/Profile";
import Summary from "./pages/Profile/Summary";
import Experience from "./pages/Experience/Experience";
import ExperienceDetails from "./pages/Experience/ExperienceDetails";
import ExperienceProjectDetails from "./pages/Experience/ExperienceProjectDetails";
import Education from "./pages/Education/Education";
import EducationDetails from "./pages/Education/EducationDetails";
import EducationProjectDetails from "./pages/Education/EducationProjectDetails";
import Skills from "./pages/Skills/Skills";
import Projects from "./pages/Projects/Projects";
import ProjectDetails from "./pages/Projects/ProjectDetails";
import Certifications from "./pages/Certifications/Certifications";
import CertificationDetails from "./pages/Certifications/CertificationDetails";
import Recommendations from "./pages/Recommendations/Recommendations";
import Volunteering from "./pages/Volunteering/Volunteering";
import VolunteeringDetails from "./pages/Volunteering/VolunteeringDetails";
import Achievements from "./pages/Achievements/Achievements";
import AchievementDetails from "./pages/Achievements/AchievementDetails";
import Interests from "./pages/Interests/Interests";
import Publications from "./pages/Publications/Publications";
import Patents from "./pages/Patents/Patents";
import ActivityLog from "./pages/Activity/ActivityLog";
import ChangePassword from "./pages/Auth/ChangePassword";
import Resume from "./pages/Resume/Resume";
import ResumeMatch from "./pages/Resume/ResumeMatch";
import ResumeMatchLogs from "./pages/Resume/ResumeMatchLogs";
import ResumeMatchLog from "./pages/Resume/ResumeMatchLog";
import PortfolioGallery from "./pages/Portfolio/PortfolioGallery";
import PortfolioView from "./pages/Portfolio/PortfolioView";
import ResumeGallery from "./pages/Resumes/ResumeGallery";
import ResumeView from "./pages/Resumes/ResumeView";
import AdminOverview from "./pages/Admin/AdminOverview";
import AdminUsers from "./pages/Admin/AdminUsers";
import AdminSessions from "./pages/Admin/AdminSessions";
import AdminDatabases from "./pages/Admin/AdminDatabases";
import AdminStorage from "./pages/Admin/AdminStorage";
import AdminSystem from "./pages/Admin/AdminSystem";
import AdminAudit from "./pages/Admin/AdminAudit";

import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="uuv-app">
        <Navbar />

        <div className="uuv-app-body">
          <RouteErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/resume/:designId"
              element={
                <ProtectedRoute>
                  <ResumeView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portfolio/:designId"
              element={
                <ProtectedRoute>
                  <PortfolioView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="portfolios" element={<PortfolioGallery />} />
              <Route path="resumes" element={<ResumeGallery />} />
              <Route path="profile" element={<Profile />} />
              <Route path="summary" element={<Summary />} />
              <Route path="experience" element={<Experience />} />
              <Route
                path="experience/:experienceId"
                element={<ExperienceDetails />}
              />
              <Route
                path="experience/:experienceId/projects/:projectId"
                element={<ExperienceProjectDetails />}
              />
              <Route path="education" element={<Education />} />
              <Route
                path="education/:educationId"
                element={<EducationDetails />}
              />
              <Route
                path="education/:educationId/projects/:projectId"
                element={<EducationProjectDetails />}
              />
              <Route path="skills" element={<Skills />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:projectId" element={<ProjectDetails />} />
              <Route path="certifications" element={<Certifications />} />
              <Route
                path="certifications/:certificationId"
                element={<CertificationDetails />}
              />
              <Route path="recommendations" element={<Recommendations />} />
              <Route path="volunteering" element={<Volunteering />} />
              <Route
                path="volunteering/:volunteeringId"
                element={<VolunteeringDetails />}
              />
              <Route path="achievements" element={<Achievements />} />
              <Route
                path="achievements/:achievementId"
                element={<AchievementDetails />}
              />
              <Route path="interests" element={<Interests />} />
              <Route path="publications" element={<Publications />} />
              <Route path="patents" element={<Patents />} />
              <Route path="activity" element={<ActivityLog />} />
              <Route path="change-password" element={<ChangePassword />} />
              <Route path="resume" element={<Resume />} />
              <Route path="resume-match" element={<ResumeMatch />} />
              <Route path="resume-match/logs" element={<ResumeMatchLogs />} />
              <Route path="resume-match/logs/:id" element={<ResumeMatchLog />} />
              <Route path="admin" element={<AdminOverview />} />
              <Route path="admin/users" element={<AdminUsers />} />
              <Route path="admin/sessions" element={<AdminSessions />} />
              <Route path="admin/databases" element={<AdminDatabases />} />
              <Route path="admin/storage" element={<AdminStorage />} />
              <Route path="admin/system" element={<AdminSystem />} />
              <Route path="admin/audit" element={<AdminAudit />} />
            </Route>

            <Route path="/:code" element={<StatusRoute />} />
            <Route path="*" element={<ErrorPage code={404} />} />
          </Routes>
          </RouteErrorBoundary>
        </div>

        <Footer />
      </div>
    </BrowserRouter>
  );
}
