const express = require("express");
const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
const InventoryLog = require("../models/InventoryLog");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth(), async (req, res, next) => {
  try {
    const { lowStock } = req.query;
    const filter = {};
    if (lowStock === "true") {
      filter.$expr = { $lte: ["$quantity", "$minLevel"] };
    }
    const items = await Inventory.find(filter)
      .populate("product")
      .sort({ updatedAt: -1 });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.get("/logs/:productId", auth(), async (req, res, next) => {
  try {
    const logs = await InventoryLog.find({ product: req.params.productId })
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

async function ensureInventory(productId, location = "MAIN") {
  let inv = await Inventory.findOne({ product: productId, location });
  if (!inv) {
    inv = await Inventory.create({ product: productId, location, quantity: 0 });
  }
  return inv;
}

router.post(
  "/adjust",
  auth(["admin", "stockManager"]),
  async (req, res, next) => {
    try {
      const {
        productId,
        location = "MAIN",
        quantityDelta,
        minLevel,
        maxLevel,
        note,
        // product fields that might be changed from inventory screen
        name,
        sku,
        barcode,
        category,
        purchasePrice,
        salePrice,
        taxRate,
        isActive
      } = req.body;

      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const inv = await ensureInventory(productId, location);

      const before = {
        quantity: inv.quantity,
        minLevel: inv.minLevel,
        maxLevel: inv.maxLevel
      };

      // inventory-owned fields
      if (typeof quantityDelta === "number") {
        inv.quantity += quantityDelta;
      }
      if (typeof minLevel === "number") {
        inv.minLevel = minLevel;
      }
      if (typeof maxLevel === "number") {
        inv.maxLevel = maxLevel;
      }

      await inv.save();

      // mirror inventory-related fields back to product if you keep them there
      if (typeof minLevel === "number") {
        product.minLevel = minLevel;
      }
      if (typeof maxLevel === "number") {
        product.maxLevel = maxLevel;
      }

      // product-owned fields that can be edited from inventory screen
      if (name !== undefined) product.name = name;
      if (sku !== undefined) product.sku = sku;
      if (barcode !== undefined) product.barcode = barcode;
      if (category !== undefined) product.category = category;
      if (typeof purchasePrice === "number") product.purchasePrice = purchasePrice;
      if (typeof salePrice === "number") product.salePrice = salePrice;
      if (typeof taxRate === "number") product.taxRate = taxRate;
      if (typeof isActive === "boolean") product.isActive = isActive;

      await product.save();

      await InventoryLog.create({
        product: productId,
        location,
        quantityBefore: before.quantity ?? 0,
        quantityAfter: inv.quantity,
        minLevelBefore: before.minLevel,
        minLevelAfter: inv.minLevel,
        maxLevelBefore: before.maxLevel,
        maxLevelAfter: inv.maxLevel,
        note,
        user: req.user ? req.user.id : null
      });

      res.status(200).json({
        inventory: inv,
        product
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
