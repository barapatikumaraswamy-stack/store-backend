const express = require("express");
const Product = require("../models/Product");
const Supplier = require("../models/Supplier");
const ProductLog = require("../models/ProductLog");
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

    // optional: log creation
    await ProductLog.create({
      product: prod._id,
      user: req.user.id,
      before: null,
      after: {
        name: prod.name,
        salePrice: prod.salePrice,
        soldBy: prod.soldBy
      },
      note: "Product created"
    });

    res.status(201).json(prod);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", auth(["admin", "stockManager"]), async (req, res, next) => {
  try {
    const prod = await Product.findById(req.params.id);
    if (!prod) return res.status(404).json({ message: "Not found" });

    const before = {
      name: prod.name,
      salePrice: prod.salePrice,
      soldBy: prod.soldBy
    };

    if (req.body.soldBy) {
      const supplier = await Supplier.findById(req.body.soldBy);
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      prod.soldBy = req.body.soldBy;
    } else if (req.body.soldBy === null) {
      prod.soldBy = null;
    }

    if (req.body.name !== undefined) prod.name = req.body.name;
    if (typeof req.body.salePrice === "number") prod.salePrice = req.body.salePrice;

    await prod.save();

    const after = {
      name: prod.name,
      salePrice: prod.salePrice,
      soldBy: prod.soldBy
    };

    await ProductLog.create({
      product: prod._id,
      user: req.user.id,
      before,
      after,
      note: req.body.note || "Product updated"
    });

    res.json(prod);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", auth(["admin"]), async (req, res, next) => {
  try {
    const prod = await Product.findByIdAndDelete(req.params.id);
    if (!prod) return res.status(404).json({ message: "Not found" });

    await ProductLog.create({
      product: prod._id,
      user: req.user.id,
      before: {
        name: prod.name,
        salePrice: prod.salePrice,
        soldBy: prod.soldBy
      },
      after: null,
      note: "Product deleted"
    });

    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
