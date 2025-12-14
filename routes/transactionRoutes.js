const express = require("express");
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Inventory = require("../models/Inventory");
const Product = require("../models/Product");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth(), async (req, res, next) => {
  try {
    const tx = await Transaction.find()
      .populate("product")
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(tx);
  } catch (err) {
    next(err);
  }
});

// helper: apply quantity change
async function applyStockChange(session, { productId, location, delta }) {
  const inv = await Inventory.findOneAndUpdate(
    { product: productId, location },
    { $inc: { quantity: delta } },
    { new: true, upsert: true, session }
  );
  return inv;
}

// create transaction + update stock (atomic with session)
router.post("/", auth(), async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { type, productId, location = "MAIN", quantity, note } = req.body;

    if (!["purchase", "sale", "adjustment"].includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }
    const product = await Product.findById(productId).session(session);
    if (!product) return res.status(404).json({ message: "Product not found" });

    let delta = quantity;
    if (type === "sale") delta = -Math.abs(quantity);
    if (type === "purchase") delta = Math.abs(quantity);

    const inv = await applyStockChange(session, { productId, location, delta });

    const tx = await Transaction.create(
      [
        {
          type,
          product: productId,
          location,
          quantity: delta,
          note,
          user: req.user.id,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ transaction: tx[0], inventory: inv });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
});

module.exports = router;
