import { useState } from "react";
import {
  Modal, Form, Button, Row, Col, Alert
} from "react-bootstrap";
import CharCount from "../Common/CharCount";
import { TEXT_LIMITS } from "../../limits";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const employmentTypes = [
  "Full-time", "Part-time", "Self-employed", "Freelance",
  "Contract", "Internship", "Apprenticeship", "Seasonal"
];

const jobSources = [
  "LinkedIn", "Company website", "Indeed", "Other job sites",
  "Referral", "Contacted by recruiter", "Staffing agency", "Other"
];

const emptyForm = {
  jobTitle: "",
  organization: "",
  location: "",
  locationType: "",
  employmentType: "",
  jobSource: "",
  currentlyWorking: false,
  startMonth: "",
  startYear: "",
  endMonth: "",
  endYear: "",
  summary: "",
  highlights: ""
};

export default function ExperienceModal({
  show,
  onHide,
  experience,
  onSave
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm(
      experience
        ? {
            ...emptyForm,
            ...experience,
            startMonth: experience.startMonth ?? "",
            startYear: experience.startYear ?? "",
            endMonth: experience.endMonth ?? "",
            endYear: experience.endYear ?? ""
          }
        : { ...emptyForm }
    );

    setError("");
  };

  const change = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      jobTitle: form.jobTitle.trim(),
      organization: form.organization.trim(),
      location: form.location.trim(),
      locationType: form.locationType,
      employmentType: form.employmentType,
      jobSource: form.jobSource,
      currentlyWorking: form.currentlyWorking,
      startMonth: form.startMonth === "" ? null : Number(form.startMonth),
      startYear: Number(form.startYear),
      endMonth: form.currentlyWorking || form.endMonth === ""
        ? null
        : Number(form.endMonth),
      endYear: form.currentlyWorking
        ? null
        : Number(form.endYear),
      summary: form.summary,
      highlights: form.highlights
    };

    try {
      await onSave(payload);
      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to save experience"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show={show}
      onShow={handleShow}
      onHide={saving ? undefined : onHide}
      size="lg"
      centered
      scrollable
      backdrop={saving ? "static" : true}
    >
      <Form onSubmit={save} className="d-flex flex-column overflow-hidden">
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            {experience ? "Edit Experience" : "Add Experience"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Job Title *</Form.Label>
                <Form.Control
                  name="jobTitle"
                  placeholder="Job title"
                  value={form.jobTitle}
                  onChange={change}
                  required
                  maxLength={200}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Organization *</Form.Label>
                <Form.Control
                  name="organization"
                  placeholder="Organization name"
                  value={form.organization}
                  onChange={change}
                  required
                  maxLength={200}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Location</Form.Label>
                <Form.Control
                  name="location"
                  placeholder="City, State or Remote"
                  value={form.location}
                  onChange={change}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Location Type</Form.Label>
                <Form.Select
                  name="locationType"
                  value={form.locationType}
                  onChange={change}
                >
                  <option value="">Please select</option>
                  {["On-site", "Hybrid", "Remote"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Employment Type</Form.Label>
                <Form.Select
                  name="employmentType"
                  value={form.employmentType}
                  onChange={change}
                >
                  <option value="">Please select</option>
                  {employmentTypes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Where did you find this job?</Form.Label>
                <Form.Select
                  name="jobSource"
                  value={form.jobSource}
                  onChange={change}
                >
                  <option value="">Please select</option>
                  {jobSources.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Check
                type="checkbox"
                label="I currently work here"
                name="currentlyWorking"
                checked={form.currentlyWorking}
                onChange={change}
              />
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Start Month</Form.Label>
                <Form.Select
                  name="startMonth"
                  value={form.startMonth}
                  onChange={change}
                >
                  <option value="">Month</option>
                  {months.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Start Year *</Form.Label>
                <Form.Control
                  type="number"
                  name="startYear"
                  placeholder="YYYY"
                  min={1900}
                  max={2100}
                  value={form.startYear}
                  onChange={change}
                  required
                />
              </Form.Group>
            </Col>

            {!form.currentlyWorking && (
              <>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>End Month</Form.Label>
                    <Form.Select
                      name="endMonth"
                      value={form.endMonth}
                      onChange={change}
                    >
                      <option value="">Month</option>
                      {months.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {month}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>End Year *</Form.Label>
                    <Form.Control
                      type="number"
                      name="endYear"
                      placeholder="YYYY"
                      min={1900}
                      max={2100}
                      value={form.endYear}
                      onChange={change}
                      required
                    />
                  </Form.Group>
                </Col>
              </>
            )}

            <Col xs={12}>
              <Form.Group>
                <Form.Label>Summary (Optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="summary"
                  placeholder="Brief summary of the role..."
                  value={form.summary}
                  onChange={change}
                  maxLength={TEXT_LIMITS.summary}
                />
                <CharCount value={form.summary} max={TEXT_LIMITS.summary} />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group>
                <Form.Label>Highlights (Optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  name="highlights"
                  placeholder="Key highlights..."
                  value={form.highlights}
                  onChange={change}
                  maxLength={TEXT_LIMITS.highlights}
                />
                <CharCount value={form.highlights} max={TEXT_LIMITS.highlights} />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={onHide}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Experience"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
