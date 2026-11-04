import { formatCertificationDates, isExpired } from "./certificationOptions";

// Badge icon, name, organization, dates, credential ID and the
// "Show credential" link. Shared by the list and the details page.
export default function CertificationHeader({ certification, nameAs: Name = "h5", children }) {
  const dates = formatCertificationDates(certification);
  const expired = isExpired(certification);

  return (
    <div className="d-flex gap-3">
      <div
        className="rounded-3 bg-primary-subtle text-primary d-flex align-items-center justify-content-center flex-shrink-0"
        style={{ width: 52, height: 52 }}
      >
        <i className="bi bi-patch-check-fill fs-4" />
      </div>

      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <Name className="fw-bold mb-0 text-break">{children || certification.name}</Name>
        {certification.issuingOrganization && <div>{certification.issuingOrganization}</div>}

        {dates && (
          <div className="small text-secondary">
            {dates}
            {expired && (
              <span className="badge rounded-pill bg-danger-subtle text-danger-emphasis border border-danger-subtle fw-normal ms-2">
                Expired
              </span>
            )}
          </div>
        )}

        {certification.credentialId && (
          <div className="small text-secondary text-break">
            Credential ID {certification.credentialId}
          </div>
        )}

        {certification.credentialUrl && (
          <a
            href={certification.credentialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-outline-secondary rounded-pill mt-2"
          >
            Show credential
            <i className="bi bi-box-arrow-up-right ms-2" />
          </a>
        )}
      </div>
    </div>
  );
}
