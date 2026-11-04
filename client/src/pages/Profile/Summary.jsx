
import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Form,
  Modal,
  Spinner
} from "react-bootstrap";

import {
  getSummary,
  createSummary,
  updateSummary,
  deleteSummary,
  reviewSummary,
  restoreSummary,
  deleteSummaryVersion
} from "../../api/summaryApi";
import SummaryAiWriter from "./SummaryAiWriter";
import SummaryHistory from "./SummaryHistory";
import { SummaryCheckList } from "./SummaryChecks";

const MANUAL = "Written by you";

export default function Summary() {
  const [summary, setSummary] = useState(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The checks and the text they were run on
  const [checked, setChecked] = useState({ content: "", review: [] });
  // An AI version opened for editing: its text and label, to tell if it changed
  const [draftFrom, setDraftFrom] = useState(null);

  const [showEditor, setShowEditor] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Title, years, skills and achievement checks for the saved summary
  const savedContent = summary?.content || "";
  useEffect(() => {
    if (!savedContent) return;
    let active = true;
    reviewSummary(savedContent)
      .then((response) => active && setChecked({ content: savedContent, review: response.data.review }))
      .catch(() => active && setChecked({ content: savedContent, review: [] }));
    return () => {
      active = false;
    };
  }, [savedContent]);
  const review = checked.content === savedContent ? checked.review : [];

  useEffect(() => {
    let active = true;

    getSummary()
      .then((response) => {
        if (active) setSummary(response.data.summary);
      })
      .catch(() => {
        if (active) setError("Unable to load summary");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const openEditor = () => {
    setContent(summary?.content || "");
    setDraftFrom(null);
    setError("");
    setShowEditor(true);
  };

  // Saves text as the summary; the replaced one goes to Previous versions
  const saveText = async (text, origin) => {
    const response = summary
      ? await updateSummary(text, origin)
      : await createSummary(text, origin);
    setSummary(response.data.summary);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const useVariant = async (variant) => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await saveText(variant.summary, `AI · ${variant.label}`);
      setNotice(`Saved the ${variant.label} version.${summary ? " Your previous summary is under Previous versions." : ""}`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save summary");
    } finally {
      setSaving(false);
    }
  };

  const editVariant = (variant) => {
    setContent(variant.summary);
    setDraftFrom({ text: variant.summary, origin: `AI · ${variant.label}` });
    setError("");
    setShowEditor(true);
  };

  const restoreVersion = async (entry) => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await restoreSummary(entry._id);
      setSummary(response.data.summary);
      setNotice("Restored that version. The summary it replaced is now under Previous versions.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to restore that version");
    } finally {
      setSaving(false);
    }
  };

  const removeVersion = async (entry) => {
    setSaving(true);
    setError("");

    try {
      const response = await deleteSummaryVersion(entry._id);
      setSummary(response.data.summary);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to remove that version");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!content.trim() || content.trim().length > 5000) {
      setError("Enter a summary between 1 and 5000 characters");
      return;
    }

    setSaving(true);
    setError("");

    const origin = !draftFrom
      ? MANUAL
      : content.trim() === draftFrom.text.trim() ? draftFrom.origin : `${draftFrom.origin} (edited)`;

    try {
      await saveText(content.trim(), origin);
      setNotice("");
      setShowEditor(false);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to save summary"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError("");

    try {
      await deleteSummary();
      setSummary(null);
      setContent("");
      setShowDelete(false);
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to delete summary"
      );
    } finally {
      setSaving(false);
    }
  };

  const wordCount = (text) =>
    text.trim() ? text.trim().split(/\s+/).length : 0;

  const lastUpdated = summary?.updatedAt
    ? new Date(summary.updatedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      })
    : null;

  return (
    <div className="container-fluid">
      <div className="mb-4">
        <h1 className="fw-bold">Professional Summary</h1>
        <p className="text-secondary">
          A short introduction that appears at the top of your portfolio.
        </p>
      </div>

      {error && !showEditor && !showDelete && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>{error}</Alert>
      )}
      {notice && (
        <Alert variant="success" dismissible onClose={() => setNotice("")}>{notice}</Alert>
      )}

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : summary ? (
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2 px-4 py-3">
            <h5 className="fw-semibold mb-0">
              <i className="bi bi-card-text me-2 text-primary" />
              About Me
              {summary.origin && (
                <Badge bg="secondary" className="ms-2 fw-normal align-middle small">{summary.origin}</Badge>
              )}
            </h5>

            <div className="btn-group btn-group-sm">
              <Button
                variant="outline-secondary"
                title="Edit"
                onClick={openEditor}
              >
                <i className="bi bi-pencil" />
              </Button>

              <Button
                variant="outline-danger"
                title="Delete"
                onClick={() => {
                  setError("");
                  setShowDelete(true);
                }}
              >
                <i className="bi bi-trash" />
              </Button>
            </div>
          </Card.Header>

          <Card.Body className="p-4">
            <p
              className="text-body mb-0 lh-lg"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {summary.content}
            </p>
          </Card.Body>

          {review.length > 0 && (
            <div className="px-4 pb-3">
              <SummaryCheckList checks={review} />
            </div>
          )}

          <Card.Footer className="bg-light border-0 d-flex justify-content-between flex-wrap gap-2 px-4 py-2 small text-secondary">
            <span>
              {wordCount(summary.content)} words ·{" "}
              {summary.content.length} / 5000 characters
            </span>
            {lastUpdated && <span>Last updated {lastUpdated}</span>}
          </Card.Footer>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5 px-4">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary bg-opacity-10 text-primary mb-3"
              style={{ width: 72, height: 72 }}
            >
              <i className="bi bi-file-earmark-text fs-2" />
            </div>
            <h5 className="fw-semibold">No summary yet</h5>
            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: 420 }}>
              Write two to four sentences about who you are, what you do,
              and what you're looking for next.
            </p>
            <Button onClick={openEditor}>
              <i className="bi bi-plus-lg me-2" />
              Add Summary
            </Button>
          </Card.Body>
        </Card>
      )}

      {!loading && (
        <SummaryAiWriter busy={saving} onUse={useVariant} onEdit={editVariant} />
      )}

      {!loading && summary && (
        <SummaryHistory
          history={summary.history}
          busy={saving}
          onRestore={restoreVersion}
          onDelete={removeVersion}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        show={showEditor}
        onHide={() => !saving && setShowEditor(false)}
        centered
        size="lg"
      >
        <Form onSubmit={handleSave}>
          <Modal.Header closeButton={!saving}>
            <Modal.Title>
              {draftFrom ? `Edit ${draftFrom.origin.replace("AI · ", "")} version` : summary ? "Edit Summary" : "Create Summary"}
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}

            <Form.Group>
              <Form.Label className="fw-semibold">
                Professional Summary
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={8}
                maxLength={5000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your professional summary..."
                required
              />
              <div className="d-flex justify-content-between mt-2 small text-secondary">
                <span>Tip: keep it focused and easy to scan.</span>
                <span>
                  {wordCount(content)} words · {content.length} / 5000
                </span>
              </div>
            </Form.Group>
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="outline-secondary"
              disabled={saving}
              onClick={() => setShowEditor(false)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving || !content.trim()}
            >
              {saving ? "Saving..." : "Save Summary"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        show={showDelete}
        onHide={() => !saving && setShowDelete(false)}
        centered
      >
        <Modal.Header closeButton={!saving}>
          <Modal.Title>Delete Summary?</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          Are you sure you want to delete your professional summary?
          Its previous versions are deleted with it. This action cannot be undone.
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => setShowDelete(false)}
          >
            Cancel
          </Button>

          <Button
            variant="danger"
            disabled={saving}
            onClick={handleDelete}
          >
            {saving ? "Deleting..." : "Delete Summary"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
