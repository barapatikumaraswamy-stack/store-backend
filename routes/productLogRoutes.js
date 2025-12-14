const express = require("express");
const ProductLog = require("../models/ProductLog");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/:productId", auth(), async (req, res, next) => {
  try {
    const logs = await ProductLog.find({ product: req.params.productId })
      .populate("user", "name email")
      .populate("product", "name salePrice")
      .sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

module.exports = router;