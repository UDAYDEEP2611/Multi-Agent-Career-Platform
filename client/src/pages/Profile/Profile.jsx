
import { useEffect, useState } from "react";
import { Alert, Spinner } from "react-bootstrap";

import ContactDetailsModal from "./ContactDetailsModal";
import PersonalDetailsModal from "./PersonalDetailsModal";
import RoleDetailsModal from "./RoleDetailsModal";
import RoleSummary from "./RoleSummary";

import {
  getProfile,
  createProfile,
  updateContact,
  updatePersonal,
  updateRoleDetails
} from "../../api/profileApi";

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showContact, setShowContact] = useState(false);
  const [showPersonal, setShowPersonal] = useState(false);
  const [showRoles, setShowRoles] = useState(false);

  useEffect(() => {
    let active = true;

    getProfile()
      .then((response) => {
        if (active) setProfile(response.data.profile);
      })
      .catch(() => {
        if (active) setError("Unable to load your profile.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSaveContact = async (contact) => {
    const response = profile
      ? await updateContact(contact)
      : await createProfile(contact);

    setProfile(response.data.profile);
    setError("");
  };

  const handleSavePersonal = async (personal) => {
    if (!profile) {
      throw new Error("Create your Contact Details first.");
    }

    const response = await updatePersonal(personal);
    setProfile(response.data.profile);
    setError("");
  };

  const handleSaveRoles = async (roleDetails) => {
    if (!profile) {
      throw new Error("Create your Contact Details first.");
    }

    const response = await updateRoleDetails(roleDetails);
    setProfile(response.data.profile);
    setError("");
  };

  const roles = profile?.roleDetails;
  const hasRoles = roles && (
    roles.headline ||
    ["targetRoles", "employmentTypes", "workplaceTypes", "locations", "services", "industries"]
      .some((key) => roles[key]?.length)
  );

  const fullName = profile?.contact
    ? [
        profile.contact.firstName,
        profile.contact.middleName,
        profile.contact.lastName
      ].filter(Boolean).join(" ")
    : "";

  return (
    <div className="container-fluid">
      <div className="mb-4">
        <h1 className="fw-bold">My Profile</h1>
        <p className="text-secondary">
          Manage your contact details, job preferences and personal information.
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <Spinner animation="border" />
      ) : (
        <>
          <button
            type="button"
            className="card border-0 shadow-sm w-100 text-start mb-4"
            onClick={() => setShowContact(true)}
          >
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="fw-semibold mb-0">
                  <i className="bi bi-person-lines-fill me-2 text-primary" />
                  Contact Details
                </h5>

                <i className="bi bi-pencil-square text-primary" />
              </div>

              {profile?.contact ? (
                <div className="row g-3 mt-2">
                  {[
                    { label: "Full Name", value: [fullName, profile.contact.suffix].filter(Boolean).join(", ") },
                    { label: "Preferred Name", value: profile.contact.preferredName },
                    { label: "Email", value: profile.contact.email },
                    {
                      label: "Phone",
                      value: profile.contact.phoneNumber
                        ? `${profile.contact.phoneNumber}${profile.contact.phoneType ? ` (${profile.contact.phoneType})` : ""}`
                        : null
                    },
                    { label: "Alternate Mobile", value: profile.contact.alternateMobile },
                    { label: "Address Line", value: profile.contact.addressLine },
                    { label: "City", value: profile.contact.city },
                    { label: "County", value: profile.contact.county },
                    { label: "State / Province", value: profile.contact.stateProvince },
                    { label: "Postal Code", value: profile.contact.postalCode },
                    { label: "Country", value: profile.contact.country },
                    { label: "LinkedIn", value: profile.contact.linkedinUrl },
                    { label: "Portfolio", value: profile.contact.portfolioUrl },
                    { label: "GitHub", value: profile.contact.githubUrl }
                  ].map((field) => (
                    <div className="col-md-6" key={field.label}>
                      <div className="text-secondary small">
                        {field.label}
                      </div>
                      <div className="fw-medium text-break">
                        {field.value || "---"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-secondary mt-3 mb-0">
                  Click to create your contact details.
                </p>
              )}
            </div>
          </button>

          <button
            type="button"
            className="card border-0 shadow-sm w-100 text-start mb-4"
            onClick={() => setShowRoles(true)}
            disabled={!profile}
          >
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="fw-semibold mb-0">
                  <i className="bi bi-briefcase me-2 text-primary" />
                  Role Details
                </h5>

                <i className="bi bi-pencil-square text-primary" />
              </div>

              {hasRoles ? (
                <div className="mt-3">
                  <RoleSummary roles={roles} />
                </div>
              ) : (
                <p className="text-secondary mt-3 mb-0">
                  {profile
                    ? "Add the roles, job types, locations and industries you're looking for."
                    : "Create your Contact Details first, then add your job preferences."}
                </p>
              )}
            </div>
          </button>

          <button
            type="button"
            className="card border-0 shadow-sm w-100 text-start"
            onClick={() => setShowPersonal(true)}
            disabled={!profile}
          >
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="fw-semibold mb-0">
                  <i className="bi bi-shield-lock me-2 text-primary" />
                  Personal Details
                </h5>

                <i className="bi bi-pencil-square text-primary" />
              </div>

              {profile?.personal ? (
                <div className="row g-3 mt-2">
                  {[
                    {
                      label: "Date of Birth",
                      value: profile.personal.dateOfBirth
                        ? String(profile.personal.dateOfBirth).slice(0, 10)
                        : null
                    },
                    {
                      label: "Marital Status",
                      value: profile.personal.maritalStatus
                    },
                    {
                      label: "Gender",
                      value: profile.personal.gender
                    },
                    {
                      label: "Veteran Status",
                      value: profile.personal.veteranStatus === true
                        ? "Yes"
                        : profile.personal.veteranStatus === false
                          ? "No"
                          : null
                    },
                    {
                      label: "Disability Status",
                      value: profile.personal.disabilityStatus === true
                        ? "Yes"
                        : profile.personal.disabilityStatus === false
                          ? "No"
                          : null
                    },
                    {
                      label: "Ethnicity",
                      value: profile.personal.ethnicity
                    },
                    {
                      label: "Authorized to Work",
                      value: profile.personal.authorizedToWork === true
                        ? "Yes"
                        : profile.personal.authorizedToWork === false
                          ? "No"
                          : null
                    },
                    {
                      label: "Future Sponsorship Required",
                      value: profile.personal.futureSponsorship === true
                        ? "Yes"
                        : profile.personal.futureSponsorship === false
                          ? "No"
                          : null
                    }
                  ].map((field) => (
                    <div className="col-md-6" key={field.label}>
                      <div className="text-secondary small">
                        {field.label}
                      </div>
                      <div className="fw-medium">
                        {field.value || "---"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-secondary mt-3 mb-0">
                  No personal details added yet.
                </p>
              )}
            </div>
          </button>

          <ContactDetailsModal
            show={showContact}
            onHide={() => setShowContact(false)}
            contact={profile?.contact}
            isNew={!profile}
            onSave={handleSaveContact}
          />

          <RoleDetailsModal
            show={showRoles}
            onHide={() => setShowRoles(false)}
            roleDetails={profile?.roleDetails}
            onSave={handleSaveRoles}
          />

          <PersonalDetailsModal
            show={showPersonal}
            onHide={() => setShowPersonal(false)}
            personal={profile?.personal}
            onSave={handleSavePersonal}
          />
        </>
      )}
    </div>
  );
}
