require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const pool = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= AUTH ================= */
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.sendStatus(401);

  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.sendStatus(401);
  }
}

/* ================= UPLOAD SETUP ================= */
const uploadDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"));
    }
  })
});

/* ================= LOGIN ================= */
app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;

  const q = await pool.query(
    "SELECT * FROM admins WHERE email=$1",
    [email]
  );

  if (!q.rows.length) return res.sendStatus(401);

  const ok = await bcrypt.compare(password, q.rows[0].password);
  if (!ok) return res.sendStatus(401);

  const token = jwt.sign(
    { shop_id: q.rows[0].shop_id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

/* ================= ADD PRODUCT ================= */
app.post(
  "/api/admin/product",
  auth,
  upload.array("images", 6),
  async (req, res) => {
    try {
      const { category, description, ar_model } = req.body;

      if (!category) {
        return res.status(400).json({ error: "Category required" });
      }

      const images = (req.files || []).map(
        f => "/uploads/" + f.filename
      );

      await pool.query(
        `
        INSERT INTO products
        (id, shop_id, name, category, description, image_urls, image_url, ar_model)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [
          uuidv4(),
          req.user.shop_id,
          category,               // 🔑 name = category (internal)
          category,
          description || "",
          images,
          images[0] || null,
          ar_model || null
        ]
      );

      res.json({ success: true });
    } catch (err) {
      console.error("ADD PRODUCT ERROR:", err);
      res.status(500).json({ error: "Failed to add product" });
    }
  }
);

/* ================= PRODUCT DETAIL (PUBLIC) ================= */
app.get("/api/product/:id", async (req, res) => {
  try {
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
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (!q.rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(q.rows[0]);
  } catch (err) {
    console.error("PRODUCT DETAIL ERROR:", err);
    res.status(500).json({ error: "Failed to load product" });
  }
});



/* ================= LIST PRODUCTS ================= */
app.get("/api/products", async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.json([]);

  const q = await pool.query(
    `
    SELECT id, category, description, image_url, ar_model
    FROM products
    WHERE shop_id=$1
    ORDER BY created_at DESC
    `,
    [shop]
  );

  res.json(q.rows);
});

/* ================= DELETE PRODUCT ================= */
app.delete("/api/admin/product/:id", auth, async (req, res) => {
  await pool.query(
    "DELETE FROM products WHERE id=$1 AND shop_id=$2",
    [req.params.id, req.user.shop_id]
  );
  res.json({ deleted: true });
});

/* ================= STATIC ================= */
app.use(express.static(path.join(__dirname, "public")));

/* ================= START ================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
