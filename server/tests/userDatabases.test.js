const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { userDbName, listUserIds } = require("../utils/userDatabase");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";

let mongoServer;
let app;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: "portfolio" });

  const createApp = require("../app");
  app = createApp({ enableTestAuth: true, sessionStore: new session.MemoryStore() });
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

const databaseNames = async () =>
  (await mongoose.connection.db.admin().listDatabases({ nameOnly: true }))
    .databases.map((database) => database.name);

const countIn = (dbName, collection) =>
  mongoose.connection.client.db(dbName).collection(collection).countDocuments();

async function signIn(userId) {
  const agent = request.agent(app);
  await agent.post("/__test/login").send({ userId }).expect(200);
  return agent;
}

test("signing up creates the user's own database", async () => {
  const response = await request(app).post("/api/auth/register").send({
    username: "new_user",
    email: "new@example.com",
    password: "a-long-test-password",
    confirmPassword: "a-long-test-password"
  }).expect(201);

  const name = userDbName(response.body.user.id);
  assert.equal(name, `user_db_${response.body.user.id}`);
  assert.ok((await databaseNames()).includes(name));

  // Its collections exist from the start
  const collections = await mongoose.connection.client.db(name).listCollections().toArray();
  assert.ok(collections.some((item) => item.name === "experiences"));

  // The login itself stays in the main database
  assert.equal(await countIn("portfolio", "users"), 1);
});

test("each user's records are stored only in their own database", async () => {
  const userA = new mongoose.Types.ObjectId().toString();
  const userB = new mongoose.Types.ObjectId().toString();
  const agentA = await signIn(userA);
  const agentB = await signIn(userB);

  await agentA.post("/api/experiences").send({
    jobTitle: "Engineer", organization: "Example Co", startYear: 2022, currentlyWorking: true
  }).expect(201);
  await agentA.post("/api/skills").send({ name: "Python" }).expect(201);
  await agentB.post("/api/interests").send({ name: "Chess" }).expect(201);

  assert.equal(await countIn(userDbName(userA), "experiences"), 1);
  assert.equal(await countIn(userDbName(userA), "user_skills"), 1);
  assert.equal(await countIn(userDbName(userB), "experiences"), 0);
  assert.equal(await countIn(userDbName(userB), "interests"), 1);

  // Nothing user-owned lands in the main database
  assert.equal(await countIn("portfolio", "experiences"), 0);
  assert.equal(await countIn("portfolio", "user_skills"), 0);

  const ids = await listUserIds();
  assert.ok(ids.includes(userA) && ids.includes(userB));
});

test("user models can't be used outside a signed-in request", async () => {
  const Experience = require("../models/Experience");
  assert.throws(() => Experience.find(), /outside a signed-in request/);
  assert.throws(() => userDbName("../admin"), /Invalid user ID/);
});

test("the migration copies old main-database records to their owners' databases", async () => {
  const { migrateToUserDatabases } = require("../scripts/migrateToUserDatabases");
  const owner = new mongoose.Types.ObjectId();
  const main = mongoose.connection.db.collection("interests");

  await main.insertMany([
    { userId: owner, name: "Hiking", normalizedName: "hiking", category: "Other", description: "" },
    { userId: owner, name: "Chess", normalizedName: "chess", category: "Other", description: "" }
  ]);

  await migrateToUserDatabases();
  assert.equal(await countIn(userDbName(owner), "interests"), 2);
  assert.equal(await main.countDocuments({ userId: owner }), 2, "originals kept by default");

  // Rerunning copies nothing twice; --remove-old then clears the originals
  await migrateToUserDatabases({ removeOld: true });
  assert.equal(await countIn(userDbName(owner), "interests"), 2);
  assert.equal(await main.countDocuments({ userId: owner }), 0);
});

test("old database names are moved to user_db_<id> without losing records", async () => {
  const { renameUserDatabases } = require("../scripts/renameUserDatabases");
  const owner = new mongoose.Types.ObjectId().toString();
  const oldName = `portfolio_user_${owner}`;

  await mongoose.connection.client.db(oldName).collection("interests").insertMany([
    { userId: new mongoose.Types.ObjectId(owner), name: "Hiking", normalizedName: "hiking" },
    { userId: new mongoose.Types.ObjectId(owner), name: "Chess", normalizedName: "chess" }
  ]);

  const report = await renameUserDatabases("portfolio_user_");
  assert.deepEqual(report, [{ oldName, newName: `user_db_${owner}`, records: 2, dropped: true }]);
  assert.equal(await countIn(`user_db_${owner}`, "interests"), 2);
  assert.ok(!(await databaseNames()).includes(oldName));

  // Nothing left to move on a rerun
  assert.deepEqual(await renameUserDatabases("portfolio_user_"), []);
});

test("the portfolio overview counts the user's own sections", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const agent = await signIn(userId);

  const empty = await agent.get("/api/portfolio/overview").expect(200);
  assert.equal(empty.body.completeness.filled, 0);
  assert.equal(empty.body.completeness.total, 6);

  await agent.post("/api/skills").send({ name: "Go" }).expect(201);
  await agent.post("/api/interests").send({ name: "Chess" }).expect(201);
  await agent.post("/api/projects").send({ title: "Side project" }).expect(201);

  const filled = await agent.get("/api/portfolio/overview").expect(200);
  assert.equal(filled.body.sections.skills, 1);
  assert.equal(filled.body.sections.interests, 1);
  assert.equal(filled.body.completeness.filled, 2);
  assert.ok(filled.body.completeness.missing.includes("experience"));

  // Another user's data never counts
  const other = await signIn(new mongoose.Types.ObjectId().toString());
  assert.equal((await other.get("/api/portfolio/overview").expect(200)).body.sections.skills, 0);
});
