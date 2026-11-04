import { Col, Form, Row } from "react-bootstrap";

import {
  ACHIEVEMENT_CATEGORIES,
  LINK_ICONS,
  LINK_TYPES,
  MONTHS,
  formatMonthYear
} from "./projectOptions";

const toNumber = (value) => (value === "" || value === null ? null : Number(value));

export const achievementsConfig = {
  title: "Achievements",
  itemLabel: "Achievement",
  section: "achievements",
  itemKey: "achievement",
  maxItems: 20,
  emptyText: "No achievements added yet. Add outcomes, metrics or milestones.",
  emptyForm: { title: "", category: "Outcome", metric: "", description: "", month: "", year: "" },
  toForm: (item) => ({
    title: item.title,
    category: item.category,
    metric: item.metric || "",
    description: item.description || "",
    month: item.month ?? "",
    year: item.year ?? ""
  }),
  toPayload: (form) => {
    if (form.month !== "" && form.year === "") {
      return { error: "Year is required when a month is selected" };
    }

    return {
      title: form.title.trim(),
      category: form.category,
      metric: form.metric.trim(),
      description: form.description.trim(),
      month: toNumber(form.month),
      year: toNumber(form.year)
    };
  },
  renderFields: (form, change) => (
    <Row className="g-3">
      <Col xs={12}>
        <Form.Group controlId="achievement-title">
          <Form.Label>Title *</Form.Label>
          <Form.Control name="title" value={form.title} onChange={change} required maxLength={200} placeholder="Achievement title" />
        </Form.Group>
      </Col>
      <Col sm={6}>
        <Form.Group controlId="achievement-category">
          <Form.Label>Category</Form.Label>
          <Form.Select name="category" value={form.category} onChange={change}>
            {ACHIEVEMENT_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </Form.Select>
        </Form.Group>
      </Col>
      <Col sm={6}>
        <Form.Group controlId="achievement-metric">
          <Form.Label>Result / Metric (Optional)</Form.Label>
          <Form.Control name="metric" value={form.metric} onChange={change} maxLength={100} placeholder="Measurable result" />
        </Form.Group>
      </Col>
      <Col sm={6}>
        <Form.Group controlId="achievement-month">
          <Form.Label>Month (Optional)</Form.Label>
          <Form.Select name="month" value={form.month} onChange={change}>
            <option value="">Month</option>
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>{month}</option>
            ))}
          </Form.Select>
        </Form.Group>
      </Col>
      <Col sm={6}>
        <Form.Group controlId="achievement-year">
          <Form.Label>Year (Optional)</Form.Label>
          <Form.Control type="number" name="year" value={form.year} onChange={change} min={1900} max={new Date().getFullYear()} placeholder="YYYY" />
        </Form.Group>
      </Col>
      <Col xs={12}>
        <Form.Group controlId="achievement-description">
          <Form.Label>Description (Optional)</Form.Label>
          <Form.Control as="textarea" rows={3} name="description" value={form.description} onChange={change} maxLength={2000} placeholder="Add details..." />
        </Form.Group>
      </Col>
    </Row>
  ),
  renderItem: (item) => (
    <>
      <div className="fw-semibold">
        {item.title}
        {item.metric && (
          <span className="badge rounded-pill bg-success-subtle text-success-emphasis border border-success-subtle fw-medium ms-2">
            {item.metric}
          </span>
        )}
      </div>
      <div className="small text-secondary">
        {[item.category, formatMonthYear(item.month, item.year)].filter(Boolean).join(" · ")}
      </div>
      {item.description && (
        <p className="small mt-1 mb-0" style={{ whiteSpace: "pre-line" }}>{item.description}</p>
      )}
    </>
  )
};

export const linksConfig = {
  title: "Links & Resources",
  itemLabel: "Link",
  section: "links",
  itemKey: "link",
  maxItems: 20,
  emptyText: "No links added yet. Add repositories, docs, demos or publications.",
  emptyForm: { title: "", linkType: "GitHub", url: "", description: "" },
  toForm: (item) => ({
    title: item.title,
    linkType: item.linkType,
    url: item.url,
    description: item.description || ""
  }),
  toPayload: (form) => ({
    title: form.title.trim(),
    linkType: form.linkType,
    url: form.url.trim(),
    description: form.description.trim()
  }),
  renderFields: (form, change) => (
    <Row className="g-3">
      <Col sm={7}>
        <Form.Group controlId="link-title">
          <Form.Label>Title *</Form.Label>
          <Form.Control name="title" value={form.title} onChange={change} required maxLength={200} placeholder="Link title" />
        </Form.Group>
      </Col>
      <Col sm={5}>
        <Form.Group controlId="link-type">
          <Form.Label>Type</Form.Label>
          <Form.Select name="linkType" value={form.linkType} onChange={change}>
            {LINK_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </Form.Select>
        </Form.Group>
      </Col>
      <Col xs={12}>
        <Form.Group controlId="link-url">
          <Form.Label>URL / Link *</Form.Label>
          <Form.Control type="url" name="url" value={form.url} onChange={change} required maxLength={2048} placeholder="https://..." />
        </Form.Group>
      </Col>
      <Col xs={12}>
        <Form.Group controlId="link-description">
          <Form.Label>Description (Optional)</Form.Label>
          <Form.Control as="textarea" rows={2} name="description" value={form.description} onChange={change} maxLength={500} placeholder="Add details..." />
        </Form.Group>
      </Col>
    </Row>
  ),
  renderItem: (item) => (
    <>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="fw-semibold text-decoration-none">
        <i className={`bi ${LINK_ICONS[item.linkType] || "bi-link-45deg"} me-2`} />
        {item.title}
        <i className="bi bi-box-arrow-up-right small ms-1" />
      </a>
      <div className="small text-secondary text-truncate">
        {item.linkType} · {item.url}
      </div>
      {item.description && <p className="small mt-1 mb-0">{item.description}</p>}
    </>
  )
};
