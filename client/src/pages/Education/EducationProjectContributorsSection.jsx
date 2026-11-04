import { useEffect, useState } from "react";
import {
  Accordion,
  Alert,
  Button,
  Modal,
  Spinner
} from "react-bootstrap";

import ExperienceProjectContributorModal from "../Experience/ExperienceProjectContributorModal";

import {
  getEducationProjectContributors,
  createEducationProjectContributor,
  updateEducationProjectContributor,
  deleteEducationProjectContributor
} from "../../api/educationProjectContributorApi";

// Contributors panel of the Education Project Details accordion.
// Owns its own data, modal and delete confirmation.
export default function EducationProjectContributorsSection({
  educationId,
  projectId,
  eventKey = "contributors"
}) {
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getEducationProjectContributors(educationId, projectId)
      .then(({ data }) => {
        if (active) setContributors(data.contributors || []);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load contributors"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [educationId, projectId]);

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (contributor) => {
    setEditing(contributor);
    setShowModal(true);
  };

  const saveContributor = async (payload) => {
    const { data } = editing
      ? await updateEducationProjectContributor(
          educationId,
          projectId,
          editing._id,
          payload
        )
      : await createEducationProjectContributor(
          educationId,
          projectId,
          payload
        );

    setContributors((previous) =>
      editing
        ? previous.map((item) =>
            item._id === data.contributor._id
              ? data.contributor
              : item
          )
        : [...previous, data.contributor]
    );

    setError("");
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteEducationProjectContributor(
        educationId,
        projectId,
        deleting._id
      );

      setContributors((previous) =>
        previous.filter(
          (item) => item._id !== deleting._id
        )
      );

      setDeleting(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete contributor"
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header>
        <span className="fw-semibold">Contributors</span>
        <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
          {loading ? "…" : contributors.length}
        </span>
      </Accordion.Header>

      <Accordion.Body>
        <div className="d-flex justify-content-end mb-3">
          <Button size="sm" onClick={openAdd}>
            <i className="bi bi-plus-lg me-1" />
            Add Contributor
          </Button>
        </div>

        {error && (
          <Alert
            variant="danger"
            dismissible
            onClose={() => setError("")}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-3">
            <Spinner animation="border" size="sm" />
          </div>
        ) : contributors.length === 0 ? (
          <p className="text-secondary mb-0">
            No contributors added yet.
          </p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {contributors.map((item) => (
              <div
                key={item._id}
                className="d-flex justify-content-between gap-3 border-bottom pb-3"
              >
                <div className="d-flex gap-3">
                  <div
                    className="rounded-circle bg-primary-subtle text-primary-emphasis fw-semibold d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: 40, height: 40 }}
                  >
                    {item.name.trim().charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div className="fw-semibold">
                      {item.name}
                    </div>

                    <div className="text-secondary small">
                      {item.role}
                    </div>

                    {item.contribution && (
                      <p
                        className="mt-2 mb-0"
                        style={{ whiteSpace: "pre-line" }}
                      >
                        {item.contribution}
                      </p>
                    )}

                    {(item.email || item.profileUrl) && (
                      <div className="d-flex flex-wrap column-gap-3 mt-2 small">
                        {item.email && (
                          <a
                            href={`mailto:${item.email}`}
                            className="text-decoration-none"
                          >
                            <i className="bi bi-envelope me-1" />
                            {item.email}
                          </a>
                        )}

                        {item.profileUrl && (
                          <a
                            href={item.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-decoration-none"
                          >
                            View profile
                            <i className="bi bi-box-arrow-up-right ms-1" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="btn-group btn-group-sm flex-shrink-0 align-self-start">
                  <Button
                    variant="outline-secondary"
                    title="Edit"
                    onClick={() => openEdit(item)}
                  >
                    <i className="bi bi-pencil" />
                  </Button>

                  <Button
                    variant="outline-danger"
                    title="Delete"
                    onClick={() => setDeleting(item)}
                  >
                    <i className="bi bi-trash" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ExperienceProjectContributorModal
          show={showModal}
          contributor={editing}
          onHide={() => setShowModal(false)}
          onSave={saveContributor}
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
            <Modal.Title>Delete Contributor?</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            Are you sure you want to remove{" "}
            <strong>{deleting?.name}</strong> from this project?
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="outline-secondary"
              disabled={deletingBusy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>

            <Button
              variant="danger"
              disabled={deletingBusy}
              onClick={confirmDelete}
            >
              {deletingBusy ? "Deleting..." : "Delete Contributor"}
            </Button>
          </Modal.Footer>
        </Modal>
      </Accordion.Body>
    </Accordion.Item>
  );
}
