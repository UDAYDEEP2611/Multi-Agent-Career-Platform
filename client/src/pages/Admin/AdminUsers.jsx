import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Dropdown, Form, Modal, Spinner, Table } from "react-bootstrap";

import AdminPage from "./AdminPage";
import ConfirmTypedModal from "./ConfirmTypedModal";
import { formatBytes, formatDate } from "./adminFormat";
import {
  getAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  signOutAdminUser
} from "../../api/adminApi";

// What each simple action does, for its confirmation dialog
const actions = {
  makeAdmin: { change: { role: "admin" }, label: "Make admin", text: "can open the admin console and manage other accounts", variant: "primary" },
  removeAdmin: { change: { role: "user" }, label: "Remove admin", text: "loses admin access on their next click", variant: "warning" },
  disable: { change: { isDisabled: true }, label: "Disable", text: "is signed out everywhere and can't sign in. Their data is kept", variant: "danger" },
  enable: { change: { isDisabled: false }, label: "Enable", text: "can sign in again", variant: "success" },
  signOut: { label: "Sign out everywhere", text: "is signed out of every device. They can sign in again", variant: "warning" }
};

export default function AdminUsers() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const [pending, setPending] = useState(null); // { user, action }
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = () =>
    getAdminUsers()
      .then(({ data: response }) => setData(response))
      .catch((err) => setError(err.response?.data?.message || "Unable to load users"));

  useEffect(() => {
    load();
  }, []);

  const confirm = async () => {
    setBusy(true);

    try {
      if (pending.action === "signOut") {
        const { data: response } = await signOutAdminUser(pending.user.id);
        setNotice(`${pending.user.username}: ${response.ended} session(s) ended.`);
      } else {
        await updateAdminUser(pending.user.id, actions[pending.action].change);
        await load();
      }
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update user");
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const query = search.trim().toLowerCase();
  const users = (data?.users || []).filter(
    (user) => !query || user.username.includes(query) || user.email.includes(query)
  );

  return (
    <AdminPage
      title="Users"
      description="Every account, its access and its database."
      actions={
        <Form.Control
          type="search"
          style={{ maxWidth: 260 }}
          placeholder="Search username or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search users"
        />
      }
    >
      {error && <Alert variant="danger" dismissible onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert variant="success" dismissible onClose={() => setNotice("")}>{notice}</Alert>}

      {data && (
        <div className={`small mb-3 ${data.summary.total >= data.summary.maxUsers ? "text-danger" : "text-secondary"}`}>
          <i className="bi bi-people me-1" />
          {data.summary.total} of {data.summary.maxUsers} accounts used
          {data.summary.total >= data.summary.maxUsers
            ? ". Sign-up is closed until an account is deleted."
            : `, ${data.summary.maxUsers - data.summary.total} left.`}
        </div>
      )}

      {!data ? (
        !error && <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            <Table responsive hover className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Last sign-in</th>
                  <th>Database</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isMe = user.id === data.currentUserId;

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="fw-medium">
                          {user.username}
                          {isMe && <Badge bg="secondary" className="ms-2 fw-normal">You</Badge>}
                        </div>
                        <div className="small text-secondary">{user.email}</div>
                      </td>
                      <td>
                        {user.role === "admin"
                          ? <Badge bg="primary">Admin</Badge>
                          : <Badge bg="light" text="dark" className="border">User</Badge>}
                      </td>
                      <td>
                        {user.isDisabled
                          ? <Badge bg="danger-subtle" text="danger-emphasis" className="border border-danger-subtle">Disabled</Badge>
                          : <Badge bg="success-subtle" text="success-emphasis" className="border border-success-subtle">Active</Badge>}
                      </td>
                      <td className="small text-nowrap">{formatDate(user.createdAt)}</td>
                      <td className="small text-nowrap">{formatDate(user.lastLoginAt)}</td>
                      <td className="small">
                        <div className="text-nowrap">{user.database.records} records · {formatBytes(user.database.sizeBytes)}</div>
                        <code className="small text-secondary">{user.database.name}</code>
                      </td>
                      <td className="text-end">
                        {isMe ? (
                          <span className="small text-secondary">—</span>
                        ) : (
                          <Dropdown align="end">
                            <Dropdown.Toggle size="sm" variant="outline-secondary">Manage</Dropdown.Toggle>
                            <Dropdown.Menu>
                              <Dropdown.Item onClick={() => setPending({ user, action: user.role === "admin" ? "removeAdmin" : "makeAdmin" })}>
                                <i className="bi bi-shield-lock me-2" />
                                {user.role === "admin" ? "Remove admin" : "Make admin"}
                              </Dropdown.Item>
                              <Dropdown.Item onClick={() => setPending({ user, action: "signOut" })}>
                                <i className="bi bi-box-arrow-right me-2" />
                                Sign out everywhere
                              </Dropdown.Item>
                              <Dropdown.Item onClick={() => setPending({ user, action: user.isDisabled ? "enable" : "disable" })}>
                                <i className={`bi ${user.isDisabled ? "bi-check-circle" : "bi-slash-circle"} me-2`} />
                                {user.isDisabled ? "Enable account" : "Disable account"}
                              </Dropdown.Item>
                              <Dropdown.Divider />
                              <Dropdown.Item className="text-danger" onClick={() => setDeleting(user)}>
                                <i className="bi bi-trash me-2" />
                                Delete account
                              </Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-secondary py-4">No accounts match.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      <Modal show={!!pending} onHide={() => !busy && setPending(null)} centered>
        <Modal.Header closeButton={!busy}>
          <Modal.Title>{pending && actions[pending.action].label}?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pending && <><strong>{pending.user.username}</strong> {actions[pending.action].text}.</>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={busy} onClick={() => setPending(null)}>Cancel</Button>
          <Button variant={pending ? actions[pending.action].variant : "primary"} disabled={busy} onClick={confirm}>
            {busy ? "Saving..." : pending && actions[pending.action].label}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmTypedModal
        show={!!deleting}
        title="Delete account?"
        phrase={deleting?.username || ""}
        actionLabel="Delete account"
        onHide={() => setDeleting(null)}
        onConfirm={async (typed) => {
          await deleteAdminUser(deleting.id, typed);
          setNotice(`${deleting.username} was deleted.`);
          await load();
        }}
      >
        This permanently deletes <strong>{deleting?.username}</strong> ({deleting?.email}):
        their account, their database <code>{deleting?.database.name}</code> with all
        portfolio data, their uploaded files and their sessions. This can't be undone.
      </ConfirmTypedModal>
    </AdminPage>
  );
}
