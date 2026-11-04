import { useState } from "react";
import {
  Alert,
  Button,
  Col,
  Form,
  Modal,
  Row
} from "react-bootstrap";

import { DEFAULT_PROJECT_ROLE, MONTHS, PROJECT_STATUSES, PROJECT_TYPES } from "./projectOptions";

const emptyForm = {
  title: "",
  projectType: "Personal",
  role: DEFAULT_PROJECT_ROLE,
  description: "",
  startMonth: "",
  startYear: "",
  ongoing: false,
  endMonth: "",
  endYear: "",
  status: "Completed",
  githubUrl: "",
  demoUrl: "",
  websiteUrl: "",
  featured: false,
  visibility: "Public"
};

const toNumber = (value) => (value === "" ? null : Number(value));

export default function ProjectModal({ show, project, onHide, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm(
      project
        ? Object.fromEntries(
            Object.keys(emptyForm).map((key) => [key, project[key] ?? emptyForm[key]])
          )
        : emptyForm
    );
    setError("");
  };

  const change = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
      // Ongoing means In Progress, else Completed; the status can still be
      // changed to Planned or On Hold
      ...(name === "ongoing" ? { status: checked ? "In Progress" : "Completed" } : {})
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    const dates = {
      startMonth: toNumber(form.startMonth),
      startYear: toNumber(form.startYear),
      endMonth: form.ongoing ? null : toNumber(form.endMonth),
      endYear: form.ongoing ? null : toNumber(form.endYear)
    };

    if (dates.startMonth !== null && dates.startYear === null) {
      setError("Start year is required when a month is selected");
      return;
    }

    if (dates.endMonth !== null && dates.endYear === null) {
      setError("End year is required when a month is selected");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave({
        ...form,
        ...dates,
        title: form.title.trim(),
        role: form.role.trim(),
        description: form.description.trim(),
        githubUrl: form.githubUrl.trim(),
        demoUrl: form.demoUrl.trim(),
        websiteUrl: form.websiteUrl.trim()
      });

      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save project"
      );
    } finally {
      setSaving(false);
    }
  };

  const currentYear = new Date().getFullYear();

  const monthSelect = (name) => (
    <Form.Select name={name} value={form[name]} onChange={change}>
      <option value="">Month</option>
      {MONTHS.map((month, index) => (
        <option key={month} value={index + 1}>
          {month}
        </option>
      ))}
    </Form.Select>
  );

  const yearInput = (name) => (
    <Form.Control
      type="number"
      name={name}
      value={form[name]}
      onChange={change}
      min={1900}
      max={currentYear}
      placeholder="YYYY"
    />
  );

  return (
    <Modal
      show={show}
      onShow={handleShow}
      onHide={saving ? undefined : onHide}
      size="lg"
      centered
      scrollable
      backdrop={saving ? "static" : true}
      keyboard={!saving}
    >
      <Form onSubmit={submit} className="d-flex flex-column overflow-hidden">
        <Modal.Header closeButton={!saving}>
          <Modal.Title>{project ? "Edit Project" : "Add Project"}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          {!project && (
            <p className="small text-secondary">
              After saving, the project page opens so you can add its tasks,
              contributors, skills, media, achievements and links.
            </p>
          )}

          <Row className="g-3">
            <Col xs={12}>
              <Form.Group controlId="project-title">
                <Form.Label>Project Title *</Form.Label>
                <Form.Control
                  name="title"
                  value={form.title}
                  onChange={change}
                  required
                  maxLength={200}
                  placeholder="Project name"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group controlId="project-type">
                <Form.Label>Project Type</Form.Label>
                <Form.Select name="projectType" value={form.projectType} onChange={change}>
                  {PROJECT_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group controlId="project-role">
                <Form.Label>Your Role</Form.Label>
                <Form.Control
                  name="role"
                  value={form.role}
                  onChange={change}
                  maxLength={150}
                  placeholder={DEFAULT_PROJECT_ROLE}
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="project-description">
                <Form.Label>Description (Optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  name="description"
                  value={form.description}
                  onChange={change}
                  maxLength={10000}
                  placeholder="Describe the project..."
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <span className="fw-medium">Dates (Optional)</span>
              <div className="small text-secondary">Dates can't be in the future.</div>
            </Col>

            <Col md={6}>
              <Form.Label>Start Date</Form.Label>
              <div className="d-flex gap-2">
                {monthSelect("startMonth")}
                {yearInput("startYear")}
              </div>
            </Col>

            <Col md={6}>
              <Form.Label>End Date</Form.Label>
              {form.ongoing ? (
                <Form.Control value="Present" disabled />
              ) : (
                <div className="d-flex gap-2">
                  {monthSelect("endMonth")}
                  {yearInput("endYear")}
                </div>
              )}
              <Form.Check
                type="switch"
                id="project-ongoing"
                name="ongoing"
                label="Ongoing"
                className="mt-2"
                checked={form.ongoing}
                onChange={change}
              />
            </Col>

            <Col md={6}>
              <Form.Group controlId="project-status">
                <Form.Label>Status</Form.Label>
                <Form.Select name="status" value={form.status} onChange={change}>
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group controlId="project-visibility">
                <Form.Label>Visibility</Form.Label>
                <Form.Select name="visibility" value={form.visibility} onChange={change}>
                  <option value="Public">Public: shown in your portfolio</option>
                  <option value="Private">Private: only you can see it</option>
                </Form.Select>
              </Form.Group>
            </Col>

            {[
              ["githubUrl", "GitHub URL (Optional)", "https://github.com/..."],
              ["demoUrl", "Live Demo URL (Optional)", "https://..."],
              ["websiteUrl", "Project Website (Optional)", "https://..."]
            ].map(([name, label, placeholder]) => (
              <Col md={name === "websiteUrl" ? 12 : 6} key={name}>
                <Form.Group controlId={`project-${name}`}>
                  <Form.Label>{label}</Form.Label>
                  <Form.Control
                    type="url"
                    name={name}
                    value={form[name]}
                    onChange={change}
                    maxLength={2048}
                    placeholder={placeholder}
                  />
                </Form.Group>
              </Col>
            ))}

            <Col xs={12}>
              <div className="border rounded p-3 bg-body-tertiary">
                <Form.Check
                  type="switch"
                  id="project-featured"
                  name="featured"
                  label={
                    <span className="fw-medium">
                      <i className="bi bi-star-fill text-warning me-1" />
                      Featured project
                    </span>
                  }
                  checked={form.featured}
                  onChange={change}
                />
                <div className="small text-secondary mt-1">
                  Featured projects are shown first and highlighted in your portfolio.
                </div>
              </div>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" disabled={saving} onClick={onHide}>
            Cancel
          </Button>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Project"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
