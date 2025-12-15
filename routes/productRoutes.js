const express = require("express");
const Product = require("../models/Product");
const Supplier = require("../models/Supplier");
const ProductLog = require("../models/ProductLog");
const Inventory = require("../models/Inventory");
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
    const {
      name,
      sku,
      salePrice,
      purchasePrice,
      soldBy,
      openingQuantity = 0,
      minLevel = 0,
      maxLevel = 0,
      barcode,
      category,
      taxRate = 0,
      isActive = true
    } = req.body;

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
      barcode,
      category,
      purchasePrice,
      salePrice,
      taxRate,
      isActive,
      soldBy: soldBy || null,
      // if you also store these on Product
      minLevel,
      maxLevel
    });

    if (supplier) {
      supplier.productsSupplied.push(prod._id);
      await supplier.save();
    }

    // create or update inventory in sync
    await Inventory.findOneAndUpdate(
      { product: prod._id, location: "MAIN" },
      {
        $setOnInsert: {
          quantity: openingQuantity,
          minLevel,
          maxLevel
        }
      },
      { upsert: true, new: true }
    );

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

// PUT /api/products/:id - update product + log + sync inventory
router.put("/:id", auth(["admin", "stockManager"]), async (req, res, next) => {
  try {
    const prod = await Product.findById(req.params.id);
    if (!prod) return res.status(404).json({ message: "Not found" });

    const before = {
      name: prod.name,
      salePrice: prod.salePrice,
      purchasePrice: prod.purchasePrice,
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

    // product-owned fields
    if (req.body.name !== undefined) prod.name = req.body.name;
    if (typeof req.body.salePrice === "number") prod.salePrice = req.body.salePrice;
    if (typeof req.body.purchasePrice === "number") {
      prod.purchasePrice = req.body.purchasePrice;
    }
    if (req.body.sku !== undefined) prod.sku = req.body.sku;
    if (req.body.barcode !== undefined) prod.barcode = req.body.barcode;
    if (req.body.category !== undefined) prod.category = req.body.category;
    if (typeof req.body.taxRate === "number") prod.taxRate = req.body.taxRate;
    if (typeof req.body.isActive === "boolean") prod.isActive = req.body.isActive;

    // inventory-owned fields that may be edited from product form
    const { openingQuantity, minLevel, maxLevel } = req.body;
    if (typeof minLevel === "number") prod.minLevel = minLevel;
    if (typeof maxLevel === "number") prod.maxLevel = maxLevel;

    await prod.save();

    // sync inventory whenever inventory-related fields are present
    if (
      openingQuantity !== undefined ||
      minLevel !== undefined ||
      maxLevel !== undefined
    ) {
      await Inventory.findOneAndUpdate(
        { product: prod._id, location: "MAIN" },
        {
          $set: {
            ...(openingQuantity !== undefined && { quantity: openingQuantity }),
            ...(minLevel !== undefined && { minLevel }),
            ...(maxLevel !== undefined && { maxLevel })
          }
        },
        { upsert: true, new: true }
      );
    }

    const after = {
      name: prod.name,
      salePrice: prod.salePrice,
      purchasePrice: prod.purchasePrice,
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
