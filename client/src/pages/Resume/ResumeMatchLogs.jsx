import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Spinner, Table } from "react-bootstrap";
import { deleteMatchLog, getMatchLog, listMatchLogs } from "../../api/resumeApi";
import MatchQuickLook from "./MatchQuickLook";
import ResumeFilePreview from "./ResumeFilePreview";
import { scoreColor } from "./matchHelpers";
import "./resume.css";
import { JobPilotIcon } from "../Layout/FeatureIcons";

const TYPE_LABELS = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/rtf": "RTF",
  "text/plain": "TXT"
};

// "in 41 h" / "in 25 min"
function expiresIn(date) {
  const minutes = Math.max(0, Math.round((new Date(date) - Date.now()) / 60000));
  return minutes >= 60 ? `in ${Math.round(minutes / 60)} h` : `in ${minutes} min`;
}

// The JobPilot Log Book: every comparison from the last 72 hours
export default function ResumeMatchLogs() {
  const [logs, setLogs] = useState(null);
  const [lifetime, setLifetime] = useState(72);
  const [error, setError] = useState("");
  // The entry open in Quick look or Preview: { log, detail }
  const [open, setOpen] = useState(null);
  const [view, setView] = useState(null);

  useEffect(() => {
    listMatchLogs()
      .then(({ data }) => {
        setLogs(data.logs);
        setLifetime(data.lifetimeHours);
      })
      .catch((err) => setError(err.response?.data?.message || "Unable to load your log book."));
  }, []);

  const show = async (log, kind) => {
    setError("");
    try {
      const { data } = await getMatchLog(log.id);
      setOpen({ log, detail: data.log });
      setView(kind);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to open this entry.");
    }
  };

  const remove = async (log) => {
    if (!window.confirm(`Delete the comparison of ${log.fileName}?`)) return;
    try {
      await deleteMatchLog(log.id);
      setLogs((list) => list.filter((item) => item.id !== log.id));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete this entry.");
    }
  };

  return (
    <div className="resume-page">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-4">
        <div>
          <h2 className="mb-1"><JobPilotIcon className="me-2" />JobPilot Log Book</h2>
          <p className="text-muted mb-0">
            Every resume you compared, with its job, results and recommendations. Entries are deleted automatically {lifetime} hours after upload.
          </p>
        </div>
        <Button as={Link} to="/dashboard/resume-match" variant="primary">
          <i className="bi bi-plus-lg me-1" />New comparison
        </Button>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError("")}>{error}</Alert>}

      <Card className="shadow-sm">
        <Card.Body>
          {!logs && !error && <div className="text-center py-4"><Spinner size="sm" className="me-2" />Loading…</div>}
          {logs?.length === 0 && (
            <div className="text-center text-muted py-4">
              <i className="bi bi-journal fs-3 d-block mb-2" aria-hidden="true" />
              No comparisons in the last {lifetime} hours. <Link to="/dashboard/resume-match">Compare a resume</Link>.
            </div>
          )}
          {logs?.length > 0 && (
            <Table responsive hover className="small align-middle mb-0">
              <thead>
                <tr>
                  <th>Resume</th>
                  <th>Job</th>
                  <th className="text-center">Match</th>
                  <th className="text-center">ATS</th>
                  <th>Uploaded</th>
                  <th>Deleted</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <Link to={`/dashboard/resume-match/logs/${log.id}`} className="fw-semibold">{log.fileName}</Link>
                      <div className="text-muted">
                        <Badge bg="light" text="dark" className="me-1">{TYPE_LABELS[log.fileType]}</Badge>
                        {log.candidateName}
                      </div>
                    </td>
                    <td>
                      {log.jobTitle || <span className="text-muted">Untitled job</span>}
                      {log.company && <div className="text-muted">{log.company}</div>}
                    </td>
                    <td className="text-center"><Badge bg={scoreColor(log.overall)}>{log.overall}</Badge></td>
                    <td className="text-center"><Badge bg={scoreColor(log.atsScore)}>{log.atsScore}</Badge></td>
                    <td className="text-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="text-nowrap text-muted">{expiresIn(log.expiresAt)}</td>
                    <td className="text-end text-nowrap">
                      <Button size="sm" variant="outline-primary" className="me-1" onClick={() => show(log, "quick")} title="Quick look">
                        <i className="bi bi-eye" /><span className="visually-hidden">Quick look</span>
                      </Button>
                      <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => show(log, "preview")} title="Preview resume">
                        <i className="bi bi-file-earmark-text" /><span className="visually-hidden">Preview</span>
                      </Button>
                      <Button size="sm" variant="outline-danger" onClick={() => remove(log)} title="Delete">
                        <i className="bi bi-trash" /><span className="visually-hidden">Delete</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {open && (
        <>
          <MatchQuickLook show={view === "quick"} onHide={() => setView(null)} result={open.detail.result} title={open.log.fileName} />
          <ResumeFilePreview
            show={view === "preview"}
            onHide={() => setView(null)}
            logId={open.log.id}
            fileType={open.log.fileType}
            fileName={open.log.fileName}
            text={open.detail.text}
          />
        </>
      )}
    </div>
  );
}
