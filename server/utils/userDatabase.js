const { AsyncLocalStorage } = require("node:async_hooks");
const mongoose = require("mongoose");

// One MongoDB database per user. Logins, sessions and the skill catalog stay
// in the main database (MONGODB_URI); everything a user creates lives in
// "user_db_<userId>" (or USER_DB_PREFIX + userId).
//
// Models defined with userModel() pick the database of the user the current
// request runs for (set by requireAuth via runAsUser), so controllers use
// them like ordinary Mongoose models.

const context = new AsyncLocalStorage();
const schemas = new Map(); // model name -> schema
const prepared = new Map(); // database name -> Promise

function userDbName(userId) {
  const id = String(userId);

  // Only ObjectIds, so a database name can never come from user input
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    throw new Error("Invalid user ID for a database name");
  }

  const prefix = process.env.USER_DB_PREFIX || "user_db_";
  return `${prefix}${id.toLowerCase()}`;
}

// Shares the main connection's client; no extra sockets per user
const connectionFor = (userId) =>
  mongoose.connection.useDb(userDbName(userId), { useCache: true });

const modelOn = (connection, name) =>
  connection.models[name] || connection.model(name, schemas.get(name));

// Registers every user model in the user's database and creates its
// collections and indexes. Runs once per database per process; this is what
// creates the database for a new user.
function prepareUserDatabase(userId) {
  const name = userDbName(userId);

  if (!prepared.has(name)) {
    const connection = connectionFor(userId);
    const promise = Promise.all(
      [...schemas.keys()].map((model) => modelOn(connection, model).init())
    ).catch((error) => {
      prepared.delete(name);
      throw error;
    });

    prepared.set(name, promise);
  }

  return prepared.get(name);
}

// Runs fn with userModel()s pointing at this user's database
function runAsUser(userId, fn) {
  return context.run({ userId: String(userId) }, fn);
}

function currentModel(name) {
  const store = context.getStore();

  if (!store) {
    throw new Error(`${name} was used outside a signed-in request (see runAsUser)`);
  }

  return modelOn(connectionFor(store.userId), name);
}

// Defines a model stored in each user's own database. Returns a stand-in
// that forwards to the current user's model; extra exports assigned to it
// (constants, helpers) are kept on the stand-in itself.
function userModel(name, schema) {
  schemas.set(name, schema);
  const extras = {};

  return new Proxy(function UserModel() {}, {
    get(target, prop) {
      if (Object.hasOwn(extras, prop)) return extras[prop];
      if (prop === "prototype") return target.prototype;

      const model = currentModel(name);
      const value = Reflect.get(model, prop);
      return typeof value === "function" ? value.bind(model) : value;
    },

    set(target, prop, value) {
      extras[prop] = value;
      return true;
    },

    construct(target, args) {
      const Model = currentModel(name);
      return new Model(...args);
    }
  });
}

// A user model's schema, readable outside a request (for field specs)
const schemaOf = (name) => schemas.get(name) || null;

// The user databases this server process has already set up (its cache)
const preparedDatabaseNames = () => [...prepared.keys()];

// Forgets which databases are set up; each is checked again (collections
// and indexes) on its user's next request
function clearPreparedDatabases() {
  const count = prepared.size;
  prepared.clear();
  return count;
}

const forgetUserDatabase = (userId) => prepared.delete(userDbName(userId));

// Drops a user's database if it holds no records (e.g. when the account
// becomes an admin, which has no portfolio). Returns true if dropped.
async function dropUserDatabaseIfEmpty(userId) {
  const db = mongoose.connection.client.db(userDbName(userId));
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();

  for (const { name } of collections) {
    if (await db.collection(name).estimatedDocumentCount()) return false;
  }

  if (collections.length > 0) await db.dropDatabase();
  forgetUserDatabase(userId);
  return collections.length > 0;
}

// The prefix every user database name starts with
const userDbPrefix = () => userDbName("0".repeat(24)).slice(0, -24);

// IDs of every user that has a database (used by scripts)
async function listUserIds() {
  const prefix = userDbPrefix();
  const { databases } = await mongoose.connection.db.admin().listDatabases({ nameOnly: true });

  return databases
    .map((database) => database.name)
    .filter((name) => name.startsWith(prefix) && /^[a-f0-9]{24}$/.test(name.slice(prefix.length)))
    .map((name) => name.slice(prefix.length));
}

// [{ model, collection }] for every user model (used by scripts)
function userModelCollections() {
  return [...schemas].map(([model, schema]) => ({
    model,
    collection: schema.get("collection") || mongoose.pluralize()(model)
  }));
}

module.exports = {
  userModel,
  schemaOf,
  runAsUser,
  prepareUserDatabase,
  userDbName,
  listUserIds,
  userModelCollections,
  userDbPrefix,
  preparedDatabaseNames,
  clearPreparedDatabases,
  forgetUserDatabase,
  dropUserDatabaseIfEmpty
};
