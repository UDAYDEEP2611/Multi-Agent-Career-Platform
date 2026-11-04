const mongoose = require("mongoose");

// Emails from the footer's subscribe box (main database)
const subscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "subscribers"
  }
);

module.exports = mongoose.model("Subscriber", subscriberSchema);
