import { useEffect, useState } from "react";
import { Alert, Card, Form, Spinner, Table } from "react-bootstrap";

import AdminPage from "./AdminPage";
import { formatDateTime } from "./adminFormat";
import { getAdminAudit } from "../../api/adminApi";

export default function AdminAudit() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    getAdminAudit(500)
      .then(({ data }) => active && setEntries(data.entries || []))
      .catch((err) => active && setError(err.response?.data?.message || "Unable to load audit log"));

    return () => {
      active = false;
    };
  }, []);

  const query = search.trim().toLowerCase();
  const shown = (entries || []).filter((entry) =>
    !query ||
    [entry.action, entry.target, entry.details, entry.adminUsername]
      .some((value) => (value || "").toLowerCase().includes(query))
  );

  return (
    <AdminPage
      title="Audit Log"
      description="Every change made from the admin console, newest first."
      actions={
        <Form.Control
          type="search"
          style={{ maxWidth: 260 }}
          placeholder="Search actions"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search audit log"
        />
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}

      {!entries ? (
        !error && <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            <Table responsive hover className="mb-0 align-middle small">
              <thead className="table-light">
                <tr>
                  <th>When</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((entry) => (
                  <tr key={entry._id}>
                    <td className="text-nowrap text-secondary">{formatDateTime(entry.createdAt)}</td>
                    <td>{entry.adminUsername}</td>
                    <td className="fw-medium">{entry.action}</td>
                    <td className="text-break">{entry.target}</td>
                    <td className="text-secondary text-break">{entry.details}</td>
                  </tr>
                ))}

                {shown.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4">
                      {entries.length === 0 ? "No admin actions yet." : "Nothing matches."}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}
    </AdminPage>
  );
}
