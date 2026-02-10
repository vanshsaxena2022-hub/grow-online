require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const pool = require("./db");
console.log("🔥 SERVER.JS LOADED – VERSION 3");

const app = express();

/* ================= BASIC MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= ENV ================= */
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

/* ================= AUTH MIDDLEWARE ================= */
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });

  const token = header.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/* ================= FILE UPLOAD SETUP ================= */
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, Date.now() + "-" + safe);
  }
});

const upload = multer({ storage });

/* ================= HEALTH ================= */
app.get("/health", (_, res) => {
  res.json({ status: "OK" });
});

/* ================= SHOP API (CRITICAL) ================= */
app.get("/api/shop/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const q = await pool.query(
      "SELECT id, name, logo_url, tagline FROM shops WHERE id = $1",
      [id]
    );

    if (!q.rows.length) {
      return res.status(404).json({ error: "Shop not found" });
    }

    res.json(q.rows[0]);
  } catch (err) {
    console.error("SHOP API ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= ADMIN LOGIN ================= */
app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;

  const q = await pool.query(
    "SELECT * FROM admins WHERE email = $1",
    [email]
  );

  if (!q.rows.length) return res.status(401).json({ error: "Invalid login" });

  const ok = await bcrypt.compare(password, q.rows[0].password);
  if (!ok) return res.status(401).json({ error: "Invalid login" });

  const token = jwt.sign(
    { shop_id: q.rows[0].shop_id },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

/* ================= PRODUCTS (CUSTOMER + ADMIN) ================= */
app.get("/api/products", async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: "shop missing" });

  const q = await pool.query(
    `
    SELECT
      id,
      category,
      description,
      image_url,
      image_urls,
      ar_model
    FROM products
    WHERE shop_id = $1
    ORDER BY created_at DESC
    `,
    [shop]
  );

  res.json(q.rows);
});

/* ================= ADD PRODUCT (ADMIN) ================= */
app.post(
  "/api/admin/product",
  auth,
  upload.array("images", 6),
  async (req, res) => {
    try {
      const { category, description, ar_model, name } = req.body;
      if (!category) {
        return res.status(400).json({ error: "category required" });
      }

      const id = uuidv4();
      const images = (req.files || []).map(
        f => "/uploads/" + f.filename
      );

      await pool.query(
        `
        INSERT INTO products
        (id, name, category, description, image_url, image_urls, ar_model, shop_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [
          id,
          name || category,          // SAFETY
          category,
          description || "",
          images[0],
          images,
          ar_model || null,
          req.user.shop_id
        ]
      );

      res.json({ status: "created" });
    } catch (err) {
      console.error("ADD PRODUCT ERROR:", err);
      res.status(500).json({ error: "Failed to add product" });
    }
  }
);

/* ================= DELETE PRODUCT ================= */
app.delete("/api/admin/product/:id", auth, async (req, res) => {
  await pool.query(
    "DELETE FROM products WHERE id=$1 AND shop_id=$2",
    [req.params.id, req.user.shop_id]
  );
  res.json({ status: "deleted" });
});

/* ================= STATIC FILES (LAST) ================= */
app.use(express.static(path.join(__dirname, "public")));

/* ================= START ================= */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
