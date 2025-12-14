const express = require("express");
const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
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

// ensure inventory doc exists for product/location
async function ensureInventory(productId, location = "MAIN") {
  let inv = await Inventory.findOne({ product: productId, location });
  if (!inv) {
    inv = await Inventory.create({ product: productId, location, quantity: 0 });
  }
  return inv;
}

// manual adjustment endpoint
router.post(
  "/adjust",
  auth(["admin", "stockManager"]),
  async (req, res, next) => {
    try {
      const { productId, location = "MAIN", quantityDelta, note } = req.body;
      const product = await Product.findById(productId);
      if (!product)
        return res.status(404).json({ message: "Product not found" });

      const inv = await ensureInventory(productId, location);
      inv.quantity += quantityDelta;
      await inv.save();

      res.status(200).json(inv);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
