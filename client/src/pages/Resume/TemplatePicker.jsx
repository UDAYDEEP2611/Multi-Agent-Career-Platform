import { Card, Form } from "react-bootstrap";
import { RESUME_TEMPLATES } from "./resumeTemplates";

// Choose the resume design and section order; switching is instant
export default function TemplatePicker({ templateId, order, onTemplate, onOrder }) {
  return (
    <Card className="shadow-sm mb-3 resume-no-print">
      <Card.Body>
        <div className="fw-semibold mb-2">Template</div>

        <div className="d-grid gap-2 mb-3">
          {RESUME_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`resume-template-option ${template.id === templateId ? "active" : ""}`}
              onClick={() => onTemplate(template.id)}
              aria-pressed={template.id === templateId}
            >
              <span className="resume-template-swatch" style={{ "--swatch": template.swatch }} aria-hidden="true" />
              <span className="flex-grow-1">
                <span className="d-block fw-medium small">{template.name}</span>
                <span className="d-block text-muted" style={{ fontSize: 12 }}>{template.description}</span>
              </span>
              {template.id === templateId && <i className="bi bi-check-circle-fill text-primary" aria-hidden="true" />}
            </button>
          ))}
        </div>

        <p className="small text-muted mb-3">
          <i className="bi bi-file-earmark me-1" aria-hidden="true" />US Letter, 0.5 inch margins
        </p>

        <Form.Group controlId="resume-section-order">
          <Form.Label className="small fw-semibold mb-1">Section order</Form.Label>
          <Form.Select size="sm" value={order} onChange={(e) => onOrder(e.target.value)}>
            <option value="default">Template default</option>
            <option value="experience">Experience first</option>
            <option value="education">Education first (students, new grads)</option>
          </Form.Select>
        </Form.Group>
      </Card.Body>
    </Card>
  );
}
