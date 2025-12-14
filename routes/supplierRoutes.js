const express = require("express");
const Supplier = require("../models/Supplier");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth(), async (req, res, next) => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 });
    res.json(suppliers);
  } catch (err) {
    next(err);
  }
});

router.post("/", auth(["admin", "stockManager"]), async (req, res, next) => {
  try {
    const sup = await Supplier.create(req.body);
    res.status(201).json(sup);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", auth(["admin", "stockManager"]), async (req, res, next) => {
  try {
    const sup = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!sup) return res.status(404).json({ message: "Not found" });
    res.json(sup);
  } catch (err) {
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
