const mongoose = require("mongoose");
const { userModel } = require("../utils/userDatabase");

// A portfolio design the user made (usually through the design agent): one
// of the built-in designs plus their own colour, fonts, corners and layout.
const customDesignSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    name: { type: String, required: true, trim: true, maxlength: 60 },

    // The built-in design it starts from ("slate", "gazette"...)
    baseId: { type: String, required: true, trim: true, maxlength: 40 },

    // "#1f7a4d" or "" for the base design's own accent
    accent: { type: String, trim: true, maxlength: 7, default: "" },

    // Names from the font list (client designs/customDesign.js), "" = base
    font: { type: String, trim: true, maxlength: 40, default: "" },
    headingFont: { type: String, trim: true, maxlength: 40, default: "" },

    // "" (base), "sharp", "soft" or "round"
    corners: { type: String, trim: true, maxlength: 10, default: "" },

    // "" (follow the switcher), "light" or "dark"
    mode: { type: String, trim: true, maxlength: 10, default: "" },

    // Section ids left out, the order to show the rest in, and renamed titles
    hidden: { type: [String], default: [] },
    order: { type: [String], default: [] },
    titles: { type: Map, of: String, default: {} },

    // How many items a section shows, first ones first: { projects: 2 }
    limits: { type: Map, of: Number, default: {} },

    // The short line under the name, "" for the usual hero summary
    heroSummary: { type: String, trim: true, maxlength: 400, default: "" }
  },
  {
    timestamps: true,
    collection: "custom_designs"
  }
);

module.exports = userModel("CustomDesign", customDesignSchema);
