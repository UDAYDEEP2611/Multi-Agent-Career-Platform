import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Spinner } from "react-bootstrap";

import AdminPage from "./AdminPage";
import { formatBytes, formatDuration } from "./adminFormat";
import { getAdminSystem, clearAdminCache } from "../../api/adminApi";

const Row = ({ label, children }) => (
  <div className="d-flex justify-content-between gap-3 border-bottom py-2 small">
    <span className="text-secondary">{label}</span>
    <span className="fw-medium text-end text-break">{children}</span>
  </div>
);

export default function AdminSystem() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clearing, setClearing] = useState(false);

  const load = () =>
    getAdminSystem()
      .then(({ data: response }) => setData(response))
      .catch((err) => setError(err.response?.data?.message || "Unable to load system status"));

  useEffect(() => {
    load();
  }, []);

  const clear = async () => {
    setClearing(true);

    try {
      const { data: response } = await clearAdminCache();
      setNotice(`Cache cleared (${response.cleared} databases). Each is set up again on its user's next request.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to clear cache");
    } finally {
      setClearing(false);
    }
  };

  return (
    <AdminPage
      title="System & Cache"
      description="Server health, database connection and the server's cache."
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
        <div className="row g-3">
          <div className="col-lg-6">
            <Card className="border-0 shadow-sm h-100">
              <Card.Body>
                <h6 className="fw-semibold mb-3"><i className="bi bi-cpu me-2 text-primary" />Server</h6>
                <Row label="Uptime">{formatDuration(data.server.uptimeSeconds)}</Row>
                <Row label="Environment">{data.server.environment}</Row>
                <Row label="Node.js">{data.server.nodeVersion}</Row>
                <Row label="Platform">{data.server.platform}</Row>
                <Row label="Memory (RSS)">{formatBytes(data.server.memory.rssBytes)}</Row>
                <Row label="Heap used">
                  {formatBytes(data.server.memory.heapUsedBytes)} of {formatBytes(data.server.memory.heapTotalBytes)}
                </Row>
                <Row label="AI skill check">
                  {data.aiSkillCheck
                    ? <Badge bg="success">On</Badge>
                    : <Badge bg="light" text="dark" className="border">Off (no API key)</Badge>}
                </Row>
              </Card.Body>
            </Card>
          </div>

          <div className="col-lg-6">
            <Card className="border-0 shadow-sm h-100">
              <Card.Body>
                <h6 className="fw-semibold mb-3"><i className="bi bi-database me-2 text-primary" />MongoDB</h6>
                <Row label="Connection">
                  <Badge bg={data.database.state === "connected" ? "success" : "danger"}>{data.database.state}</Badge>
                </Row>
                <Row label="Version">{data.database.mongoVersion}</Row>
                <Row label="Main database"><code>{data.database.mainDatabase}</code></Row>
                <Row label="User database names"><code>{data.database.userDatabasePrefix}&lt;user id&gt;</code></Row>
              </Card.Body>
            </Card>
          </div>

          <div className="col-12">
            <Card className="border-0 shadow-sm">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                  <div>
                    <h6 className="fw-semibold mb-1"><i className="bi bi-lightning-charge me-2 text-primary" />Database cache</h6>
                    <div className="small text-secondary" style={{ maxWidth: 640 }}>
                      The server remembers which user databases it has already set up
                      (collections and indexes) so requests stay fast. Clearing it is safe:
                      each database is checked again on its user's next request. Useful
                      after changing indexes or restoring a database.
                    </div>
                  </div>
                  <Button variant="outline-danger" onClick={clear} disabled={clearing}>
                    <i className="bi bi-eraser me-1" />
                    {clearing ? "Clearing..." : "Clear cache"}
                  </Button>
                </div>

                <div className="small fw-medium mb-2">{data.cache.preparedDatabases.length} cached</div>
                <div className="d-flex flex-wrap gap-2">
                  {data.cache.preparedDatabases.map((name) => (
                    <code key={name} className="small border rounded px-2 py-1">{name}</code>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
