import { useEffect, useState } from "react";
import {
  Accordion,
  Alert,
  Button,
  Modal,
  Spinner
} from "react-bootstrap";

import LimitedAddBar from "../Common/LimitedAddBar";
import ExperienceProjectMediaModal from "../Experience/ExperienceProjectMediaModal";
import { mediaIcon, formatSize } from "../Experience/projectMediaDisplay";

import {
  getEducationProjectMedia,
  createEducationProjectMediaLink,
  uploadEducationProjectMediaFile,
  updateEducationProjectMedia,
  deleteEducationProjectMedia,
  downloadEducationProjectMedia
} from "../../api/educationProjectMediaApi";

// Media & Files panel of the Education Project Details accordion.
// Owns its own data, modal and delete confirmation.
// educationId null = a standalone project. basePath overrides both for
// other records with media, e.g. "/certifications/:id". max shows the
// "up to N" hint and disables Add when full.
export default function EducationProjectMediaSection({
  educationId,
  projectId,
  basePath,
  max,
  eventKey = "media"
}) {
  const mediaPath = `${
    basePath ||
    (educationId
      ? `/educations/${educationId}/projects/${projectId}`
      : `/projects/${projectId}`)
  }/media`;

  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    let active = true;

    getEducationProjectMedia(mediaPath)
      .then(({ data }) => {
        if (active) setMediaItems(data.media || []);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load media"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mediaPath]);

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (media) => {
    setEditing(media);
    setShowModal(true);
  };

  const saveMedia = async (payload) => {
    let response;

    if (editing) {
      response = await updateEducationProjectMedia(
        mediaPath,
        editing._id,
        payload.data
      );
    } else if (payload.type === "File") {
      response = await uploadEducationProjectMediaFile(
        mediaPath,
        payload.formData
      );
    } else {
      response = await createEducationProjectMediaLink(
        mediaPath,
        payload.data
      );
    }

    const saved = response.data.media;

    setMediaItems((previous) =>
      editing
        ? previous.map((item) =>
            item._id === saved._id ? saved : item
          )
        : [saved, ...previous]
    );

    setError("");
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteEducationProjectMedia(
        mediaPath,
        deleting._id
      );

      setMediaItems((previous) =>
        previous.filter(
          (item) => item._id !== deleting._id
        )
      );

      setDeleting(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete media"
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  const handleDownload = async (media) => {
    setDownloadingId(media._id);
    setError("");

    try {
      await downloadEducationProjectMedia(
        mediaPath,
        media
      );
    } catch {
      setError("Unable to download file");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header>
        <span className="fw-semibold">Media & Files</span>
        <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
          {loading ? "…" : mediaItems.length}
        </span>
      </Accordion.Header>

      <Accordion.Body>
        <LimitedAddBar
          count={mediaItems.length}
          max={loading ? undefined : max}
          noun="media items"
          label="Add Media"
          onAdd={openAdd}
        />

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
        ) : mediaItems.length === 0 ? (
          <p className="text-secondary mb-0">
            No media or files added yet.
          </p>
        ) : (
          <div
            className="d-grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))"
            }}
          >
            {mediaItems.map((item) => (
              <div key={item._id} className="d-flex">
                <div className="border rounded-3 p-3 w-100 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <i className={`bi fs-3 ${mediaIcon(item)}`} />

                    <div className="btn-group btn-group-sm flex-shrink-0">
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

                  <div className="fw-semibold mt-2 text-break">
                    {item.title}
                  </div>

                  <div className="text-secondary small text-truncate">
                    {item.mediaType === "File" && item.file
                      ? `${item.file.originalName} · ${formatSize(item.file.size)}`
                      : item.url}
                  </div>

                  <div className="mt-auto pt-2">
                    {item.mediaType === "Link" ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="small text-decoration-none"
                      >
                        Open link
                        <i className="bi bi-box-arrow-up-right ms-1" />
                      </a>
                    ) : (
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-decoration-none"
                        disabled={downloadingId === item._id}
                        onClick={() => handleDownload(item)}
                      >
                        <i className="bi bi-download me-1" />
                        {downloadingId === item._id
                          ? "Downloading..."
                          : "Download"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <ExperienceProjectMediaModal
          show={showModal}
          media={editing}
          onHide={() => setShowModal(false)}
          onSave={saveMedia}
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
            <Modal.Title>Delete Media?</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            Are you sure you want to delete{" "}
            <strong>{deleting?.title}</strong>?
            {deleting?.mediaType === "File" &&
              " The uploaded file will also be deleted."}
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
              {deletingBusy ? "Deleting..." : "Delete Media"}
            </Button>
          </Modal.Footer>
        </Modal>
      </Accordion.Body>
    </Accordion.Item>
  );
}
