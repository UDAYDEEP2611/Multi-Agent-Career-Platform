const crypto = require("crypto");
const mongoose = require("mongoose");

// Reads the sessions connect-mongo keeps in the main database. Raw session
// IDs never leave the server: admins see a short one-way handle instead.

const sessions = () => mongoose.connection.db.collection("sessions");

const handleFor = (sessionId) =>
  crypto.createHash("sha256").update(String(sessionId)).digest("hex").slice(0, 16);

function parse(record) {
  let data = record.session;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      data = {};
    }
  }

  return {
    id: record._id,
    handle: handleFor(record._id),
    userId: data?.userId ? String(data.userId) : null,
    expires: record.expires || null,
    device: data?.device || null
  };
}

// Unexpired sessions, soonest to expire last
async function listSessions() {
  const records = await sessions()
    .find({ expires: { $gt: new Date() } })
    .sort({ expires: -1 })
    .toArray();

  return records.map(parse);
}

async function deleteSessionByHandle(handle) {
  const match = (await listSessions()).find((session) => session.handle === handle);
  if (!match) return null;

  await sessions().deleteOne({ _id: match.id });
  return match;
}

// Signs a user out everywhere; returns how many sessions ended
async function deleteSessionsForUser(userId) {
  const ids = (await sessions().find().toArray())
    .map(parse)
    .filter((session) => session.userId === String(userId))
    .map((session) => session.id);

  if (ids.length === 0) return 0;
  return (await sessions().deleteMany({ _id: { $in: ids } })).deletedCount;
}

async function deleteExpiredSessions() {
  return (await sessions().deleteMany({ expires: { $lte: new Date() } })).deletedCount;
}

// Signs a user out of every session except one; returns how many ended
async function deleteOtherSessions(userId, keepSessionId) {
  const ids = (await sessions().find().toArray())
    .map(parse)
    .filter((session) => session.userId === String(userId) && session.id !== keepSessionId)
    .map((session) => session.id);

  if (ids.length === 0) return 0;
  return (await sessions().deleteMany({ _id: { $in: ids } })).deletedCount;
}

module.exports = {
  handleFor,
  deleteOtherSessions,
  listSessions,
  deleteSessionByHandle,
  deleteSessionsForUser,
  deleteExpiredSessions
};
