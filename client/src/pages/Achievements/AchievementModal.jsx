import { useState } from "react";
import {
  Alert,
  Button,
  Col,
  Form,
  Modal,
  Row
} from "react-bootstrap";

import CharCount from "../Common/CharCount";
import { MONTHS } from "../Projects/projectOptions";
import { ACHIEVEMENT_LIMITS, CATEGORIES } from "./achievementOptions";

const emptyForm = {
  title: "",
  category: "",
  issuer: "",
  result: "",
  context: "",
  month: "",
  year: "",
  description: "",
  url: "",
  featured: false
};

const toNumber = (value) => (value === "" ? null : Number(value));

// experiences / educations fill the "Associated with" dropdown
export default function AchievementModal({
  show,
  achievement,
  experiences,
  educations,
  onHide,
  onSave
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    if (achievement) {
      const values = Object.fromEntries(
        Object.keys(emptyForm).map((key) => [key, achievement[key] ?? emptyForm[key]])
      );
      values.context = achievement.contextType
        ? `${achievement.contextType}:${achievement.contextId}`
        : "";
      setForm(values);
    } else {
      setForm(emptyForm);
    }

    setError("");
  };

  const change = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    const month = toNumber(form.month);
    const year = toNumber(form.year);

    if (month !== null && year === null) {
      setError("Year is required when a month is selected");
      return;
    }

    const [contextType, contextId] = form.context ? form.context.split(":") : [null, null];

    setSaving(true);
    setError("");

    try {
      await onSave({
        title: form.title.trim(),
        category: form.category,
        issuer: form.issuer.trim(),
        result: form.result.trim(),
        contextType,
        contextId,
        month,
        year,
        description: form.description.trim(),
        url: form.url.trim(),
        featured: form.featured
      });

      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save achievement"
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
      keyboard={!saving}
    >
      <Form onSubmit={submit} className="d-flex flex-column overflow-hidden">
        <Modal.Header closeButton={!saving}>
          <Modal.Title>{achievement ? "Edit Activity or Achievement" : "Add Activity or Achievement"}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <p className="small text-secondary">* Indicates required</p>

          <Row className="g-3">
            <Col xs={12}>
              <Form.Group controlId="achievement-title">
                <Form.Label>Title *</Form.Label>
                <Form.Control
                  name="title"
                  value={form.title}
                  onChange={change}
                  required
                  maxLength={ACHIEVEMENT_LIMITS.title}
                  placeholder="Ex: Award or activity name"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group controlId="achievement-category">
                <Form.Label>Category *</Form.Label>
                <Form.Select name="category" value={form.category} onChange={change} required>
                  <option value="">Please select</option>
                  {CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group controlId="achievement-result">
                <Form.Label>Result or placement</Form.Label>
                <Form.Control
                  name="result"
                  value={form.result}
                  onChange={change}
                  maxLength={ACHIEVEMENT_LIMITS.result}
                  placeholder="Ex: 1st place, Finalist"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group controlId="achievement-issuer">
                <Form.Label>Issuer or organization</Form.Label>
                <Form.Control
                  name="issuer"
                  value={form.issuer}
                  onChange={change}
                  maxLength={ACHIEVEMENT_LIMITS.issuer}
                  placeholder="Ex: Organization name"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group controlId="achievement-context">
                <Form.Label>Associated with</Form.Label>
                <Form.Select name="context" value={form.context} onChange={change}>
                  <option value="">Not specified</option>
                  {experiences.length > 0 && (
                    <optgroup label="Experience">
                      {experiences.map((item) => (
                        <option key={item._id} value={`experience:${item._id}`}>
                          {item.jobTitle} at {item.organization}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {educations.length > 0 && (
                    <optgroup label="Education">
                      {educations.map((item) => (
                        <option key={item._id} value={`education:${item._id}`}>
                          {[item.degree, item.institution].filter(Boolean).join(" · ")}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Label>Date</Form.Label>
              <div className="d-flex gap-2">
                <Form.Select name="month" value={form.month} onChange={change} aria-label="Month">
                  <option value="">Month</option>
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </Form.Select>
                <Form.Control
                  type="number"
                  name="year"
                  value={form.year}
                  onChange={change}
                  min={1900}
                  max={new Date().getFullYear()}
                  placeholder="Year"
                  aria-label="Year"
                />
              </div>
              <div className="form-text">Can't be in the future.</div>
            </Col>

            <Col md={6}>
              <Form.Group controlId="achievement-url">
                <Form.Label>Link</Form.Label>
                <Form.Control
                  type="url"
                  name="url"
                  value={form.url}
                  onChange={change}
                  maxLength={2048}
                  placeholder="https://..."
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="achievement-description">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  name="description"
                  value={form.description}
                  onChange={change}
                  maxLength={ACHIEVEMENT_LIMITS.description}
                  placeholder="What it was for and what you did..."
                />
                <CharCount value={form.description} max={ACHIEVEMENT_LIMITS.description} />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <div className="border rounded p-3 bg-body-tertiary">
                <Form.Check
                  type="switch"
                  id="achievement-featured"
                  name="featured"
                  label={
                    <span className="fw-medium">
                      <i className="bi bi-star-fill text-warning me-1" />
                      Featured
                    </span>
                  }
                  checked={form.featured}
                  onChange={change}
                />
                <div className="small text-secondary mt-1">
                  Featured items are shown first.
                </div>
              </div>
            </Col>

            <Col xs={12}>
              <div className="fw-semibold">Media</div>
              <div className="small text-secondary">
                {achievement
                  ? `Add images, documents, sites or presentations (up to ${ACHIEVEMENT_LIMITS.media}) on its page.`
                  : `After saving, its page opens so you can add images, documents, sites or presentations (up to ${ACHIEVEMENT_LIMITS.media}).`}
              </div>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" disabled={saving} onClick={onHide}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
