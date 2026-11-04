const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");

// The assistant chat: one conversation per user, kept so it survives a page
// reload, plus whatever the agents are in the middle of (an entry missing
// fields, for example).
const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    // Which agent answered: "supervisor", "data-entry", "design", "qa"
    agent: { type: String, trim: true, maxlength: 30, default: "" },
    text: { type: String, trim: true, maxlength: 6000, default: "" },
    // Quick replies to show as buttons
    choices: { type: [String], default: [] },
    // Links to show under the message: [{ label, to }]
    links: { type: [{ label: String, to: String, _id: false }], default: [] },
    // Sources the answer used: [{ label, detail }]
    sources: { type: [{ label: String, detail: String, _id: false }], default: [] },
    // What the agent did, step by step, for the "How I did it" view
    steps: { type: [String], default: [] }
  },
  { timestamps: true }
);

const chatThreadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },

    messages: { type: [messageSchema], default: [] },

    // The data entry agent's unfinished work:
    // { section, data, missing: [field], sourceText, queue: [{ section, data }] }
    pending: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  {
    timestamps: true,
    collection: "chat_threads"
  }
);

module.exports = userModel("ChatThread", chatThreadSchema);
