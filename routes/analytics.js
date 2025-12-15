// routes/analytics.js
const express = require("express");
const Transaction = require("../models/Transaction");
const Product = require("../models/Product");
const auth = require("../middleware/auth");

const router = express.Router();

// GET /api/analytics/revenue-by-period?period=week|month
router.get("/revenue-by-period", auth(), async (req, res, next) => {
  try {
    const { period = "week" } = req.query;

    const now = new Date();
    let startDate;

    if (period === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // aggregate transactions: group by date and type, sum revenue
    const data = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productData"
        }
      },
      {
        $unwind: "$productData"
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            type: "$type" // "purchase" or "sale"
          },
          // For purchases: quantity is positive, multiply by purchasePrice
          // For sales: quantity is positive, multiply by salePrice
          revenue: {
            $sum: {
              $cond: [
                { $eq: ["$type", "sale"] },
                { $multiply: [{ $abs: "$quantity" }, "$productData.salePrice"] },
                { $multiply: [{ $abs: "$quantity" }, "$productData.purchasePrice"] }
              ]
            }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.date": 1 }
      }
    ]);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
