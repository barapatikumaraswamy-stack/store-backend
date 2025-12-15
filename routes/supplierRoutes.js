const express = require("express");
const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const auth = require("../middleware/auth");

const router = express.Router();

// GET /api/suppliers
router.get("/", auth(), async (req, res, next) => {
  try {
    const suppliers = await Supplier.find()
      .populate("productsSupplied", "name sku salePrice purchasePrice")
      .sort({ name: 1 });
    res.json(suppliers);
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/:id
router.get("/:id", auth(), async (req, res, next) => {
  try {
    const sup = await Supplier.findById(req.params.id)
      .populate("productsSupplied", "name sku salePrice purchasePrice");
    if (!sup) return res.status(404).json({ message: "Not found" });
    res.json(sup);
  } catch (err) {
    next(err);
  }
});

// POST /api/suppliers - create supplier (with unique name guard if you added it)
router.post("/", auth(["admin", "stockManager"]), async (req, res, next) => {
  try {
    const { name, email, phone, address } = req.body;

    const existing = await Supplier.findOne({ name });
    if (existing) {
      return res.status(400).json({ message: "Supplier already exists" });
    }

    const sup = await Supplier.create({ name, email, phone, address });
    res.status(201).json(sup);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Supplier already exists" });
    }
    next(err);
  }
});

// PUT /api/suppliers/:id - update supplier + sync products.soldBy
router.put("/:id", auth(["admin", "stockManager"]), async (req, res, next) => {
  try {
    const sup = await Supplier.findById(req.params.id);
    if (!sup) return res.status(404).json({ message: "Not found" });

    // keep old product list to compute diff
    const oldProductIds = sup.productsSupplied.map(id => id.toString());

    // update basic fields
    if (req.body.name !== undefined) sup.name = req.body.name;
    if (req.body.email !== undefined) sup.email = req.body.email;
    if (req.body.phone !== undefined) sup.phone = req.body.phone;
    if (req.body.address !== undefined) sup.address = req.body.address;

    // if client sends productsSupplied (array of product IDs), sync it
    let newProductIds = oldProductIds;
    if (Array.isArray(req.body.productsSupplied)) {
      newProductIds = req.body.productsSupplied.map(String);
      sup.productsSupplied = newProductIds;
    }

    await sup.save();

    // compute added / removed product IDs
    const oldSet = new Set(oldProductIds);
    const newSet = new Set(newProductIds);

    const added = newProductIds.filter(id => !oldSet.has(id));
    const removed = oldProductIds.filter(id => !newSet.has(id));

    // for added products: set soldBy = this supplier
    if (added.length > 0) {
      await Product.updateMany(
        { _id: { $in: added } },
        { $set: { soldBy: sup._id } }
      );
    }

    // for removed products: clear soldBy if currently pointing to this supplier
    if (removed.length > 0) {
      await Product.updateMany(
        { _id: { $in: removed }, soldBy: sup._id },
        { $set: { soldBy: null } }
      );
    }

    const populated = await Supplier.findById(sup._id)
      .populate("productsSupplied", "name sku salePrice purchasePrice");

    res.json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Supplier name already in use" });
    }
    next(err);
  }
});

// DELETE /api/suppliers/:id - delete supplier (optionally clear soldBy on products)
router.delete("/:id", auth(["admin"]), async (req, res, next) => {
  try {
    const sup = await Supplier.findByIdAndDelete(req.params.id);
    if (!sup) return res.status(404).json({ message: "Not found" });

    // clear soldBy on all products that referenced this supplier
    await Product.updateMany(
      { soldBy: sup._id },
      { $set: { soldBy: null } }
    );

    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
