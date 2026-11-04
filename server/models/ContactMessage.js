const mongoose = require("mongoose");

// Messages from the Contact Us form (main database), kept whether or not the
// email to the team goes out.
const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 25, default: "" },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    emailed: { type: Boolean, default: false }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "contact_messages"
  }
);

contactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ContactMessage", contactMessageSchema);
