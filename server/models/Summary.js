
const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");

const summarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },

    // Where the current text came from: "Written by you", "AI · Concise"...
    origin: {
      type: String,
      trim: true,
      maxlength: 60,
      default: ""
    },

    // Earlier versions, newest first, so a replaced summary can come back
    history: {
      type: [
        new mongoose.Schema(
          {
            content: { type: String, required: true, maxlength: 5000 },
            origin: { type: String, maxlength: 60, default: "" },
            savedAt: { type: Date, default: Date.now }
          },
          { _id: true }
        )
      ],
      default: []
    }
  },
  {
    timestamps: true,
    collection: "summaries"
  }
);

module.exports = userModel("Summary", summarySchema);
