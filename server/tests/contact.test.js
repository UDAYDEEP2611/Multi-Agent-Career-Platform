const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "integration-test-secret-not-for-production";
process.env.CLIENT_URL = "http://localhost:5173";

let mongoServer;
let app;
let outbox;
let ContactMessage;

const form = { name: "Alex Morgan", email: "alex@example.com", phone: "(555) 010-1234", message: "I need help exporting my resume." };

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  ({ outbox } = require("../services/mailer"));
  ContactMessage = require("../models/ContactMessage");
  const createApp = require("../app");
  app = createApp({ sessionStore: new session.MemoryStore() });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test("a visitor's message is kept and emailed to the team", async () => {
  await request(app).post("/api/contact").send(form).expect(201);

  const saved = await ContactMessage.findOne({ email: form.email }).lean();
  assert.equal(saved.name, form.name);
  assert.equal(saved.phone, form.phone);
  assert.equal(saved.message, form.message);

  const mail = outbox.at(-1);
  assert.equal(mail.to, "rajprasadverse@gmail.com");
  assert.equal(mail.replyTo, form.email);
  assert.match(mail.subject, /Alex Morgan/);
  assert.match(mail.text, /I need help exporting my resume/);
});

test("the phone number is optional, the rest isn't", async () => {
  await request(app).post("/api/contact").send({ ...form, phone: "" }).expect(201);

  const wrong = [
    [{ name: " " }, /your name/],
    [{ email: "not-an-email" }, /valid email/],
    [{ email: { $ne: "" } }, /valid email/],
    [{ phone: "call me" }, /valid phone/],
    [{ message: "help" }, /little more/],
    [{ message: "x".repeat(2001) }, /at most 2000/]
  ];
  for (const [change, reason] of wrong) {
    const { body } = await request(app).post("/api/contact").send({ ...form, ...change }).expect(400);
    assert.match(body.message, reason);
  }
});

test("a bot that fills the hidden field is told it worked, but nothing happens", async () => {
  const mails = outbox.length;
  const messages = await ContactMessage.countDocuments();
  await request(app).post("/api/contact").send({ ...form, website: "http://spam.example" }).expect(201);
  assert.equal(outbox.length, mails);
  assert.equal(await ContactMessage.countDocuments(), messages);
});

test("a visitor can subscribe once, and nobody can tell who already has", async () => {
  const Subscriber = require("../models/Subscriber");
  await Subscriber.init();
  const mails = outbox.length;

  await request(app).post("/api/contact/subscribe").send({ email: " Fan@Example.com " }).expect(201);
  assert.equal(outbox.length, mails + 1);
  assert.match(outbox.at(-1).text, /fan@example\.com/);

  await request(app).post("/api/contact/subscribe").send({ email: "fan@example.com" }).expect(201);
  assert.equal(outbox.length, mails + 1);
  assert.equal(await Subscriber.countDocuments({ email: "fan@example.com" }), 1);

  await request(app).post("/api/contact/subscribe").send({ email: "nope" }).expect(400);
  await request(app).post("/api/contact/subscribe").send({ email: { $ne: "" } }).expect(400);

  await request(app).post("/api/contact/subscribe").send({ email: "bot@example.com", website: "x" }).expect(201);
  assert.equal(await Subscriber.countDocuments({ email: "bot@example.com" }), 0);
});

test("too many messages from one address are refused", async () => {
  const replies = [];
  for (let sent = 0; sent < 6; sent += 1) replies.push((await request(app).post("/api/contact").send(form)).status);
  assert.equal(replies.at(-1), 429);
});
