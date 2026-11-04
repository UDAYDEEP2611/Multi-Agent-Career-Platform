import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Accordion, Alert, Button, Card, Spinner } from "react-bootstrap";

import { getCertification, updateCertification } from "../../api/certificationApi";
import CertificationModal from "./CertificationModal";
import CertificationHeader from "./CertificationHeader";
import { CERTIFICATION_LIMITS } from "./certificationOptions";
import EducationProjectMediaSection from "../Education/EducationProjectMediaSection";
import SkillAssociationSection from "../Skills/SkillAssociationSection";
import useRememberedSections from "../Layout/useRememberedSections";

export default function CertificationDetails() {
  const { certificationId } = useParams();
  const location = useLocation();
  const openSections = useRememberedSections(
    `open-sections:certification:${certificationId}`,
    ["skills", "media"]
  );

  const [certification, setCertification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState(location.state?.warning || "");
  const [showModal, setShowModal] = useState(false);
  // Remounts the Skills panel after the form changes the links
  const [skillsVersion, setSkillsVersion] = useState(0);

  useEffect(() => {
    let active = true;

    getCertification(certificationId)
      .then(({ data }) => {
        if (active) setCertification(data.certification);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load certification");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [certificationId]);

  const save = async (payload) => {
    const { data } = await updateCertification(certificationId, payload);
    return data.certification;
  };

  const handleSaved = (saved, saveWarning) => {
    setCertification(saved);
    setWarning(saveWarning);
    setSkillsVersion((version) => version + 1);
  };

  const backLink = (
    <Link to="/dashboard/certifications" className="text-decoration-none">
      <i className="bi bi-arrow-left me-2" />
      Back to Certifications
    </Link>
  );

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (error || !certification) {
    return (
      <div className="container-fluid">
        {backLink}
        <Alert variant="danger" className="mt-3">
          {error || "Certification not found."}
        </Alert>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      {backLink}

      {warning && (
        <Alert variant="warning" dismissible onClose={() => setWarning("")} className="mt-3">
          {warning}
        </Alert>
      )}

      <Card className="border-0 shadow-sm my-4">
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-start gap-2">
            <CertificationHeader certification={certification} nameAs="h4" />

            <Button
              size="sm"
              variant="outline-secondary"
              className="flex-shrink-0"
              onClick={() => setShowModal(true)}
            >
              <i className="bi bi-pencil me-1" />
              Edit
            </Button>
          </div>
        </Card.Body>
      </Card>

      <Accordion alwaysOpen {...openSections} className="mb-3 shadow-sm">
        <SkillAssociationSection
          key={`skills-${certificationId}-${skillsVersion}`}
          sourceType="certification"
          sourceId={certificationId}
          eventKey="skills"
          title="Skills"
        />
        <EducationProjectMediaSection
          key={`media-${certificationId}`}
          basePath={`/certifications/${certificationId}`}
          max={CERTIFICATION_LIMITS.media}
        />
      </Accordion>

      <CertificationModal
        show={showModal}
        certification={certification}
        onHide={() => setShowModal(false)}
        save={save}
        onSaved={handleSaved}
      />
    </div>
  );
}
