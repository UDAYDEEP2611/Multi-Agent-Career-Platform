import { useEffect, useState } from "react";
import { Accordion, Alert, Badge, Button, Card, ProgressBar, Spinner, Table } from "react-bootstrap";

import AdminPage from "./AdminPage";
import StorageRing from "../Common/StorageRing";
import { formatBytes } from "./adminFormat";
import { levelColor, topSegments } from "./storageColors";
import { getAdminStorage } from "../../api/adminApi";

const percent = (used, limit) => `${Math.round((used / limit) * 1000) / 10}%`;

function Legend({ segments }) {
  return (
    <div className="d-flex flex-column gap-1 small" style={{ minWidth: 0 }}>
      {segments.map((segment) => (
        <div key={segment.label} className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
          <span className="rounded-circle flex-shrink-0" style={{ width: 10, height: 10, background: segment.color }} />
          <span className="text-truncate">{segment.label}</span>
          <span className="text-secondary ms-auto ps-2 text-nowrap">{formatBytes(segment.bytes)}</span>
        </div>
      ))}
    </div>
  );
}

const dbLabel = (db) =>
  db.kind === "main" ? "Main database" : db.owner ? db.owner.username : "Orphaned (no account)";

export default function AdminStorage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = () =>
    getAdminStorage()
      .then(({ data: response }) => setData(response))
      .catch((err) => setError(err.response?.data?.message || "Unable to load storage"));

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminPage
      title="Storage"
      description="Space each database and table takes on disk, against fixed limits."
      actions={
        <Button variant="outline-secondary" onClick={load}>
          <i className="bi bi-arrow-clockwise me-1" />Refresh
        </Button>
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}

      {!data ? (
        !error && <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : (
        <>
          {(() => {
            const ratio = data.usedBytes / data.limits.totalBytes;
            const segments = topSegments(
              data.databases.map((db) => ({ label: dbLabel(db), bytes: db.totalBytes }))
            );

            return (
              <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-4">
                  <div className="d-flex flex-wrap align-items-center gap-4">
                    <StorageRing segments={segments} limit={data.limits.totalBytes} size={200} stroke={22}>
                      <div className={`fs-4 fw-bold text-${levelColor(ratio)}-emphasis`}>
                        {percent(data.usedBytes, data.limits.totalBytes)}
                      </div>
                      <div className="small text-secondary">used</div>
                    </StorageRing>

                    <div className="flex-grow-1" style={{ minWidth: 220, maxWidth: 420 }}>
                      <h5 className="fw-bold mb-1">Total storage</h5>
                      <div className="mb-3">
                        <span className="fw-semibold">{formatBytes(data.usedBytes)}</span>
                        <span className="text-secondary"> of {formatBytes(data.limits.totalBytes)} limit · </span>
                        <span className="text-secondary">{formatBytes(Math.max(data.limits.totalBytes - data.usedBytes, 0))} free</span>
                      </div>
                      <Legend segments={segments} />
                    </div>
                  </div>
                </Card.Body>
              </Card>
            );
          })()}

          <h6 className="fw-semibold mb-2">By database</h6>
          <p className="small text-secondary">
            Each user database is measured against the {formatBytes(data.limits.perUserBytes)} per-user limit.
            Open one to see its tables.
          </p>

          <Accordion alwaysOpen className="shadow-sm">
            {data.databases.map((db) => {
              const limit = db.kind === "main" ? data.limits.totalBytes : data.limits.perUserBytes;
              const ratio = db.totalBytes / limit;
              const segments = topSegments(
                db.collections.map((item) => ({ label: item.name, bytes: item.totalBytes }))
              );

              return (
                <Accordion.Item eventKey={db.name} key={db.name}>
                  <Accordion.Header>
                    <div className="d-flex align-items-center gap-3 w-100 me-3" style={{ minWidth: 0 }}>
                      <StorageRing segments={segments} limit={limit} size={44} stroke={7} />

                      <div className="flex-grow-1" style={{ minWidth: 0 }}>
                        <div className="fw-semibold text-truncate">
                          {dbLabel(db)}
                          {db.kind === "main" && <Badge bg="primary" className="ms-2 fw-normal">Shared</Badge>}
                          {db.kind === "user" && !db.owner && (
                            <Badge bg="warning-subtle" text="warning-emphasis" className="ms-2 fw-normal border border-warning-subtle">
                              Orphaned
                            </Badge>
                          )}
                        </div>
                        <code className="small text-secondary">{db.name}</code>
                      </div>

                      <div className="text-end small text-nowrap">
                        <div className="fw-semibold">{formatBytes(db.totalBytes)}</div>
                        <div className={`text-${levelColor(ratio)}-emphasis`}>
                          {percent(db.totalBytes, limit)} of {formatBytes(limit)}
                        </div>
                      </div>
                    </div>
                  </Accordion.Header>

                  <Accordion.Body>
                    <div className="d-flex flex-wrap gap-4 align-items-start">
                      <StorageRing segments={segments} limit={limit} size={150} stroke={16}>
                        <div className="fw-bold">{formatBytes(db.totalBytes)}</div>
                        <div className="small text-secondary">{db.records} records</div>
                      </StorageRing>

                      <div className="flex-grow-1" style={{ minWidth: 260 }}>
                        <Table size="sm" responsive className="mb-0 align-middle small">
                          <thead>
                            <tr>
                              <th>Table</th>
                              <th className="text-end">Records</th>
                              <th className="text-end">Data</th>
                              <th className="text-end">Indexes</th>
                              <th className="text-end">On disk</th>
                              <th style={{ width: "25%" }}>Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {db.collections.map((item) => (
                              <tr key={item.name}>
                                <td><code>{item.name}</code></td>
                                <td className="text-end">{item.records}</td>
                                <td className="text-end text-nowrap">{formatBytes(item.dataBytes)}</td>
                                <td className="text-end text-nowrap">{formatBytes(item.indexBytes)}</td>
                                <td className="text-end text-nowrap fw-medium">{formatBytes(item.totalBytes)}</td>
                                <td>
                                  <ProgressBar
                                    now={db.totalBytes ? (item.totalBytes / db.totalBytes) * 100 : 0}
                                    style={{ height: 6 }}
                                    aria-label={`${item.name} share`}
                                  />
                                </td>
                              </tr>
                            ))}
                            {db.collections.length === 0 && (
                              <tr>
                                <td colSpan={6} className="text-center text-secondary py-3">No tables yet.</td>
                              </tr>
                            )}
                          </tbody>
                        </Table>
                      </div>
                    </div>
                  </Accordion.Body>
                </Accordion.Item>
              );
            })}
          </Accordion>

          <p className="small text-secondary mt-3">
            <i className="bi bi-info-circle me-1" />
            "On disk" is data plus indexes as MongoDB stores them (compressed, in 4 KB blocks), so even
            an empty table uses a few KB. Limits are set by <code>STORAGE_LIMIT_MB</code> and{" "}
            <code>USER_STORAGE_LIMIT_MB</code> in the server's <code>.env</code>. Uploaded files are
            stored outside the databases and aren't counted here.
          </p>
        </>
      )}
    </AdminPage>
  );
}
