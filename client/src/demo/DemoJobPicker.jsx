import { useEffect } from "react";
import { Button, Form } from "react-bootstrap";

import { getDemoResume } from "../api/resumeApi";
import accounts from "./demoAccounts.json";
import jobs from "./demoJobs.json";
import { demoAccount } from "./demoMode";

// JobPilot's resume box in the demo: the demo person's resume, and sample jobs
export default function DemoJobPicker({ file, onFile, onPreview, onJob }) {
  const account = demoAccount();
  const name = accounts.find(({ id }) => id === account)?.name;

  useEffect(() => {
    let active = true;
    getDemoResume().then(({ data }) => {
      if (active) onFile(new File([data.text], data.fileName, { type: "text/plain" }));
    });
    return () => {
      active = false;
    };
  }, [onFile]);

  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label className="small fw-semibold">Resume</Form.Label>
        <div className="small">{name}'s resume, written from their portfolio</div>
        <Form.Text>The demo can't read uploaded files. It checks with rules only, without AI.</Form.Text>
        {file && (
          <div className="mt-2">
            <Button size="sm" variant="outline-secondary" onClick={onPreview}>
              <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />Preview resume
            </Button>
          </div>
        )}
      </Form.Group>
      <Form.Group controlId="match-sample-job">
        <Form.Label className="small fw-semibold">Try a sample job</Form.Label>
        <Form.Select defaultValue="" onChange={(event) => event.target.value && onJob(event.target.value)}>
          <option value="">Choose one, or paste your own</option>
          {(jobs[account] || []).map((job) => <option key={job.label} value={job.description}>{job.label}</option>)}
        </Form.Select>
      </Form.Group>
    </>
  );
}
