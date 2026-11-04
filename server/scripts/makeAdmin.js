// Gives an account admin access (or removes it with --remove).
// Run from server/: npm run make-admin -- <email or username> [--remove]
require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");
const User = require("../models/User");
const { dropUserDatabaseIfEmpty } = require("../utils/userDatabase");

async function setAdmin(identifier, makeAdmin = true) {
  const value = String(identifier || "").trim().toLowerCase();
  if (!value) throw new Error("Give the account's email or username");

  const user = await User.findOne({ $or: [{ email: value }, { username: value }] });
  if (!user) throw new Error(`No account found for "${value}"`);

  user.role = makeAdmin ? "admin" : "user";
  await user.save();

  // Admin accounts have no portfolio; an empty user database is removed
  if (makeAdmin) await dropUserDatabaseIfEmpty(user._id);

  return user;
}

async function main() {
  const args = process.argv.slice(2);
  const remove = args.includes("--remove");
  const identifier = args.find((arg) => !arg.startsWith("--"));

  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set");
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await setAdmin(identifier, !remove);
    console.log(`${user.username} (${user.email}) is now ${user.role === "admin" ? "an admin" : "a regular user"}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { setAdmin };
