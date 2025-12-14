const express = require("express");
const Product = require("../models/Product");
const Supplier = require("../models/Supplier");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth(), async (req, res, next) => {
  try {
    const { q } = req.query;
    const filter = q ? { name: new RegExp(q, "i") } : {};
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", auth(), async (req, res, next) => {
  try {
    const prod = await Product.findById(req.params.id);
    if (!prod) return res.status(404).json({ message: "Not found" });
    res.json(prod);
  } catch (err) {
    next(err);
  }
});


router.post("/", auth(["admin", "stockManager"]), async (req, res, next) => {
  try {
    const { name, salePrice, soldBy } = req.body;

    let supplier = null;
    if (soldBy) {
      supplier = await Supplier.findById(soldBy);
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
    }

    const prod = await Product.create({
      name,
      salePrice,
      soldBy: soldBy || null,
    });

    if (supplier) {
      supplier.productsSupplied.push(prod._id);
      await supplier.save();
    }

    res.status(201).json(prod);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", auth(["admin", "stockManager"]), async (req, res, next) => {
  try {
    const prod = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!prod) return res.status(404).json({ message: "Not found" });
    res.json(prod);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", auth(["admin"]), async (req, res, next) => {
  try {
    const prod = await Product.findByIdAndDelete(req.params.id);
    if (!prod) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
