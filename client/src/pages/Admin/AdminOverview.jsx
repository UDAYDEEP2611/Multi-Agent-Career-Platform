import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Card, Spinner, Table } from "react-bootstrap";

import AdminPage from "./AdminPage";
import StatCard from "./StatCard";
import { formatBytes, formatDateTime, formatDuration } from "./adminFormat";
import { getAdminOverview } from "../../api/adminApi";

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getAdminOverview()
      .then(({ data: response }) => active && setData(response))
      .catch((err) => active && setError(err.response?.data?.message || "Unable to load overview"));

    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminPage title="Admin Overview" description="Accounts, sign-ins, databases and server health at a glance.">
      {error && <Alert variant="danger">{error}</Alert>}

      {!data ? (
        !error && <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : (
        <>
          <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3 mb-4">
            <div className="col">
              <StatCard icon="bi-people" label="Accounts" value={`${data.users.total} / ${data.users.maxUsers}`}
                color={data.users.total >= data.users.maxUsers ? "danger" : "primary"}
                hint={data.users.total >= data.users.maxUsers
                  ? "Limit reached: sign-up is closed"
                  : `${data.users.maxUsers - data.users.total} places left · ${data.users.newThisWeek} new this week`}
                to="/dashboard/admin/users" />
            </div>
            <div className="col">
              <StatCard icon="bi-broadcast" label="Active sessions" value={data.sessions.active} color="success"
                hint={`${data.sessions.signedInUsers} users signed in`} to="/dashboard/admin/sessions" />
            </div>
            <div className="col">
              <StatCard icon="bi-database" label="User databases" value={data.databases.userDatabases} color="info"
                hint={`${formatBytes(data.databases.totalSizeBytes)} on disk`} to="/dashboard/admin/databases" />
            </div>
            <div className="col">
              <StatCard icon="bi-cpu" label="Server uptime" value={formatDuration(data.server.uptimeSeconds)} color="secondary"
                hint={`${data.server.cachedDatabases} databases cached`} to="/dashboard/admin/system" />
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-lg-6">
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <h6 className="fw-semibold mb-3">Accounts</h6>
                  {[
                    ["Admins", data.users.admins],
                    ["Disabled", data.users.disabled],
                    ["Signed in this week", data.users.activeThisWeek],
                    ["New this week", data.users.newThisWeek]
                  ].map(([label, value]) => (
                    <div key={label} className="d-flex justify-content-between border-bottom py-2 small">
                      <span className="text-secondary">{label}</span>
                      <span className="fw-medium">{value}</span>
                    </div>
                  ))}
                </Card.Body>
              </Card>
            </div>

            <div className="col-lg-6">
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <h6 className="fw-semibold mb-3">Databases</h6>
                  {[
                    ["Main database", data.databases.main.name],
                    ["Main records", data.databases.main.records],
                    ["Skill suggestions", data.catalogCount],
                    ["Orphaned user databases", data.databases.orphaned]
                  ].map(([label, value]) => (
                    <div key={label} className="d-flex justify-content-between border-bottom py-2 small">
                      <span className="text-secondary">{label}</span>
                      <span className={`fw-medium ${label.startsWith("Orphaned") && value > 0 ? "text-warning-emphasis" : ""}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                  {data.databases.orphaned > 0 && (
                    <div className="small mt-2">
                      <Link to="/dashboard/admin/databases">Review orphaned databases →</Link>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </div>
          </div>

          <Card className="border-0 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0">Recent admin activity</h6>
                <Link to="/dashboard/admin/audit" className="small">View all →</Link>
              </div>

              {data.recentAudit.length === 0 ? (
                <p className="small text-secondary mb-0">No admin actions yet.</p>
              ) : (
                <Table size="sm" responsive className="mb-0 small">
                  <tbody>
                    {data.recentAudit.map((entry) => (
                      <tr key={entry._id}>
                        <td className="text-nowrap text-secondary">{formatDateTime(entry.createdAt)}</td>
                        <td className="fw-medium">{entry.action}</td>
                        <td>{entry.target}</td>
                        <td className="text-secondary">{entry.adminUsername}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </>
      )}
    </AdminPage>
  );
}
