const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
app.set("trust proxy", true);

// ===== CONFIG =====
const MAINTENANCE_MODE = true;
const ADMIN_KEY = "13102009";

// ===== MAINTENANCE =====
app.use((req, res, next) => {
    if (!MAINTENANCE_MODE) return next();

    if (req.query.key === ADMIN_KEY) return next();

    // cho API chạy
    if (
        req.path.startsWith("/upload") ||
        req.path.startsWith("/delete") ||
        req.path.startsWith("/update") ||
        req.path.startsWith("/shop") ||
        req.path.startsWith("/get") ||
        req.path.startsWith("/submit") ||
        req.path.startsWith("/spin") ||
        req.path.startsWith("/create")
    ) return next();

    if (req.path.includes(".")) return next();

    return res.send(`<h1 style="text-align:center;margin-top:50px">🚧 Web đang bảo trì</h1>`);
});

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ===== DB =====
const client = new MongoClient(process.env.MONGODB_URI);
let shopCollection;

async function start() {
    await client.connect();
    const db = client.db("rubyfree");

    shopCollection = db.collection("shop");

    console.log("✅ MongoDB connected");

    app.listen(3000, () => {
        console.log("🚀 Server running");
    });
}
start();

// ===== MULTER =====
const upload = multer({ storage: multer.memoryStorage() });

// ===== API =====

// GET SHOP
app.get("/shop-acc", async (req, res) => {
    const data = await shopCollection.find().sort({ createdAt: -1 }).toArray();
    res.json(data);
});

// UPLOAD
app.post("/upload-acc", upload.single("image"), async (req, res) => {
    try {
        const file = req.file;
        const { price } = req.body;

        if (!file || !price) {
            return res.json({ success: false });
        }

        const base64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

        await shopCollection.insertOne({
            image: base64,
            price,
            createdAt: new Date()
        });

        res.json({ success: true });

    } catch (err) {
        console.log(err);
        res.json({ success: false });
    }
});

// DELETE
app.post("/delete-acc", async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) return res.json({ success: false });

        await shopCollection.deleteOne({
            _id: new ObjectId(id)
        });

        res.json({ success: true });

    } catch (err) {
        console.log(err);
        res.json({ success: false, message: err.message });
    }
});

// UPDATE
app.post("/update-acc", async (req, res) => {
    try {
        const { id, price } = req.body;

        if (!id || !price) {
            return res.json({ success: false });
        }

        await shopCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { price } }
        );

        res.json({ success: true });

    } catch (err) {
        console.log(err);
        res.json({ success: false, message: err.message });
    }
});
