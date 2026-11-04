
import { useState } from "react";
import { Modal, Button, Form, Alert, Row, Col } from "react-bootstrap";

const emptyContact = {
  firstName: "",
  middleName: "",
  lastName: "",
  preferredName: "",
  suffix: "",
  email: "",
  phoneType: "",
  phoneNumber: "",
  alternateMobile: "",
  addressLine: "",
  country: "",
  stateProvince: "",
  city: "",
  county: "",
  postalCode: "",
  linkedinUrl: "",
  portfolioUrl: "",
  githubUrl: ""
};

const fields = [
  { name: "firstName", label: "First Name", required: true },
  { name: "middleName", label: "Middle Name" },
  { name: "lastName", label: "Last Name", required: true },
  { name: "preferredName", label: "Preferred Name" },
  { name: "suffix", label: "Suffix" },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "phoneNumber", label: "Phone Number", type: "tel", required: true },
  { name: "alternateMobile", label: "Alternate Mobile", type: "tel" },
  { name: "addressLine", label: "Address Line", required: true },
  { name: "country", label: "Country", required: true },
  { name: "stateProvince", label: "State / Province", required: true },
  { name: "city", label: "City", required: true },
  { name: "county", label: "County" },
  { name: "postalCode", label: "Postal Code", required: true },
  { name: "linkedinUrl", label: "LinkedIn URL", type: "url", required: true },
  { name: "portfolioUrl", label: "Portfolio URL", type: "url" },
  { name: "githubUrl", label: "GitHub URL", type: "url" }
];

export default function ContactDetailsModal({
  show,
  onHide,
  contact,
  onSave,
  isNew
}) {
  const [form, setForm] = useState(emptyContact);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm({ ...emptyContact, ...(contact || {}) });
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

    try {
      await onSave(form);
      onHide();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Unable to save contact details"
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
          <Modal.Title>
            {isNew ? "Create Contact Details" : "Edit Contact Details"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <Row className="g-3">
            {fields.map((field) => (
              <Col md={6} key={field.name}>
                <Form.Group>
                  <Form.Label>
                    {field.label}
                    {field.required && (
                      <span className="text-danger"> *</span>
                    )}
                  </Form.Label>

                  <Form.Control
                    type={field.type || "text"}
                    name={field.name}
                    value={form[field.name] || ""}
                    onChange={handleChange}
                    required={!!field.required}
                    maxLength={500}
                  />
                </Form.Group>
              </Col>
            ))}

            <Col md={6}>
              <Form.Group>
                <Form.Label>Phone Type (Optional)</Form.Label>
                <Form.Select
                  name="phoneType"
                  value={form.phoneType}
                  onChange={handleChange}
                >
                  <option value="">Select phone type</option>
                  <option value="Mobile">Mobile</option>
                  <option value="Home">Home</option>
                  <option value="Work">Work</option>
                  <option value="Other">Other</option>
                </Form.Select>
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
            {saving ? "Saving..." : "Save Contact Details"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
