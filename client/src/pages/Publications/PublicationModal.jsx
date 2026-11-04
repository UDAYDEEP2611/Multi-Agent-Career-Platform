import { useState } from "react";
import {
  Alert,
  Button,
  Form,
  Modal
} from "react-bootstrap";

import CharCount from "../Common/CharCount";
import PeoplePillsInput from "../Common/PeoplePillsInput";
import { addTypedName } from "../Common/addTypedName";
import { todayValue } from "../Common/calendarDate";
import { PUBLICATION_LIMITS } from "./publicationOptions";

const emptyForm = {
  title: "",
  publisher: "",
  publishedOn: "",
  coAuthors: [],
  url: "",
  description: ""
};

export default function PublicationModal({ show, publication, onHide, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const [authorText, setAuthorText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleShow = () => {
    setForm(
      publication
        ? {
            title: publication.title,
            publisher: publication.publisher,
            publishedOn: publication.publishedOn || "",
            coAuthors: publication.coAuthors,
            url: publication.url,
            description: publication.description
          }
        : emptyForm
    );
    setAuthorText("");
    setError("");
  };

  const change = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onSave({
        title: form.title.trim(),
        publisher: form.publisher.trim(),
        publishedOn: form.publishedOn || null,
        // A name typed but not yet added counts too
        coAuthors: addTypedName(form.coAuthors, authorText, PUBLICATION_LIMITS.coAuthors),
        url: form.url.trim(),
        description: form.description.trim()
      });
      onHide();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to save publication");
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
          <Modal.Title>{publication ? "Edit publication" : "Add publication"}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}

          <p className="small text-secondary">* Indicates required</p>

          <Form.Group className="mb-3" controlId="publication-title">
            <Form.Label>Title *</Form.Label>
            <Form.Control
              name="title"
              value={form.title}
              onChange={change}
              required
              maxLength={PUBLICATION_LIMITS.title}
              placeholder="Ex: Publication title"
            />
            <CharCount value={form.title} max={PUBLICATION_LIMITS.title} />
          </Form.Group>

          <Form.Group className="mb-3" controlId="publication-publisher">
            <Form.Label>Publication/Publisher</Form.Label>
            <Form.Control
              name="publisher"
              value={form.publisher}
              onChange={change}
              maxLength={PUBLICATION_LIMITS.publisher}
              placeholder="Ex: Journal or publisher name"
            />
            <CharCount value={form.publisher} max={PUBLICATION_LIMITS.publisher} />
          </Form.Group>

          <Form.Group className="mb-3" controlId="publication-date" style={{ maxWidth: 260 }}>
            <Form.Label>Publication date</Form.Label>
            <Form.Control
              type="date"
              name="publishedOn"
              value={form.publishedOn}
              onChange={change}
              min="1900-01-01"
              max={todayValue()}
            />
          </Form.Group>

          <div className="mb-3">
            <div className="fw-medium">Author</div>
            <div className="small text-secondary mb-2">
              You are an author. Add others that contributed to the publication.
            </div>

            <PeoplePillsInput
              names={form.coAuthors}
              onChange={(coAuthors) => setForm((previous) => ({ ...previous, coAuthors }))}
              text={authorText}
              onTextChange={setAuthorText}
              max={PUBLICATION_LIMITS.coAuthors}
              noun="author"
            />
          </div>

          <Form.Group className="mb-3" controlId="publication-url">
            <Form.Label>Publication URL</Form.Label>
            <Form.Control
              type="url"
              name="url"
              value={form.url}
              onChange={change}
              maxLength={2048}
              placeholder="https://..."
            />
          </Form.Group>

          <Form.Group controlId="publication-description">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              name="description"
              value={form.description}
              onChange={change}
              maxLength={PUBLICATION_LIMITS.description}
            />
            <CharCount value={form.description} max={PUBLICATION_LIMITS.description} />
          </Form.Group>
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
