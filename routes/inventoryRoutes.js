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
      console.log("REQ.USER IN ADJUST ===>", req.user);

      const {
        productId,
        location = "MAIN",
        quantityDelta,
        minLevel,
        maxLevel,
        note
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

      res.status(200).json(inv);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
