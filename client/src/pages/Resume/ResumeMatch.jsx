import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { compareResume, getJobInfo } from "../../api/resumeApi";
import MatchResults from "./MatchResults";
import MatchQuickLook from "./MatchQuickLook";
import ResumeFilePreview from "./ResumeFilePreview";
import "./resume.css";
import { JobPilotIcon } from "../Layout/FeatureIcons";
import DemoJobPicker from "../../demo/DemoJobPicker";
import { STATIC_SITE } from "../../staticSite";

const JOB_DESCRIPTION_MAX = 8000;
const ACCEPT = ".pdf,.docx,.rtf,.txt,.md";

// Upload a resume and a job description; see how well they match
export default function ResumeMatch() {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const abortRef = useRef(null);
  // Company and job title: typed, or filled from the job description until the user edits them
  const [details, setDetails] = useState({ company: "", jobTitle: "" });
  const [edited, setEdited] = useState({ company: false, jobTitle: false });
  const [detected, setDetected] = useState({ company: false, jobTitle: false });

  useEffect(() => {
    if (jobDescription.trim().length < 50 || (edited.company && edited.jobTitle)) return undefined;
    const controller = new AbortController();
    // Wait for the paste or typing to settle
    const timer = setTimeout(() => {
      getJobInfo(jobDescription, controller.signal)
        .then(({ data }) => {
          setDetails((current) => ({
            company: edited.company ? current.company : data.company || "",
            jobTitle: edited.jobTitle ? current.jobTitle : data.title || ""
          }));
          setDetected((current) => ({
            company: edited.company ? current.company : Boolean(data.company),
            jobTitle: edited.jobTitle ? current.jobTitle : Boolean(data.title)
          }));
        })
        .catch(() => {});
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [jobDescription, edited.company, edited.jobTitle]);

  const editDetail = (field, value) => {
    setDetails((current) => ({ ...current, [field]: value }));
    // Clearing a field hands it back to detection
    setEdited((current) => ({ ...current, [field]: Boolean(value.trim()) }));
    setDetected((current) => ({ ...current, [field]: false }));
  };

  const compare = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data } = await compareResume(file, jobDescription.trim(), controller.signal, { company: details.company.trim(), jobTitle: details.jobTitle.trim() });
      setResult(data);
    } catch (err) {
      if (!controller.signal.aborted) setError(err.response?.data?.message || "Unable to compare the resume.");
    } finally {
      setLoading(false);
    }
  };

  const [preview, setPreview] = useState(false);
  const [quickLook, setQuickLook] = useState(false);

  return (
    <div className="resume-page">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-4">
        <div>
          <h2 className="mb-1"><JobPilotIcon className="me-2" />JobPilot</h2>
          <p className="text-muted mb-0">
            {STATIC_SITE ? "Paste a job description or try a sample job" : "Upload any resume and paste a job description"} to see how well they match: keywords, responsibilities and qualifications, for any kind of role.
          </p>
        </div>
        <Button as={Link} to="/dashboard/resume-match/logs" variant="outline-primary">
          <i className="bi bi-journal-text me-1" />Log Book
        </Button>
      </div>

      <Card className="shadow-sm mb-4">
        <Card.Body>
          <Form onSubmit={compare}>
            <Row className="g-3">
              <Col lg={4}>
                {STATIC_SITE ? (
                  <DemoJobPicker
                    file={file}
                    onFile={setFile}
                    onPreview={() => setPreview(true)}
                    onJob={(description) => {
                      setJobDescription(description);
                      setResult(null);
                    }}
                  />
                ) : (
                <Form.Group controlId="match-resume-file">
                  <Form.Label className="small fw-semibold">Resume</Form.Label>
                  <Form.Control
                    type="file"
                    accept={ACCEPT}
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      setResult(null);
                    }}
                  />
                  <Form.Text>PDF, DOCX, RTF or TXT, up to 10 MB. Scanned PDFs (images) can't be read.</Form.Text>
                  {file && (
                    <div className="mt-2">
                      <Button size="sm" variant="outline-secondary" onClick={() => setPreview(true)}>
                        <i className="bi bi-file-earmark-text me-1" />Preview {file.name}
                      </Button>
                    </div>
                  )}
                </Form.Group>
                )}
              </Col>
              <Col lg={8}>
                <Row className="g-2 mb-2">
                  <Col sm={6}>
                    <Form.Group controlId="match-company">
                      <Form.Label className="small fw-semibold">Company <span className="fw-normal text-muted">(optional)</span></Form.Label>
                      <Form.Control value={details.company} maxLength={80} placeholder="Read from the job description" onChange={(e) => editDetail("company", e.target.value)} />
                      {detected.company && <Form.Text><i className="bi bi-magic me-1" aria-hidden="true" />Detected from the job description; change it if it's wrong.</Form.Text>}
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group controlId="match-job-title">
                      <Form.Label className="small fw-semibold">Job title <span className="fw-normal text-muted">(optional)</span></Form.Label>
                      <Form.Control value={details.jobTitle} maxLength={120} placeholder="Read from the job description" onChange={(e) => editDetail("jobTitle", e.target.value)} />
                      {detected.jobTitle && <Form.Text><i className="bi bi-magic me-1" aria-hidden="true" />Detected from the job description; change it if it's wrong.</Form.Text>}
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group controlId="match-job-description">
                  <Form.Label className="small fw-semibold">Job description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={7}
                    value={jobDescription}
                    maxLength={JOB_DESCRIPTION_MAX}
                    placeholder="Paste the whole posting: title, responsibilities, qualifications"
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                  <Form.Text>{jobDescription.length}/{JOB_DESCRIPTION_MAX}</Form.Text>
                </Form.Group>
              </Col>
            </Row>
            <div className="d-flex align-items-center gap-2 mt-3">
              <Button type="submit" disabled={loading || !file || jobDescription.trim().length < 50}>
                {loading ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-search me-1" />}Compare
              </Button>
              {loading && <span className="small text-muted">JobPilot is reading the resume and the job. This can take a minute…</span>}
            </div>
          </Form>
        </Card.Body>
      </Card>

      {error && <Alert variant="danger" dismissible onClose={() => setError("")}>{error}</Alert>}

      {result && (
        <>
          <Alert variant="success" className="d-flex flex-wrap align-items-center gap-2 py-2">
            <span className="me-auto small">
              <i className="bi bi-check-circle me-1" aria-hidden="true" />
              Compared{result.logId ? " and saved to your Log Book for 72 hours" : ""}.
            </span>
            <Button size="sm" variant="outline-secondary" onClick={() => setPreview(true)}>
              <i className="bi bi-file-earmark-text me-1" />Preview
            </Button>
            <Button size="sm" variant="outline-primary" onClick={() => setQuickLook(true)}>
              <i className="bi bi-eye me-1" />Quick look
            </Button>
            {result.logId && (
              <Button size="sm" as={Link} to={`/dashboard/resume-match/logs/${result.logId}`} variant="outline-primary">
                <i className="bi bi-box-arrow-up-right me-1" />Open in Log Book
              </Button>
            )}
          </Alert>
          <MatchResults result={result} logId={result.logId} onUpdate={(data) => setResult((current) => ({ ...current, ...data }))} />
          <MatchQuickLook show={quickLook} onHide={() => setQuickLook(false)} result={result} title={file?.name} />
        </>
      )}

      <ResumeFilePreview
        show={preview}
        onHide={() => setPreview(false)}
        file={file}
        fileName={file?.name}
        text={result?.text}
        fileType={file?.type}
      />
    </div>
  );
}
