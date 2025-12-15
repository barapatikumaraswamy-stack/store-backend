// routes/suppliers.js
const express = require("express");
const Supplier = require("../models/Supplier");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth(), async (req, res, next) => {
  try {
    const suppliers = await Supplier.find()
      .populate("productsSupplied", "name sku salePrice purchasePrice")
      .sort({ name: 1 });
    res.json(suppliers);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", auth(), async (req, res, next) => {
  try {
    const sup = await Supplier.findById(req.params.id)
      .populate("productsSupplied", "name sku salePrice purchasePrice");
    if (!sup) return res.status(404).json({ message: "Not found" });
    res.json(sup);
  } catch (err) {
    next(err);
  }
});

router.post("/", auth(["admin", "stockManager"]), async (req, res, next) => {
  try {
    const { name, email, phone, address } = req.body;

    // check existing by name (case-insensitive if you want)
    const existing = await Supplier.findOne({ name });
    if (existing) {
      return res.status(400).json({ message: "Supplier already exists" });
    }

    const sup = await Supplier.create({ name, email, phone, address });
    res.status(201).json(sup);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Supplier already exists" });
    }
    next(err);
  }
});

router.put("/:id", auth(["admin", "stockManager"]), async (req, res, next) => {
  try {
    const sup = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("productsSupplied", "name sku salePrice purchasePrice");
    if (!sup) return res.status(404).json({ message: "Not found" });
    res.json(sup);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Supplier name already in use" });
    }
    next(err);
  }
});

router.delete("/:id", auth(["admin"]), async (req, res, next) => {
  try {
    const sup = await Supplier.findByIdAndDelete(req.params.id);
    if (!sup) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
