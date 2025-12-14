
const mongoose = require("mongoose");

const productLogSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    before: {
      name: String,
      salePrice: Number,
      soldBy: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" }
    },
    after: {
      name: String,
      salePrice: Number,
      soldBy: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" }
    },
    note: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductLog", productLogSchema);
