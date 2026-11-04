import { useEffect, useState } from "react";
import {
  Accordion,
  Alert,
  Button,
  Modal,
  Spinner
} from "react-bootstrap";

import EducationVolunteeringModal from "./EducationVolunteeringModal";
import FileChip from "../Experience/FileChip";

import {
  uploadEducationItemFile,
  deleteEducationItemFile,
  educationItemFileUrl
} from "../../api/educationFileApi";

import {
  getEducationVolunteering,
  createEducationVolunteering,
  updateEducationVolunteering,
  deleteEducationVolunteering
} from "../../api/educationVolunteeringApi";
import LimitedAddBar from "../Common/LimitedAddBar";
import { MAX_ITEMS } from "../../limits";

const shortMonths = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const formatMonthYear = (month, year) =>
  year ? `${month ? shortMonths[month - 1] + " " : ""}${year}` : "";

// Months count as 0 when missing, so "2024" sorts before "2024-03"
const toMonths = (year, month) => (year || 0) * 12 + (month || 0);

// Ongoing first, then latest end date, then latest start date
function newestFirst(a, b) {
  if (a.currentlyVolunteering !== b.currentlyVolunteering) {
    return a.currentlyVolunteering ? -1 : 1;
  }

  return (
    toMonths(b.endYear, b.endMonth) - toMonths(a.endYear, a.endMonth) ||
    toMonths(b.startYear, b.startMonth) - toMonths(a.startYear, a.startMonth)
  );
}

// Volunteering panel of the Education Details accordion.
// Owns its own data, modal and delete confirmation.
export default function EducationVolunteeringSection({
  educationId,
  eventKey = "volunteering"
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  useEffect(() => {
    let active = true;

    getEducationVolunteering(educationId)
      .then(({ data }) => {
        if (active) setRecords(data.volunteering || []);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.response?.data?.message ||
            "Unable to load volunteering"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [educationId]);

  // After saving, upload or remove the attached file. The modal then edits
  // the saved item, so retrying a failed upload doesn't create a duplicate.
  const applyFileChanges = async (saved, { file, removeFile }) => {
    if (file) {
      const response = await uploadEducationItemFile(
        educationId,
        "volunteering",
        saved._id,
        file
      );
      return response.data.volunteering;
    }

    if (removeFile && saved.file) {
      const response = await deleteEducationItemFile(
        educationId,
        "volunteering",
        saved._id
      );
      return response.data.volunteering;
    }

    return saved;
  };

  const openAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    setShowModal(true);
  };

  const saveRecord = async (payload, fileChanges) => {
    const { data } = editing
      ? await updateEducationVolunteering(educationId, editing._id, payload)
      : await createEducationVolunteering(educationId, payload);

    let saved = data.volunteering;
    store(saved);
    setEditing(saved);

    saved = await applyFileChanges(saved, fileChanges);
    store(saved);
    setError("");
  };

  const store = (item) =>
    setRecords((previous) =>
      previous.some((existing) => existing._id === item._id)
        ? previous.map((existing) => (existing._id === item._id ? item : existing))
        : [item, ...previous]
    );

  const confirmDelete = async () => {
    if (!deleting) return;

    setDeletingBusy(true);

    try {
      await deleteEducationVolunteering(
        educationId,
        deleting._id
      );

      setRecords((previous) =>
        previous.filter((item) => item._id !== deleting._id)
      );

      setDeleting(null);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete volunteering"
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  const sorted = [...records].sort(newestFirst);

  return (
    <Accordion.Item eventKey={eventKey}>
      <Accordion.Header>
        <span className="fw-semibold">Volunteering</span>
        <span className="badge rounded-pill text-bg-light border fw-normal ms-2">
          {loading ? "…" : records.length}
        </span>
      </Accordion.Header>

      <Accordion.Body>
        <LimitedAddBar
          count={records.length}
          max={MAX_ITEMS.volunteering}
          noun="volunteering entries"
          label="Add Volunteering"
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
        ) : sorted.length === 0 ? (
          <p className="text-secondary mb-0">
            No volunteering records added yet.
          </p>
        ) : (
          <div className="d-flex flex-column gap-3">
            {sorted.map((record) => {
              const start = formatMonthYear(record.startMonth, record.startYear);
              const end = record.currentlyVolunteering
                ? "Present"
                : formatMonthYear(record.endMonth, record.endYear);

              return (
                <div
                  key={record._id}
                  className="d-flex justify-content-between gap-3 border-bottom pb-3"
                >
                  <div>
                    <div className="fw-semibold">
                      {record.role}
                    </div>

                    <div className="text-secondary">
                      {record.organization}
                    </div>

                    <div className="text-secondary small mt-1">
                      {[
                        record.cause,
                        record.location,
                        [start, end].filter(Boolean).join(" – ")
                      ].filter(Boolean).join(" · ")}
                    </div>

                    {record.description && (
                      <p
                        className="mt-2 mb-0"
                        style={{ whiteSpace: "pre-line" }}
                      >
                        {record.description}
                      </p>
                    )}

                    {record.url && (
                      <a
                        href={record.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="d-inline-block mt-2 small text-decoration-none"
                      >
                        View link
                        <i className="bi bi-box-arrow-up-right ms-1" />
                      </a>
                    )}

                    {record.file && (
                      <div className="mt-2">
                        <FileChip
                          href={educationItemFileUrl(educationId, "volunteering", record)}
                          file={record.file}
                        />
                      </div>
                    )}
                  </div>

                  <div className="btn-group btn-group-sm flex-shrink-0 align-self-start">
                    <Button
                      variant="outline-secondary"
                      title="Edit"
                      onClick={() => openEdit(record)}
                    >
                      <i className="bi bi-pencil" />
                    </Button>

                    <Button
                      variant="outline-danger"
                      title="Delete"
                      onClick={() => setDeleting(record)}
                    >
                      <i className="bi bi-trash" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <EducationVolunteeringModal
          show={showModal}
          volunteering={editing}
          onHide={() => setShowModal(false)}
          onSave={saveRecord}
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
            <Modal.Title>Delete Volunteering?</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            Delete the volunteering record for{" "}
            <strong>{deleting?.organization}</strong>?
            This action cannot be undone.
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
              {deletingBusy ? "Deleting..." : "Delete"}
            </Button>
          </Modal.Footer>
        </Modal>
      </Accordion.Body>
    </Accordion.Item>
  );
}
