import { useState } from "react";
import { Alert, Button, Card, Form } from "react-bootstrap";
import { changePassword } from "../../api/authApi";

export default function ChangePassword() {
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const updateField = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSaving(true);

    try {
      const { data } = await changePassword(form);
      setSuccess(data.message);
      setForm({ password: "", confirmPassword: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to change your password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto" style={{ maxWidth: 480 }}>
      <h2 className="mb-1">Reset Password</h2>
      <p className="text-muted mb-4">Enter a new password and retype it.</p>

      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="change-password">
              <Form.Label>New password</Form.Label>
              <Form.Control
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={updateField}
                autoComplete="new-password"
                minLength={12}
                maxLength={72}
                required
              />
              <Form.Text>12 to 72 characters.</Form.Text>
            </Form.Group>

            <Form.Group className="mb-3" controlId="change-password-confirm">
              <Form.Label>Retype new password</Form.Label>
              <Form.Control
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={form.confirmPassword}
                onChange={updateField}
                autoComplete="new-password"
                required
              />
            </Form.Group>

            <Form.Check
              className="mb-3"
              id="change-password-show"
              label="Show passwords"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />

            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            {success && <Alert variant="success" className="py-2 small">{success}</Alert>}

            <Button type="submit" className="w-100" disabled={saving}>
              {saving ? "Saving..." : "Save new password"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
