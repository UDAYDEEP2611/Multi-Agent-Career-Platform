import { firstAndMore } from "./roleOptions";

// Role details at a glance: used on the Profile card and as the modal's preview
export default function RoleSummary({ roles }) {
  const place = [
    firstAndMore(roles.locations),
    roles.workplaceTypes?.join(" · ")
  ].filter(Boolean).join("  |  ");

  const groups = [
    { label: "Open to", icon: "bi-briefcase", values: roles.employmentTypes },
    { label: "Services", icon: "bi-stars", values: roles.services },
    { label: "Industries", icon: "bi-buildings", values: roles.industries }
  ];

  return (
    <div className="role-summary">
      {roles.headline && <p className="role-summary-headline">{roles.headline}</p>}

      {roles.targetRoles?.length > 0 && (
        <p className="role-summary-roles">
          {roles.targetRoles.map((role, index) => (
            <span key={role}>
              {index > 0 && <span className="role-joiner"> or </span>}
              {role}
            </span>
          ))}
        </p>
      )}

      {place && (
        <p className="role-summary-place">
          <i className="bi bi-geo-alt-fill" aria-hidden="true" />
          <span title={roles.locations?.join("; ")}>{place}</span>
        </p>
      )}

      <div className="role-summary-groups">
        {groups.map((group) => (
          <div key={group.label} className="role-summary-group">
            <span className="role-summary-label">
              <i className={`bi ${group.icon}`} aria-hidden="true" />
              {group.label}
            </span>
            {group.values?.length ? (
              <div className="role-summary-badges">
                {group.values.map((value) => <span key={value}>{value}</span>)}
              </div>
            ) : (
              <span className="role-summary-none">Not set</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
