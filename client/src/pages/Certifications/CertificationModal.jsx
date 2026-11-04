import { useState } from "react";
import {
  Alert,
  Button,
  Col,
  Form,
  Modal,
  Row,
  Spinner
} from "react-bootstrap";

import CharCount from "../Common/CharCount";
import CertificationSkillPicker from "./CertificationSkillPicker";
import { getSourceSkills } from "../../api/skillAssociationApi";
import { MONTHS } from "../Projects/projectOptions";
import { CERTIFICATION_LIMITS } from "./certificationOptions";
import { syncCertificationSkills } from "./syncCertificationSkills";

const emptyForm = {
  name: "",
  issuingOrganization: "",
  issueMonth: "",
  issueYear: "",
  expirationMonth: "",
  expirationYear: "",
  credentialId: "",
  credentialUrl: ""
};

const toNumber = (value) => (value === "" ? null : Number(value));

// Add/edit form. save(payload) stores the certification and returns it;
// the linked skills are then synced and onSaved(certification, warning)
// is called.
export default function CertificationModal({
  show,
  certification,
  onHide,
  save,
  onSaved
}) {
  const [form, setForm] = useState(emptyForm);
  const [skills, setSkills] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [loadingSkills, setLoadingSkills] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm(
      certification
        ? Object.fromEntries(
            Object.keys(emptyForm).map((key) => [key, certification[key] ?? ""])
          )
        : emptyForm
    );
    setSkills([]);
    setRemoved([]);
    setError("");

    if (!certification) return;

    setLoadingSkills(true);

    getSourceSkills("certification", certification._id)
      .then(({ data }) =>
        setSkills(
          (data.associations || []).map((item) => ({
            skillId: item.skillId._id,
            name: item.skillId.name,
            associationId: item._id
          }))
        )
      )
      .catch(() => setError("Unable to load linked skills"))
      .finally(() => setLoadingSkills(false));
  };

  const change = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const removeSkill = (skill) => {
    setSkills((previous) => previous.filter((item) => item !== skill));
    if (skill.associationId) {
      setRemoved((previous) => [...previous, skill.associationId]);
    }
  };

  const submit = async (event) => {
    event.preventDefault();

    const dates = {
      issueMonth: toNumber(form.issueMonth),
      issueYear: toNumber(form.issueYear),
      expirationMonth: toNumber(form.expirationMonth),
      expirationYear: toNumber(form.expirationYear)
    };

    if (dates.issueMonth !== null && dates.issueYear === null) {
      setError("Issue year is required when a month is selected");
      return;
    }

    if (dates.expirationMonth !== null && dates.expirationYear === null) {
      setError("Expiration year is required when a month is selected");
      return;
    }

    setSaving(true);
    setError("");

    let saved;

    try {
      saved = await save({
        ...dates,
        name: form.name.trim(),
        issuingOrganization: form.issuingOrganization.trim(),
        credentialId: form.credentialId.trim(),
        credentialUrl: form.credentialUrl.trim()
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save certification"
      );
      setSaving(false);
      return;
    }

    let warning = "";

    try {
      const errors = await syncCertificationSkills(saved._id, skills, removed);
      if (errors.length) warning = `Certification saved, but: ${errors.join("; ")}`;
    } catch {
      warning = "Certification saved, but its skills couldn't be updated.";
    }

    setSaving(false);
    onSaved(saved, warning);
    onHide();
  };

  const currentYear = new Date().getFullYear();

  const monthSelect = (name, label) => (
    <Form.Select name={name} value={form[name]} onChange={change} aria-label={label}>
      <option value="">Month</option>
      {MONTHS.map((month, index) => (
        <option key={month} value={index + 1}>
          {month}
        </option>
      ))}
    </Form.Select>
  );

  const yearInput = (name, label, max) => (
    <Form.Control
      type="number"
      name={name}
      value={form[name]}
      onChange={change}
      min={1900}
      max={max}
      placeholder="Year"
      aria-label={label}
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
          <Modal.Title>
            {certification ? "Edit License or Certification" : "Add License or Certification"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <p className="small text-secondary">* Indicates required</p>

          <Row className="g-3">
            <Col xs={12}>
              <Form.Group controlId="certification-name">
                <Form.Label>Name *</Form.Label>
                <Form.Control
                  name="name"
                  value={form.name}
                  onChange={change}
                  required
                  maxLength={CERTIFICATION_LIMITS.name}
                  placeholder="Ex: Certification name"
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="certification-organization">
                <Form.Label>Issuing organization (Optional)</Form.Label>
                <Form.Control
                  name="issuingOrganization"
                  value={form.issuingOrganization}
                  onChange={change}
                  maxLength={CERTIFICATION_LIMITS.issuingOrganization}
                  placeholder="Ex: Organization name"
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Label>Issue date</Form.Label>
              <div className="d-flex gap-2">
                {monthSelect("issueMonth", "Issue month")}
                {yearInput("issueYear", "Issue year", currentYear)}
              </div>
            </Col>

            <Col md={6}>
              <Form.Label>Expiration date</Form.Label>
              <div className="d-flex gap-2">
                {monthSelect("expirationMonth", "Expiration month")}
                {yearInput("expirationYear", "Expiration year", 2100)}
              </div>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="certification-credential-id">
                <Form.Label>Credential ID</Form.Label>
                <Form.Control
                  name="credentialId"
                  value={form.credentialId}
                  onChange={change}
                  maxLength={CERTIFICATION_LIMITS.credentialId}
                />
                <CharCount value={form.credentialId} max={CERTIFICATION_LIMITS.credentialId} />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group controlId="certification-credential-url">
                <Form.Label>Credential URL</Form.Label>
                <Form.Control
                  type="url"
                  name="credentialUrl"
                  value={form.credentialUrl}
                  onChange={change}
                  maxLength={2048}
                  placeholder="https://..."
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <div className="fw-semibold">Skills</div>
              <div className="small text-secondary mb-2">
                Associate at least 1 skill to this license or certification.
                New skills are added to your Skills section right away, after
                a spelling and duplicate check.
              </div>

              {loadingSkills ? (
                <Spinner animation="border" size="sm" />
              ) : (
                <CertificationSkillPicker
                  skills={skills}
                  disabled={saving}
                  onAdd={(skill) => setSkills((previous) => [...previous, skill])}
                  onRemove={removeSkill}
                />
              )}
            </Col>

            <Col xs={12}>
              <div className="fw-semibold">Media</div>
              <div className="small text-secondary">
                {certification
                  ? `Add images, documents, sites or presentations (up to ${CERTIFICATION_LIMITS.media}) on the certification page.`
                  : `After saving, the certification page opens so you can add images, documents, sites or presentations (up to ${CERTIFICATION_LIMITS.media}).`}
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
