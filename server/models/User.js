
const mongoose = require("mongoose");

const ROLES = ["user", "admin"];

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_]+$/
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    passwordHash: {
      type: String,
      default: null,
      select: false
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true
    },

    authProviders: {
      type: [String],
      enum: ["local", "google"],
      default: []
    },

    isEmailVerified: {
      type: Boolean,
      default: false
    },

    resetPasswordTokenHash: {
      type: String,
      default: null,
      select: false
    },

    resetPasswordExpiresAt: {
      type: Date,
      default: null,
      select: false
    },

    passwordChangedAt: {
      type: Date,
      default: null
    },

    lastLoginAt: {
      type: Date,
      default: null
    },

    // "admin" can open the Admin page (see middleware/requireAdmin.js)
    role: {
      type: String,
      enum: ROLES,
      default: "user"
    },

    // Disabled accounts can't sign in, and their sessions stop working
    isDisabled: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    collection: "users"
  }
);

module.exports = mongoose.model("User", userSchema);
module.exports.ROLES = ROLES;
