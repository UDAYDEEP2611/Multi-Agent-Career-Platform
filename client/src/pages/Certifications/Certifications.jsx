import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Modal,
  Spinner
} from "react-bootstrap";

import CertificationModal from "./CertificationModal";
import CertificationHeader from "./CertificationHeader";
import { SKILL_LEVELS } from "../Skills/skillLevels";

import {
  getCertifications,
  createCertification,
  updateCertification,
  deleteCertification
} from "../../api/certificationApi";
import VisibilityToggles from "../Common/VisibilityToggles";

export default function Certifications() {
  const navigate = useNavigate();

  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const load = () =>
    getCertifications()
      .then(({ data }) => setCertifications(data.certifications || []))
      .catch((err) =>
        setError(err.response?.data?.message || "Unable to load certifications")
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (certification) => {
    setEditing(certification);
    setShowModal(true);
  };

  const save = async (payload) => {
    const { data } = editing
      ? await updateCertification(editing._id, payload)
      : await createCertification(payload);

    return data.certification;
  };

  // New certifications open their page so media can be added; edits
  // reload the list to pick up skill changes
  const handleSaved = (certification, saveWarning) => {
    if (!editing) {
      navigate(`/dashboard/certifications/${certification._id}`, {
        state: { warning: saveWarning }
      });
      return;
    }

    setWarning(saveWarning);
    load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteCertification(deleting._id);
      setCertifications((previous) => previous.filter((item) => item._id !== deleting._id));
      setDeleting(null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete certification");
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="fw-bold mb-1">Licenses & Certifications</h1>
          <p className="text-secondary mb-0">
            Credentials you've earned, with the skills they prove.
          </p>
        </div>

        <Button onClick={openAdd}>
          <i className="bi bi-plus-lg me-2" />
          Add Certification
        </Button>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {warning && (
        <Alert variant="warning" dismissible onClose={() => setWarning("")}>
          {warning}
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : certifications.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 px-4">
            <div
              className="rounded-circle bg-primary-subtle text-primary d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 72, height: 72 }}
            >
              <i className="bi bi-patch-check-fill fs-2" />
            </div>

            <h5 className="fw-semibold mb-2">No certifications added yet</h5>

            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: 420 }}>
              Add licenses and certifications with their issuer, dates,
              credential link and the skills they cover.
            </p>

            <Button onClick={openAdd} className="px-4">
              <i className="bi bi-plus-lg me-2" />
              Add Your First Certification
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            {certifications.map((certification, index) => (
              <div
                key={certification._id}
                className={`p-4 ${index > 0 ? "border-top" : ""}`}
              >
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <CertificationHeader certification={certification}>
                    <Link
                      to={`/dashboard/certifications/${certification._id}`}
                      className="text-reset text-decoration-none"
                    >
                      {certification.name}
                    </Link>
                  </CertificationHeader>

                  <div className="d-flex flex-wrap justify-content-end align-items-center gap-1 flex-shrink-0">

                    <VisibilityToggles section="certifications" item={certification} />
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => openEdit(certification)}
                      aria-label={`Edit ${certification.name}`}
                      title="Edit"
                    >
                      <i className="bi bi-pencil" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => setDeleting(certification)}
                      aria-label={`Delete ${certification.name}`}
                      title="Delete"
                    >
                      <i className="bi bi-trash" />
                    </Button>
                  </div>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2 mt-3" style={{ marginLeft: 68 }}>
                  {certification.skills.map((skill) => (
                    <span
                      key={skill._id}
                      className="badge rounded-pill bg-primary-subtle text-primary-emphasis border border-primary-subtle fw-medium"
                      style={{ fontSize: "0.8rem" }}
                    >
                      {skill.name}
                      <span className="fw-normal opacity-75"> ({SKILL_LEVELS[skill.rating]})</span>
                    </span>
                  ))}

                  {certification.media.length > 0 && (
                    <span className="small text-secondary">
                      <i className="bi bi-paperclip me-1" />
                      {certification.media.length} media
                    </span>
                  )}

                  <Link
                    to={`/dashboard/certifications/${certification._id}`}
                    className="small ms-auto text-decoration-none"
                  >
                    Details <i className="bi bi-arrow-right" />
                  </Link>
                </div>
              </div>
            ))}
          </Card.Body>
        </Card>
      )}

      <CertificationModal
        show={showModal}
        certification={editing}
        onHide={() => setShowModal(false)}
        save={save}
        onSaved={handleSaved}
      />

      <Modal
        show={!!deleting}
        onHide={() => {
          if (!deletingBusy) setDeleting(null);
        }}
        centered
        backdrop={deletingBusy ? "static" : true}
        keyboard={!deletingBusy}
      >
        <Modal.Header closeButton={!deletingBusy}>
          <Modal.Title>Delete Certification?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          Delete <strong>{deleting?.name}</strong> and its media? This action
          cannot be undone. Your skills stay on the Skills page.
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" disabled={deletingBusy} onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={deletingBusy} onClick={confirmDelete}>
            {deletingBusy ? "Deleting..." : "Delete Certification"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
