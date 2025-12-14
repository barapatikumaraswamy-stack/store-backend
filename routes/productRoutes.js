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
    const products = await Product.find(filter)
      .populate("soldBy", "name email phone address")
      .sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", auth(), async (req, res, next) => {
  try {
    const prod = await Product.findById(req.params.id)
      .populate("soldBy", "name email phone address");
    if (!prod) return res.status(404).json({ message: "Not found" });
    res.json(prod);
  } catch (err) {
    next(err);
  }
});


router.post("/", auth(["admin", "stockManager"]), async (req, res, next) => {
  try {
    const { name, sku, salePrice, purchasePrice, soldBy } = req.body;

    let supplier = null;
    if (soldBy) {
      supplier = await Supplier.findById(soldBy);
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
    }

    const prod = await Product.create({
      name,
      sku,
      salePrice,
      purchasePrice,
      soldBy: soldBy || null
    });

    if (supplier) {
      supplier.productsSupplied.push(prod._id);
      await supplier.save();
    }

    // log creation
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

    const populated = await Product.findById(prod._id)
      .populate("soldBy", "name email phone address");
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
});

// PUT /api/products/:id - update product + log
router.put("/:id", auth(["admin", "stockManager"]), async (req, res, next) => {
  try {
    const prod = await Product.findById(req.params.id);
    if (!prod) return res.status(404).json({ message: "Not found" });

    const before = {
      name: prod.name,
      salePrice: prod.salePrice,
      soldBy: prod.soldBy
    };

    // handle supplier change
    if (req.body.soldBy) {
      const supplier = await Supplier.findById(req.body.soldBy);
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
      prod.soldBy = req.body.soldBy;
    } else if (req.body.soldBy === null) {
      prod.soldBy = null;
    }

    // other fields
    if (req.body.name !== undefined) prod.name = req.body.name;
    if (typeof req.body.salePrice === "number") prod.salePrice = req.body.salePrice;
    if (typeof req.body.purchasePrice === "number") prod.purchasePrice = req.body.purchasePrice;
    if (req.body.sku !== undefined) prod.sku = req.body.sku;

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

    const populated = await Product.findById(prod._id)
      .populate("soldBy", "name email phone address");
    res.json(populated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id - delete product + log
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
