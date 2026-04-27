const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { MongoClient, ObjectId } = require("mongodb"); // ✅ FIX

const app = express();
app.set("trust proxy", true);

// ===== CONFIG =====
const MAINTENANCE_MODE = true;
const ADMIN_KEY = "13102009";

// ===== MIDDLEWARE BẢO TRÌ =====
app.use((req, res, next) => {
    if (!MAINTENANCE_MODE) return next();

    // ✅ admin vào
    if (req.query.key === ADMIN_KEY) return next();

    // ✅ cho tất cả API chạy
    if (
        req.path.startsWith("/upload-") ||
        req.path.startsWith("/delete-") ||
        req.path.startsWith("/update-") ||
        req.path.startsWith("/shop") ||
        req.path.startsWith("/get-") ||
        req.path.startsWith("/submit-") ||
        req.path.startsWith("/spin-") ||
        req.path.startsWith("/create-")
    ) return next();

    // ✅ file tĩnh
    if (req.path.includes(".")) return next();

    // ❌ còn lại chặn
    return res.send(`
        <h1 style="text-align:center;margin-top:50px">
        🚧 Web đang bảo trì
        </h1>
    `);
});

// ===== MIDDLEWARE =====
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());
app.use(express.static(__dirname));

// ===== MONGODB =====
const MONGODB_URI = process.env.MONGODB_URI ||
"mongodb+srv://busidolnew:busidol123@cluster0.ejinj73.mongodb.net/?appName=Cluster0";

const client = new MongoClient(MONGODB_URI);

let db, usersCollection, codesCollection, submittedCodesCollection, spinsCollection, shopCollection;
let dbReady = false;

// ===== CONNECT DB =====
async function connectDB() {
    try {
        await client.connect();
        db = client.db("rubyfree");

        usersCollection = db.collection("users");
        codesCollection = db.collection("codes");
        submittedCodesCollection = db.collection("submittedCodes");
        spinsCollection = db.collection("spins");
        shopCollection = db.collection("shop");

        dbReady = true;
        console.log("✅ MongoDB connected");

        // ===== ANTI-SPAM INDEX =====
        await submittedCodesCollection.createIndex({ deviceId: 1 }, { unique: true, sparse: true });
        await submittedCodesCollection.createIndex({ ip: 1 }, { unique: true, sparse: true });
        await submittedCodesCollection.createIndex({ userAgent: 1 }, { unique: true, sparse: true });

        console.log("🔥 Anti-spam index ready");

    } catch (err) {
        console.error("❌ MongoDB error:", err);
    }
}
connectDB();

// ===== WAIT DB =====
async function waitForDB() {
    let retries = 0;
    while (!dbReady && retries < 20) {
        await new Promise(r => setTimeout(r, 500));
        retries++;
    }
    if (!dbReady) throw new Error("DB not ready");
}

// ===== HELPER =====
function getIP(req) {
    return req.headers["x-forwarded-for"]?.split(",")[0] ||
           req.socket.remoteAddress || "unknown";
}

function generateCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 12; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
        if (i === 3 || i === 7) code += "-";
    }
    return code;
}

// ================= API =================

// 🔥 FIX: đảm bảo DB ready
app.get("/shop-acc", async (req, res) => {
    try {
        await waitForDB(); // ✅ FIX
        const data = await shopCollection.find().sort({ createdAt: -1 }).toArray();
        res.json(data);
    } catch {
        res.json([]);
    }
});

app.post("/delete-acc", async (req, res) => {
    try {
        await waitForDB();

        const { id } = req.body;

        if (!id) return res.json({ success: false });

        const result = await shopCollection.deleteOne({ _id: new ObjectId(id) }); // ✅ FIX

        res.json({ success: result.deletedCount === 1 }); // ✅ FIX chuẩn

    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});

app.post("/update-acc", async (req, res) => {
    try {
        await waitForDB();
        
        const { id, price } = req.body;

        if (!id || !price) {
            return res.status(400).json({ success: false, message: "Thiếu dữ liệu" });
        }

        const result = await shopCollection.updateOne(
            { _id: new ObjectId(id) }, // ✅ FIX
            { $set: { price } }
        );

        res.json({ success: result.modifiedCount === 1 }); // ✅ FIX

    } catch (err) {
        console.error("update-acc:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===== TOKEN =====
app.get("/create-token", (req, res) => {
    res.json({ token: Math.random().toString(36).substring(2) + Date.now() });
});

// ===== UPLOAD SHOP =====
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/upload-acc", upload.single("image"), async (req, res) => {
    try {
        await waitForDB(); // ✅ FIX

        const file = req.file;
        const { price } = req.body;

        if (!file || !price) {
            return res.json({ success: false, message: "Thiếu dữ liệu" });
        }

        const base64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

        await shopCollection.insertOne({
            image: base64,
            price,
            createdAt: new Date()
        });

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});

// ===== GET CODE =====
app.post("/get-code", async (req, res) => {
    try {
        await waitForDB();

        const { deviceId } = req.body;
        const ip = getIP(req);

        const exist = await usersCollection.findOne({ deviceId });
        if (exist) {
            return res.json({ success: false, code: exist.code });
        }

        const code = generateCode();

        await usersCollection.insertOne({ deviceId, code, ip });
        await codesCollection.insertOne({ deviceId, code, ip });

        res.json({ success: true, code });

    } catch (err) {
        res.json({ success: false });
    }
});

// ===== SUBMIT CODE =====
app.post("/submit-code", async (req, res) => {
    try {
        await waitForDB();

        const { deviceId, userId, platform, userInputCode, systemCode } = req.body;
        const ip = getIP(req);
        const userAgent = req.headers["user-agent"];

        if (userInputCode.toUpperCase() !== systemCode.toUpperCase()) {
            return res.json({ success: false, message: "Sai mã" });
        }

        const exist = await submittedCodesCollection.findOne({
            $or: [{ deviceId }, { ip }, { userAgent }]
        });

        if (exist) {
            return res.json({ success: false, message: "Đã gửi rồi" });
        }

        await submittedCodesCollection.insertOne({
            deviceId,
            userId,
            platform,
            code: userInputCode,
            ip,
            userAgent,
            createdAt: new Date()
        });

        res.json({ success: true });

    } catch {
        res.json({ success: false });
    }
});

// ===== SPIN =====
app.post("/spin-wheel", async (req, res) => {
    try {
        await waitForDB();

        const { deviceId } = req.body;
        const ip = getIP(req);

        const cooldown = 6 * 60 * 60 * 1000;
        const now = Date.now();

        const exist = await spinsCollection.findOne({
            $or: [{ deviceId }, { ip }]
        });

        if (exist && now - exist.lastSpin < cooldown) {
            return res.json({ success: false });
        }

        const list = ["Ace","Echo","Smart","Khan","Lucy Băng","Lucy Idol",
            "Ruby","Bensi","Gin","Jey","Koo","Thrue","Bebee","Gold"];
        const result = list[Math.floor(Math.random() * list.length)];

        await spinsCollection.insertOne({
            deviceId,
            ip,
            lastSpin: now,
            result
        });

        res.json({ success: true, result });

    } catch {
        res.json({ success: false });
    }
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("🚀 Server running:", PORT);
});
