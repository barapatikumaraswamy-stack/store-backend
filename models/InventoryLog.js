const mongoose = require("mongoose");

const inventoryLogSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    location: { type: String, default: "MAIN" },
    quantityBefore: { type: Number, required: true },
    quantityAfter: { type: Number, required: true },
    minLevelBefore: { type: Number },
    minLevelAfter: { type: Number },
    maxLevelBefore: { type: Number },
    maxLevelAfter: { type: Number },
    note: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("InventoryLog", inventoryLogSchema);
