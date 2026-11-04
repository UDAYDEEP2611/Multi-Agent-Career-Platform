import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Spinner, Table } from "react-bootstrap";

import AdminPage from "./AdminPage";
import ConfirmTypedModal from "./ConfirmTypedModal";
import { formatBytes } from "./adminFormat";
import { getAdminDatabases, deleteOrphanedDatabase } from "../../api/adminApi";

export default function AdminDatabases() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(null);

  const load = () =>
    getAdminDatabases()
      .then(({ data: response }) => setData(response))
      .catch((err) => setError(err.response?.data?.message || "Unable to load databases"));

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminPage
      title="Databases"
      description="The main database and every user's own database."
      actions={
        <Button variant="outline-secondary" onClick={load}>
          <i className="bi bi-arrow-clockwise me-1" />Refresh
        </Button>
      }
    >
      {error && <Alert variant="danger" dismissible onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert variant="success" dismissible onClose={() => setNotice("")}>{notice}</Alert>}

      {!data ? (
        !error && <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : (
        <>
          <Card className="border-0 shadow-sm mb-4">
            <Card.Body>
              <div className="d-flex justify-content-between flex-wrap gap-2 mb-3">
                <div>
                  <h6 className="fw-semibold mb-0">
                    <i className="bi bi-hdd-stack me-2 text-primary" />
                    Main database: <code>{data.main.name}</code>
                  </h6>
                  <div className="small text-secondary">Accounts, sessions, admin log and shared skill suggestions</div>
                </div>
                <div className="small text-secondary">
                  {data.main.records} records · {formatBytes(data.main.dataBytes)}
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2">
                {data.main.collectionCounts.map((item) => (
                  <span key={item.name} className="badge rounded-pill text-bg-light border fw-normal">
                    {item.name} <span className="fw-semibold">{item.records}</span>
                  </span>
                ))}
              </div>
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm">
            <Card.Body className="p-0">
              <Table responsive hover className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>User database</th>
                    <th>Owner</th>
                    <th className="text-end">Collections</th>
                    <th className="text-end">Records</th>
                    <th className="text-end">On disk</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.databases.map((db) => (
                    <tr key={db.name}>
                      <td><code className="small">{db.name}</code></td>
                      <td>
                        {db.owner ? (
                          <>
                            <div className="fw-medium">{db.owner.username}</div>
                            <div className="small text-secondary">{db.owner.email}</div>
                          </>
                        ) : (
                          <Badge bg="warning-subtle" text="warning-emphasis" className="border border-warning-subtle">
                            Orphaned: no account
                          </Badge>
                        )}
                      </td>
                      <td className="text-end">{db.collections}</td>
                      <td className="text-end">{db.records}</td>
                      <td className="text-end text-nowrap">{formatBytes(db.sizeBytes)}</td>
                      <td className="text-end">
                        {db.orphaned ? (
                          <Button size="sm" variant="outline-danger" onClick={() => setDeleting(db)}>
                            Delete
                          </Button>
                        ) : (
                          <span className="small text-secondary">—</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {data.databases.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-secondary py-4">No user databases yet.</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {data.usersWithoutDatabase.length > 0 && (
            <p className="small text-secondary mt-3">
              <i className="bi bi-info-circle me-1" />
              No database yet (created on their next sign-in):{" "}
              {data.usersWithoutDatabase.map((user) => user.username).join(", ")}
            </p>
          )}
        </>
      )}

      <ConfirmTypedModal
        show={!!deleting}
        title="Delete orphaned database?"
        phrase={deleting?.name || ""}
        actionLabel="Delete database"
        onHide={() => setDeleting(null)}
        onConfirm={async (typed) => {
          await deleteOrphanedDatabase(deleting.userId, typed);
          setNotice(`${deleting.name} was deleted.`);
          await load();
        }}
      >
        <code>{deleting?.name}</code> has no account. Deleting it removes its{" "}
        {deleting?.records} records and any uploaded files it references. This
        can't be undone.
      </ConfirmTypedModal>
    </AdminPage>
  );
}
