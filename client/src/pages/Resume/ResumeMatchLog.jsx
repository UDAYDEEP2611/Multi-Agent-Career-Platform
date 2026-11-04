import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, Spinner } from "react-bootstrap";
import { deleteMatchLog, getMatchLog } from "../../api/resumeApi";
import MatchResults from "./MatchResults";
import MatchQuickLook from "./MatchQuickLook";
import ResumeFilePreview from "./ResumeFilePreview";
import "./resume.css";

// One Log Book entry on its own page: the resume, the job and every result
export default function ResumeMatchLog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [log, setLog] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState(null);
  const [showJob, setShowJob] = useState(false);

  useEffect(() => {
    let active = true;
    getMatchLog(id)
      .then(({ data }) => active && setLog(data.log))
      .catch((err) => active && setError(err.response?.data?.message || "Unable to load this entry."));
    return () => {
      active = false;
    };
  }, [id]);

  const remove = async () => {
    if (!window.confirm(`Delete the comparison of ${log.fileName}?`)) return;
    try {
      await deleteMatchLog(id);
      navigate("/dashboard/resume-match/logs");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete this entry.");
    }
  };

  return (
    <div className="resume-page">
      <Link to="/dashboard/resume-match/logs" className="small d-inline-block mb-2">
        <i className="bi bi-arrow-left me-1" aria-hidden="true" />Log Book
      </Link>

      {error && <Alert variant="danger">{error}</Alert>}
      {!log && !error && <div className="text-center py-5"><Spinner size="sm" className="me-2" />Loading…</div>}

      {log && (
        <>
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
            <div>
              <h2 className="mb-1">{log.fileName}</h2>
              <p className="text-muted mb-0 small">
                {log.candidateName && <>{log.candidateName} · </>}
                {log.jobTitle || "Untitled job"} · Uploaded {new Date(log.createdAt).toLocaleString()} · Deleted automatically {new Date(log.expiresAt).toLocaleString()}
              </p>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Button variant="outline-secondary" onClick={() => setView("preview")}>
                <i className="bi bi-file-earmark-text me-1" />Preview
              </Button>
              <Button variant="outline-primary" onClick={() => setView("quick")}>
                <i className="bi bi-eye me-1" />Quick look
              </Button>
              <Button variant="outline-danger" onClick={remove}>
                <i className="bi bi-trash me-1" />Delete
              </Button>
            </div>
          </div>

          <Card className="shadow-sm mb-4">
            <Card.Body className="py-2">
              <Button variant="link" className="p-0 small" onClick={() => setShowJob((open) => !open)} aria-expanded={showJob}>
                <i className={`bi ${showJob ? "bi-chevron-down" : "bi-chevron-right"} me-1`} aria-hidden="true" />Job description
              </Button>
              {showJob && <pre className="small mt-2 mb-0" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", maxHeight: 320, overflowY: "auto" }}>{log.jobDescription}</pre>}
            </Card.Body>
          </Card>

          <MatchResults result={log.result} logId={id} onUpdate={(data) => setLog((current) => ({ ...current, result: { ...current.result, ...data }, overall: data.match.overall }))} />
          <MatchQuickLook show={view === "quick"} onHide={() => setView(null)} result={log.result} title={log.fileName} />
          <ResumeFilePreview show={view === "preview"} onHide={() => setView(null)} logId={id} fileType={log.fileType} fileName={log.fileName} text={log.text} />
        </>
      )}
    </div>
  );
}
