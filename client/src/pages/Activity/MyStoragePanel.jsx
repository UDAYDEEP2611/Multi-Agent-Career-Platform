import { useEffect, useState } from "react";
import { Alert, Card, ProgressBar, Spinner, Table } from "react-bootstrap";

import StorageRing from "../Common/StorageRing";
import { getMyStorage } from "../../api/accountApi";
import { formatBytes } from "../Admin/adminFormat";
import { levelColor, topSegments } from "../Admin/storageColors";

// Friendlier names for the tables in a user's database
const TABLE_NAMES = {
  activity_log: "Activity log",
  activity_achievements: "Activity & Achievements",
  user_skills: "Skills",
  user_skill_quotas: "Skill counters",
  skill_associations: "Skill links"
};

const tableName = (name) =>
  TABLE_NAMES[name] || name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " ");

// Space this user's own database takes against their fixed limit
export default function MyStoragePanel({ onLocked }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getMyStorage()
      .then(({ data: response }) => active && setData(response))
      .catch((err) => {
        if (!active) return;
        if (err.response?.status === 423) onLocked();
        else setError("Unable to load storage");
      });

    return () => {
      active = false;
    };
  }, [onLocked]);

  if (!data) {
    return error ? <Alert variant="danger">{error}</Alert> : <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>;
  }

  const { database, limitBytes } = data;
  const ratio = database.totalBytes / limitBytes;
  const segments = topSegments(
    database.collections.map((item) => ({ label: tableName(item.name), bytes: item.totalBytes }))
  );

  return (
    <Card className="border-0 shadow-sm">
      <Card.Body className="p-4">
        <div className="d-flex flex-wrap gap-4 align-items-center mb-4">
          <StorageRing segments={segments} limit={limitBytes} size={170} stroke={18}>
            <div className={`fs-5 fw-bold text-${levelColor(ratio)}-emphasis`}>
              {Math.round(ratio * 1000) / 10}%
            </div>
            <div className="small text-secondary">used</div>
          </StorageRing>

          <div>
            <h5 className="fw-bold mb-1">Your storage</h5>
            <div className="mb-1">
              <span className="fw-semibold">{formatBytes(database.totalBytes)}</span>
              <span className="text-secondary"> of {formatBytes(limitBytes)} · {database.records} records</span>
            </div>
            <div className="small text-secondary">Uploaded files are stored separately and aren't counted.</div>
          </div>
        </div>

        <Table size="sm" responsive className="mb-0 align-middle small">
          <thead>
            <tr>
              <th>Section</th>
              <th className="text-end">Records</th>
              <th className="text-end">On disk</th>
              <th style={{ width: "30%" }}>Share</th>
            </tr>
          </thead>
          <tbody>
            {database.collections.map((item) => (
              <tr key={item.name}>
                <td>{tableName(item.name)}</td>
                <td className="text-end">{item.records}</td>
                <td className="text-end text-nowrap">{formatBytes(item.totalBytes)}</td>
                <td>
                  <ProgressBar
                    now={database.totalBytes ? (item.totalBytes / database.totalBytes) * 100 : 0}
                    style={{ height: 6 }}
                    aria-label={`${tableName(item.name)} share`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
}
