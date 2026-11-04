const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { runAsUser, prepareUserDatabase } = require("../utils/userDatabase");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";

let mongoServer;
let app;
let UserSkill;
let UserSkillQuota;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  const createApp = require("../app");
  UserSkill = require("../models/UserSkill");
  UserSkillQuota = require("../models/UserSkillQuota");

  app = createApp({
    enableTestAuth: true,
    sessionStore: new session.MemoryStore()
  });
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

async function newUser() {
  const agent = request.agent(app);
  const userId = new mongoose.Types.ObjectId().toString();
  await agent.post("/__test/login").send({ userId }).expect(200);
  await prepareUserDatabase(userId);
  return { agent, userId };
}

const quotaOf = (userId) => runAsUser(userId, () => UserSkillQuota.findOne({ userId }).lean());

const actual = (userId) => runAsUser(userId, async () => ({
  total: await UserSkill.countDocuments({ userId }),
  important: await UserSkill.countDocuments({ userId, isImportant: true })
}));

test("counters follow create, promote, demote, rename and delete", async () => {
  const { agent, userId } = await newUser();

  const a = (await agent.post("/api/skills").send({ name: "Python", rating: 5 }).expect(201)).body.skill;
  await agent.post("/api/skills").send({ name: "Go", rating: 5, isImportant: true }).expect(201);
  assert.deepEqual(
    { total: (await quotaOf(userId)).totalSkills, important: (await quotaOf(userId)).importantSkills },
    { total: 2, important: 1 }
  );

  await agent.patch(`/api/skills/${a._id}`).send({ isImportant: true }).expect(200);
  assert.equal((await quotaOf(userId)).importantSkills, 2);

  // Lowering an important skill below 3/5 is refused
  await agent.patch(`/api/skills/${a._id}`).send({ rating: 2 }).expect(400);

  // Demote and rename together
  const renamed = await agent.patch(`/api/skills/${a._id}`)
    .send({ isImportant: false, rating: 4, name: "Python 3" })
    .expect(200);
  assert.equal(renamed.body.skill.normalizedName, "python 3");
  assert.equal((await quotaOf(userId)).importantSkills, 1);

  // Failed creates (duplicate name) give their slot back
  await agent.post("/api/skills").send({ name: "PYTHON  3" }).expect(409);
  assert.equal((await quotaOf(userId)).totalSkills, 2);

  await agent.delete(`/api/skills/${a._id}`).expect(200);
  const quota = await quotaOf(userId);
  assert.deepEqual({ total: quota.totalSkills, important: quota.importantSkills }, await actual(userId));
});

test("simultaneous creates never pass 120 skills", async () => {
  const { agent, userId } = await newUser();

  await runAsUser(userId, () => UserSkill.insertMany(
    Array.from({ length: 110 }, (_, i) => ({
      userId, name: `Existing ${i}`, normalizedName: `existing ${i}`, rating: 3
    }))
  ));

  // The counter is created from the existing 110 skills
  const responses = await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      agent.post("/api/skills").send({ name: `Burst ${i}` })
    )
  );

  assert.equal(responses.filter((r) => r.status === 201).length, 10);
  assert.equal(responses.filter((r) => r.status === 409).length, 15);
  assert.match(responses.find((r) => r.status === 409).body.message, /up to 120/);
  assert.equal((await actual(userId)).total, 120);
  assert.equal((await quotaOf(userId)).totalSkills, 120);
});

test("simultaneous promotions never pass 50 important skills", async () => {
  const { agent, userId } = await newUser();

  const ids = [];
  for (let i = 0; i < 55; i++) {
    ids.push((await agent.post("/api/skills").send({ name: `Skill ${i}`, rating: 5 }).expect(201)).body.skill._id);
  }

  const responses = await Promise.all(
    ids.map((id) => agent.patch(`/api/skills/${id}`).send({ isImportant: true }))
  );

  assert.equal(responses.filter((r) => r.status === 200).length, 50);
  assert.equal((await actual(userId)).important, 50);
  assert.equal((await quotaOf(userId)).importantSkills, 50);

  // Simultaneous creates of important skills are also capped
  const creates = await Promise.all(
    [1, 2, 3].map((i) =>
      agent.post("/api/skills").send({ name: `Top ${i}`, rating: 5, isImportant: true })
    )
  );
  assert.ok(creates.every((r) => r.status === 409));
});

test("promoting the same skill twice at once counts it once", async () => {
  const { agent, userId } = await newUser();
  const id = (await agent.post("/api/skills").send({ name: "Rust", rating: 5 }).expect(201)).body.skill._id;

  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      agent.patch(`/api/skills/${id}`).send({ isImportant: true })
    )
  );

  assert.ok(responses.some((r) => r.status === 200));
  assert.equal((await quotaOf(userId)).importantSkills, 1);

  // Deleting it twice at once releases its slots once
  await Promise.all([1, 2, 3].map(() => agent.delete(`/api/skills/${id}`)));
  const quota = await quotaOf(userId);
  assert.deepEqual({ total: quota.totalSkills, important: quota.importantSkills }, { total: 0, important: 0 });
});

test("repair script fixes drifted counters and orphaned links", async () => {
  const { agent, userId } = await newUser();
  const SkillAssociation = require("../models/SkillAssociation");
  const { repairSkillData } = require("../scripts/repairSkillData");

  await agent.post("/api/skills").send({ name: "Kotlin", rating: 5, isImportant: true }).expect(201);
  await runAsUser(userId, async () => {
    await UserSkillQuota.updateOne({ userId }, { $set: { totalSkills: 99, importantSkills: 7 } });
    await SkillAssociation.collection.insertOne({
      userId: new mongoose.Types.ObjectId(userId),
      skillId: new mongoose.Types.ObjectId(),
      sourceType: "experience",
      sourceId: new mongoose.Types.ObjectId()
    });
  });

  const result = await repairSkillData();
  assert.ok(result.orphanLinksRemoved >= 1);

  const quota = await quotaOf(userId);
  assert.deepEqual({ total: quota.totalSkills, important: quota.importantSkills }, { total: 1, important: 1 });
});
