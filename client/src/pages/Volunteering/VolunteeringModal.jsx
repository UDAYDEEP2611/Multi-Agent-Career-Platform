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
import { CAUSES, VOLUNTEERING_LIMITS } from "./volunteeringOptions";

const emptyForm = {
  organization: "",
  role: "",
  cause: "",
  currentlyVolunteering: false,
  startMonth: "",
  startYear: "",
  endMonth: "",
  endYear: "",
  description: ""
};

const toNumber = (value) => (value === "" ? null : Number(value));

export default function VolunteeringModal({ show, volunteering, onHide, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm(
      volunteering
        ? Object.fromEntries(
            Object.keys(emptyForm).map((key) => [key, volunteering[key] ?? emptyForm[key]])
          )
        : emptyForm
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

  const submit = async (event) => {
    event.preventDefault();

    const dates = {
      startMonth: toNumber(form.startMonth),
      startYear: toNumber(form.startYear),
      endMonth: form.currentlyVolunteering ? null : toNumber(form.endMonth),
      endYear: form.currentlyVolunteering ? null : toNumber(form.endYear)
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
        ...dates,
        organization: form.organization.trim(),
        role: form.role.trim(),
        cause: form.cause,
        currentlyVolunteering: form.currentlyVolunteering,
        description: form.description.trim()
      });

      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save volunteering"
      );
    } finally {
      setSaving(false);
    }
  };

  const currentYear = new Date().getFullYear();

  const dateInputs = (prefix, label) => (
    <div className="d-flex gap-2">
      <Form.Select
        name={`${prefix}Month`}
        value={form[`${prefix}Month`]}
        onChange={change}
        aria-label={`${label} month`}
      >
        <option value="">Month</option>
        {MONTHS.map((month, index) => (
          <option key={month} value={index + 1}>{month}</option>
        ))}
      </Form.Select>
      <Form.Control
        type="number"
        name={`${prefix}Year`}
        value={form[`${prefix}Year`]}
        onChange={change}
        min={1900}
        max={currentYear}
        placeholder="Year"
        aria-label={`${label} year`}
      />
    </div>
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
          <Modal.Title>{volunteering ? "Edit Volunteer Experience" : "Add Volunteer Experience"}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <p className="small text-secondary">* Indicates required</p>

          <Row className="g-3">
            <Col xs={12}>
              <Form.Group controlId="volunteering-organization">
                <Form.Label>Organization *</Form.Label>
                <Form.Control
                  name="organization"
                  value={form.organization}
                  onChange={change}
                  required
                  maxLength={VOLUNTEERING_LIMITS.organization}
                  placeholder="Ex: Organization name"
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="volunteering-role">
                <Form.Label>Role *</Form.Label>
                <Form.Control
                  name="role"
                  value={form.role}
                  onChange={change}
                  required
                  maxLength={VOLUNTEERING_LIMITS.role}
                  placeholder="Ex: Volunteer role"
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="volunteering-cause">
                <Form.Label>Cause</Form.Label>
                <Form.Select name="cause" value={form.cause} onChange={change}>
                  <option value="">Please select</option>
                  {CAUSES.map((cause) => (
                    <option key={cause}>{cause}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Check
                type="checkbox"
                id="volunteering-current"
                name="currentlyVolunteering"
                label="I am currently volunteering in this role"
                checked={form.currentlyVolunteering}
                onChange={change}
              />
            </Col>

            <Col md={6}>
              <Form.Label>Start date</Form.Label>
              {dateInputs("start", "Start")}
            </Col>

            <Col md={6}>
              <Form.Label>End date</Form.Label>
              {form.currentlyVolunteering ? (
                <Form.Control value="Present" disabled />
              ) : (
                dateInputs("end", "End")
              )}
            </Col>

            <Col xs={12}>
              <div className="small text-secondary">Dates can't be in the future.</div>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="volunteering-description">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  name="description"
                  value={form.description}
                  onChange={change}
                  maxLength={VOLUNTEERING_LIMITS.description}
                  placeholder="What you did and the impact you made..."
                />
                <CharCount value={form.description} max={VOLUNTEERING_LIMITS.description} />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <div className="fw-semibold">Media</div>
              <div className="small text-secondary">
                {volunteering
                  ? `Add images, documents, sites or presentations (up to ${VOLUNTEERING_LIMITS.media}) on the role's page.`
                  : `After saving, the role's page opens so you can add images, documents, sites or presentations (up to ${VOLUNTEERING_LIMITS.media}).`}
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
