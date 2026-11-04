
import { useState } from "react";
import {
  Modal,
  Button,
  Form,
  Alert,
  Row,
  Col
} from "react-bootstrap";

const emptyPersonal = {
  dateOfBirth: "",
  maritalStatus: "",
  gender: "",
  veteranStatus: "",
  disabilityStatus: "",
  ethnicity: "",
  authorizedToWork: "",
  futureSponsorship: ""
};

const maritalOptions = [
  "Single",
  "Married",
  "Divorced",
  "Widowed",
  "Separated",
  "Prefer not to say"
];

const genderOptions = [
  "Male",
  "Female",
  "Non-binary",
  "Self-describe",
  "Prefer not to say"
];

const ethnicityOptions = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Middle Eastern or North African",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Two or more races",
  "Self-describe",
  "Prefer not to say"
];

const booleanFields = [
  {
    name: "veteranStatus",
    label: "Are you a veteran?"
  },
  {
    name: "disabilityStatus",
    label: "Do you have a disability?"
  },
  {
    name: "authorizedToWork",
    label: "Are you authorized to work?"
  },
  {
    name: "futureSponsorship",
    label: "Will you require future sponsorship?"
  }
];

const toSelectValue = (value) => {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
};

const toBooleanOrNull = (value) => {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
};

export default function PersonalDetailsModal({
  show,
  onHide,
  personal,
  onSave
}) {
  const [form, setForm] = useState(emptyPersonal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    const data = personal || {};

    setForm({
      dateOfBirth: data.dateOfBirth
        ? String(data.dateOfBirth).slice(0, 10)
        : "",
      maritalStatus: data.maritalStatus || "",
      gender: data.gender || "",
      veteranStatus: toSelectValue(data.veteranStatus),
      disabilityStatus: toSelectValue(data.disabilityStatus),
      ethnicity: data.ethnicity || "",
      authorizedToWork: toSelectValue(data.authorizedToWork),
      futureSponsorship: toSelectValue(data.futureSponsorship)
    });

    setError("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      dateOfBirth: form.dateOfBirth || null,
      maritalStatus: form.maritalStatus,
      gender: form.gender,
      veteranStatus: toBooleanOrNull(form.veteranStatus),
      disabilityStatus: toBooleanOrNull(form.disabilityStatus),
      ethnicity: form.ethnicity,
      authorizedToWork: toBooleanOrNull(form.authorizedToWork),
      futureSponsorship: toBooleanOrNull(form.futureSponsorship)
    };

    try {
      await onSave(payload);
      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save personal details"
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
      <Form onSubmit={handleSubmit} className="d-flex flex-column overflow-hidden">
        <Modal.Header closeButton={!saving}>
          <Modal.Title>Edit Personal Details</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p className="text-secondary small">
            All fields are optional. These details are private
            and will not appear on your public portfolio.
          </p>

          {error && <Alert variant="danger">{error}</Alert>}

          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Date of Birth</Form.Label>
                <Form.Control
                  type="date"
                  name="dateOfBirth"
                  value={form.dateOfBirth}
                  max={new Date().toLocaleDateString("en-CA")}
                  onChange={handleChange}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Marital Status</Form.Label>
                <Form.Select
                  name="maritalStatus"
                  value={form.maritalStatus}
                  onChange={handleChange}
                >
                  <option value="">Select status</option>
                  {maritalOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Gender</Form.Label>
                <Form.Select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                >
                  <option value="">Select gender</option>
                  {genderOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Ethnicity</Form.Label>
                <Form.Select
                  name="ethnicity"
                  value={form.ethnicity}
                  onChange={handleChange}
                >
                  <option value="">Select ethnicity</option>
                  {ethnicityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            {booleanFields.map((field) => (
              <Col md={6} key={field.name}>
                <Form.Group>
                  <Form.Label>{field.label}</Form.Label>
                  <Form.Select
                    name={field.name}
                    value={form[field.name]}
                    onChange={handleChange}
                  >
                    <option value="">Prefer not to answer</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            ))}
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
            {saving ? "Saving..." : "Save Personal Details"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
