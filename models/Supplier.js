// models/Supplier.js
const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    productsSupplied: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Supplier", supplierSchema);
