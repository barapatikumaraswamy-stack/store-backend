const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    location: { type: String, default: "MAIN" },
    quantity: { type: Number, default: 0 },
    minLevel: { type: Number, default: 0 },
    maxLevel: { type: Number },
  },
  { timestamps: true }
);

inventorySchema.index({ product: 1, location: 1 }, { unique: true });

module.exports = mongoose.model("Inventory", inventorySchema);
