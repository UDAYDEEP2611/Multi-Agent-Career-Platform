import { useState } from "react";
import {
  Alert,
  Button,
  ButtonGroup,
  Col,
  Form,
  Modal,
  Row,
  ToggleButton
} from "react-bootstrap";

import CharCount from "../Common/CharCount";
import SelectWithOther from "../Common/SelectWithOther";
import { MONTHS } from "../Projects/projectOptions";
import { RECOMMENDATION_LIMITS, RELATIONSHIPS } from "./recommendationOptions";

const emptyForm = {
  kind: "Recommendation",
  firstName: "",
  lastName: "",
  relationship: "",
  recommenderTitle: "",
  recommenderOrganization: "",
  context: "",
  text: "",
  month: "",
  year: "",
  profileUrl: "",
  email: "",
  phone: "",
  featured: false,
  visibility: "Public"
};

const toNumber = (value) => (value === "" ? null : Number(value));

// experiences / educations fill "Where you worked or studied together"
export default function RecommendationModal({
  show,
  recommendation,
  experiences,
  educations,
  onHide,
  onSave
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    if (recommendation) {
      const values = Object.fromEntries(
        Object.keys(emptyForm).map((key) => [key, recommendation[key] ?? emptyForm[key]])
      );
      values.context = recommendation.contextType
        ? `${recommendation.contextType}:${recommendation.contextId}`
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

  const set = (name) => (value) =>
    setForm((previous) => ({ ...previous, [name]: value }));

  const isReference = form.kind === "Reference";

  const submit = async (event) => {
    event.preventDefault();

    const month = toNumber(form.month);
    const year = toNumber(form.year);

    if (month !== null && year === null) {
      setError("Year is required when a month is selected");
      return;
    }

    const [contextType, contextId] = form.context ? form.context.split(":") : [null, null];
    const trimmed = Object.fromEntries(
      [
        "firstName", "lastName", "relationship", "recommenderTitle",
        "recommenderOrganization", "text", "profileUrl", "email", "phone"
      ].map((key) => [key, form[key].trim()])
    );

    setSaving(true);
    setError("");

    try {
      await onSave({
        ...trimmed,
        kind: form.kind,
        contextType,
        contextId,
        month,
        year,
        featured: form.featured,
        visibility: form.visibility
      });

      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save recommendation"
      );
    } finally {
      setSaving(false);
    }
  };

  const textField = (name, label, props = {}) => (
    <Form.Group controlId={`recommendation-${name}`}>
      <Form.Label>{label}</Form.Label>
      <Form.Control name={name} value={form[name]} onChange={change} {...props} />
    </Form.Group>
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
          <Modal.Title>
            {recommendation ? "Edit" : "Add"} {form.kind}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <ButtonGroup className="mb-2">
            {["Recommendation", "Reference"].map((kind) => (
              <ToggleButton
                key={kind}
                id={`recommendation-kind-${kind}`}
                type="radio"
                variant="outline-primary"
                name="kind"
                value={kind}
                checked={form.kind === kind}
                onChange={change}
              >
                <i className={`bi ${kind === "Reference" ? "bi-telephone" : "bi-chat-quote"} me-1`} />
                {kind}
              </ToggleButton>
            ))}
          </ButtonGroup>

          <p className="small text-secondary">
            {isReference
              ? "Someone who can vouch for you when contacted. Text is optional."
              : "What someone wrote about you. Paste their words as they wrote them."}{" "}
            * Indicates required.
          </p>

          <Row className="g-3">
            <Col md={6}>
              {textField("firstName", "First name *", { required: true, maxLength: 100 })}
            </Col>
            <Col md={6}>
              {textField("lastName", "Last name", { maxLength: 100 })}
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Relationship *</Form.Label>
                <SelectWithOther
                  value={form.relationship}
                  onChange={set("relationship")}
                  groups={RELATIONSHIPS}
                  placeholder="How do they know you?"
                  otherPlaceholder="Ex: Team lead"
                  label="Relationship"
                  maxLength={100}
                  required
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group controlId="recommendation-context">
                <Form.Label>Where you worked or studied together</Form.Label>
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
              {textField("recommenderTitle", "Their title", { maxLength: 150, placeholder: "Ex: Job title" })}
            </Col>
            <Col md={6}>
              {textField("recommenderOrganization", "Their organization", { maxLength: 150, placeholder: "Ex: Organization name" })}
            </Col>

            <Col xs={12}>
              <Form.Group controlId="recommendation-text">
                <Form.Label>
                  {isReference ? "What they can speak to" : "Recommendation text *"}
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={6}
                  name="text"
                  value={form.text}
                  onChange={change}
                  required={!isReference}
                  maxLength={RECOMMENDATION_LIMITS.text}
                  placeholder={
                    isReference
                      ? "Ex: Can speak to your work on a project"
                      : "Paste the recommendation here..."
                  }
                />
                <CharCount value={form.text} max={RECOMMENDATION_LIMITS.text} />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Label>{isReference ? "Date added" : "Date received"}</Form.Label>
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
            </Col>

            <Col md={6}>
              {textField("profileUrl", "Their profile URL", { type: "url", maxLength: 2048, placeholder: "https://..." })}
            </Col>

            <Col xs={12}>
              <span className="fw-medium">Contact details</span>
              <div className="small text-secondary">
                {isReference
                  ? "How an employer can reach them. Ask them before sharing."
                  : "Optional. Only add these if they agreed to be contacted."}
              </div>
            </Col>
            <Col md={6}>
              {textField("email", "Email", { type: "email", maxLength: 254, placeholder: "name@example.com" })}
            </Col>
            <Col md={6}>
              {textField("phone", "Phone", { type: "tel", maxLength: 30, placeholder: "Phone number" })}
            </Col>

            <Col md={6}>
              <Form.Group controlId="recommendation-visibility">
                <Form.Label>Visibility</Form.Label>
                <Form.Select name="visibility" value={form.visibility} onChange={change}>
                  <option value="Public">Public: shown in your portfolio</option>
                  <option value="Private">Private: only you can see it</option>
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6} className="d-flex align-items-end">
              <Form.Check
                type="switch"
                id="recommendation-featured"
                name="featured"
                className="mb-2"
                label={
                  <span className="fw-medium">
                    <i className="bi bi-star-fill text-warning me-1" />
                    Featured (shown first)
                  </span>
                }
                checked={form.featured}
                onChange={change}
              />
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
