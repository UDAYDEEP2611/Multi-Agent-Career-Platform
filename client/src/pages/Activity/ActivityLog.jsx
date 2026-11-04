import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Nav, Spinner } from "react-bootstrap";

import LockScreen from "./LockScreen";
import ActivityTimeline from "./ActivityTimeline";
import SessionsPanel from "./SessionsPanel";
import MyStoragePanel from "./MyStoragePanel";
import { getActivity, getLockStatus, lockActivity } from "../../api/accountApi";

const TABS = [
  ["changes", "Changes", "bi-clock-history"],
  ["signins", "Sign-ins & Sessions", "bi-shield-check"],
  ["storage", "Storage", "bi-pie-chart"]
];

// "9:42" until the log locks again
const remaining = (until, now) => {
  const seconds = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export default function ActivityLog() {
  const [lock, setLock] = useState(null); // { unlocked, unlockedUntil, unlockMinutes }
  const [tab, setTab] = useState("changes");
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const locked = useCallback(() => {
    setLock((previous) => ({ ...previous, unlocked: false, unlockedUntil: null }));
    setEntries(null);
  }, []);

  useEffect(() => {
    getLockStatus()
      .then(({ data }) => setLock(data))
      .catch(() => setError("Unable to check the lock"));
  }, []);

  // Countdown, and lock the page when the time is up
  useEffect(() => {
    if (!lock?.unlocked) return undefined;

    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (new Date(lock.unlockedUntil).getTime() <= current) locked();
    }, 1000);

    return () => clearInterval(timer);
  }, [lock, locked]);

  // Load the changes or sign-in entries for the open tab
  useEffect(() => {
    if (!lock?.unlocked || tab === "storage") return undefined;

    let active = true;

    getActivity(tab === "changes" ? "data" : "auth")
      .then(({ data }) => active && setEntries({ tab, items: data.entries || [] }))
      .catch((err) => {
        if (!active) return;
        if (err.response?.status === 423) locked();
        else setError("Unable to load activity");
      });

    return () => {
      active = false;
    };
  }, [lock, tab, locked]);

  const lockNow = async () => {
    await lockActivity().catch(() => {});
    locked();
  };

  const tabEntries = entries?.tab === tab ? entries.items : null;

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="fw-bold mb-1">Activity Log</h1>
          <p className="text-secondary mb-0">
            Everything changed in your portfolio, your sign-ins and your storage.
          </p>
        </div>

        {lock?.unlocked && (
          <div className="d-flex align-items-center gap-2">
            <span className="small text-secondary">
              <i className="bi bi-unlock me-1" />
              Locks in {remaining(lock.unlockedUntil, now)}
            </span>
            <Button size="sm" variant="outline-secondary" onClick={lockNow}>
              <i className="bi bi-lock me-1" />
              Lock now
            </Button>
          </div>
        )}
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError("")}>{error}</Alert>}

      {!lock ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : !lock.unlocked ? (
        <LockScreen
          unlockMinutes={lock.unlockMinutes || 10}
          hasPassword={lock.hasPassword}
          hasGoogle={lock.hasGoogle}
          onUnlocked={(unlockedUntil) => {
            setNow(Date.now());
            setLock((previous) => ({ ...previous, unlocked: true, unlockedUntil }));
          }}
        />
      ) : (
        <>
          <Nav variant="tabs" activeKey={tab} onSelect={setTab} className="mb-4">
            {TABS.map(([key, label, icon]) => (
              <Nav.Item key={key}>
                <Nav.Link eventKey={key}>
                  <i className={`bi ${icon} me-1`} />
                  {label}
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>

          {tab === "storage" ? (
            <MyStoragePanel onLocked={locked} />
          ) : (
            <>
              {tab === "signins" && <SessionsPanel onLocked={locked} />}

              {!tabEntries ? (
                <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>
              ) : (
                <ActivityTimeline
                  entries={tabEntries}
                  showDevice={tab === "signins"}
                  empty={tab === "changes" ? "No changes recorded yet." : "No sign-in activity yet."}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
