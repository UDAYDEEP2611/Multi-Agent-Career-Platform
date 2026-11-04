import { useState } from "react";
import {
  Modal,
  Form,
  Button,
  Alert,
  Row,
  Col
} from "react-bootstrap";

const months = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
];

const shortMonths = months.map((month) => month.slice(0, 3));

const formatMonthYear = (month, year) =>
  `${month ? shortMonths[month - 1] + " " : ""}${year}`;

// A date given as year (+ optional month) covers a range of months
const monthRange = (year, month) => ({
  first: year * 12 + (month || 1),
  last: year * 12 + (month || 12)
});

// Same rule as the server: optional dates, not in the future, and within
// the parent's dates. parent: { startYear, startMonth, endYear, endMonth, ongoing }
function checkWithinParent(dates, parent, parentLabel) {
  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth() + 1;

  const parentStart = parent?.startYear
    ? monthRange(parent.startYear, parent.startMonth).first
    : -Infinity;
  const parentEnd = !parent || parent.ongoing || !parent.endYear
    ? Infinity
    : monthRange(parent.endYear, parent.endMonth).last;

  for (const [label, year, month] of [
    ["Start", dates.startYear, dates.startMonth],
    ["End", dates.endYear, dates.endMonth]
  ]) {
    if (year === null) continue;

    const range = monthRange(year, month);

    if (range.first > currentMonth) {
      return `${label} date can't be in the future`;
    }

    if (parent && (range.last < parentStart || range.first > parentEnd)) {
      return `${label} date must be within this ${parentLabel}'s dates (${parentRangeLabel(parent)})`;
    }
  }

  return "";
}

const parentRangeLabel = (parent) =>
  `${parent.startYear ? formatMonthYear(parent.startMonth, parent.startYear) : "…"} – ${
    parent.ongoing || !parent.endYear
      ? "Present"
      : formatMonthYear(parent.endMonth, parent.endYear)
  }`;

const emptyForm = {
  title: "",
  description: "",
  startMonth: "",
  startYear: "",
  endMonth: "",
  endYear: "",
  status: "In Progress"
};

// Used for Experience projects (parentLabel "job") and Education projects
// (parentLabel "education").

export default function ExperienceProjectModal({
  show,
  project,
  parent,
  parentLabel = "job",
  defaultStatus = "In Progress",
  onHide,
  onSave
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm(
      project
        ? {
            title: project.title || "",
            description: project.description || "",
            startMonth: project.startMonth ?? "",
            startYear: project.startYear ?? "",
            endMonth: project.endMonth ?? "",
            endYear: project.endYear ?? "",
            status: project.status || defaultStatus
          }
        : { ...emptyForm, status: defaultStatus }
    );

    setError("");
  };

  const change = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");

    const toNumber = (value) =>
      value === "" ? null : Number(value);

    const dates = {
      startMonth: toNumber(form.startMonth),
      startYear: toNumber(form.startYear),
      endMonth: toNumber(form.endMonth),
      endYear: toNumber(form.endYear)
    };

    for (const [label, month, year] of [
      ["Start", dates.startMonth, dates.startYear],
      ["End", dates.endMonth, dates.endYear]
    ]) {
      if (month !== null && year === null) {
        setError(`${label} year is required when a month is selected`);
        setSaving(false);
        return;
      }
    }

    const rangeError = checkWithinParent(dates, parent, parentLabel);

    if (rangeError) {
      setError(rangeError);
      setSaving(false);
      return;
    }

    try {
      await onSave({
        title: form.title.trim(),
        description: form.description.trim(),
        ...dates,
        status: form.status
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
            {project ? "Edit Project" : "Add Project"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && (
            <Alert variant="danger">{error}</Alert>
          )}

          {!project && (
            <p className="small text-secondary">
              After saving, the project page opens so you can add its tasks,
              contributors, skills and files.
            </p>
          )}

          <Row className="g-3">
            <Col xs={12}>
              <Form.Group>
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

            <Col xs={12}>
              <Form.Group>
                <Form.Label>Description (Optional)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  name="description"
                  value={form.description}
                  onChange={change}
                  maxLength={10000}
                  placeholder="Describe the project..."
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <div className="d-flex justify-content-between align-items-baseline flex-wrap gap-2">
                <span className="fw-medium">Dates (Optional)</span>

                {(form.startMonth || form.startYear || form.endMonth || form.endYear) && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        startMonth: "",
                        startYear: "",
                        endMonth: "",
                        endYear: ""
                      }))
                    }
                  >
                    Clear dates
                  </Button>
                )}
              </div>

              {parent && (
                <div className="small text-secondary">
                  Must be within this {parentLabel} ({parentRangeLabel(parent)}) and not in the future.
                </div>
              )}
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Start Month</Form.Label>
                <Form.Select
                  name="startMonth"
                  value={form.startMonth}
                  onChange={change}
                >
                  <option value="">Select month</option>
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
                <Form.Label>Start Year</Form.Label>
                <Form.Control
                  type="number"
                  name="startYear"
                  placeholder="YYYY"
                  min={parent?.startYear || 1900}
                  max={parent && !parent.ongoing && parent.endYear ? Math.min(parent.endYear, new Date().getFullYear()) : new Date().getFullYear()}
                  value={form.startYear}
                  onChange={change}
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>End Month</Form.Label>
                <Form.Select
                  name="endMonth"
                  value={form.endMonth}
                  onChange={change}
                >
                  <option value="">Select month</option>
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
                <Form.Label>End Year</Form.Label>
                <Form.Control
                  type="number"
                  name="endYear"
                  placeholder="YYYY"
                  min={parent?.startYear || 1900}
                  max={parent && !parent.ongoing && parent.endYear ? Math.min(parent.endYear, new Date().getFullYear()) : new Date().getFullYear()}
                  value={form.endYear}
                  onChange={change}
                />
              </Form.Group>
            </Col>

            <Col xs={12}>
              <Form.Group>
                <Form.Label>Status</Form.Label>
                <Form.Select
                  name="status"
                  value={form.status}
                  onChange={change}
                >
                  <option>Planned</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>On Hold</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={saving}
            onClick={onHide}
          >
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
