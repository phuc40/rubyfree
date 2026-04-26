const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
app.set("trust proxy", true);

app.use(cors({
    origin: "*",
    methods: ["GET", "POST"]
}));

app.use(express.json());
app.use(express.static(__dirname));

// ===== MongoDB =====
const MONGODB_URI = process.env.MONGODB_URI || 
"mongodb+srv://busidolnew:busidol123@cluster0.ejinj73.mongodb.net/rubyfree?retryWrites=true&w=majority";

let db, usersCollection, codesCollection, submittedCodesCollection, spinsCollection;

const client = new MongoClient(MONGODB_URI);

// ===== LẤY IP CHUẨN =====
function getRealIP(req) {
    let ip =
        req.headers["cf-connecting-ip"] ||
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.ip ||
        req.socket.remoteAddress;

    if (!ip) return "unknown";
    if (ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");
    return ip;
}

// ===== HELPER =====
function generateCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 12; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
        if (i === 3 || i === 7) code += "-";
    }
    return code;
}

// ===== TOKEN =====
app.get("/create-token", (req, res) => {
    const token = Math.random().toString(36).substring(2) + Date.now();
    res.json({ token });
});

// ===== GET CODE =====
app.post("/get-code", async (req, res) => {
    try {
        const { deviceId } = req.body;
        const ip = getRealIP(req);

        if (!deviceId) {
            return res.json({ success: false, message: "Thiếu deviceId" });
        }

        const existingUser = await usersCollection.findOne({ deviceId });

        if (existingUser) {
            return res.json({
                success: false,
                message: "Bạn đã nhận mã rồi!",
                code: existingUser.code
            });
        }

        const code = generateCode();

        await usersCollection.insertOne({
            deviceId,
            code,
            ip,
            time: new Date()
        });

        await codesCollection.insertOne({
            code,
            deviceId,
            ip,
            time: new Date()
        });

        res.json({ success: true, code });

    } catch (err) {
        console.error("get-code:", err);
        res.json({ success: false, message: err.message });
    }
});

// ===== SUBMIT CODE =====
app.post("/submit-code", async (req, res) => {
    try {
        const { deviceId, userId, platform, userInputCode, systemCode, timestamp } = req.body;
        const ip = getRealIP(req);

        if (!deviceId || !userId || !platform || !userInputCode) {
            return res.json({ success: false, message: "Thiếu dữ liệu" });
        }

        const validPlatforms = ["AMO", "ATV", "LG"];
        if (!validPlatforms.includes(platform)) {
            return res.json({ success: false, message: "Platform không hợp lệ" });
        }

        if (userInputCode.toUpperCase() !== systemCode.toUpperCase()) {
            return res.json({ success: false, message: "Sai mã!" });
        }

        await submittedCodesCollection.insertOne({
            deviceId,
            userId,
            platform,
            code: userInputCode.toUpperCase(),
            ip,
            timestamp,
            confirmedAt: new Date()
        });

        res.json({ success: true });

    } catch (err) {
        console.error("submit-code:", err);
        res.json({ success: false, message: err.message });
    }
});

// ===== 🎯 SPIN WHEEL (KHÓA IP + DEVICE + FINGERPRINT) =====
app.post("/spin-wheel", async (req, res) => {
    try {
        const { deviceId, fingerprint } = req.body;
        const ip = getRealIP(req);

        const now = Date.now();
        const cooldown = 6 * 60 * 60 * 1000;

        // 🔥 tìm theo cả 3
        const existing = await spinsCollection.findOne({
            $or: [
                { ip },
                { deviceId },
                { fingerprint }
            ]
        });

        if (existing) {
            const diff = now - existing.lastSpin;

            if (diff < cooldown) {
                return res.json({
                    success: false,
                    remain: cooldown - diff,
                    message: "Đã quay rồi"
                });
            }
        }

        const characters = [
            "Ace","Echo","Smart","Khan","Lucy Băng","Lucy Idol",
            "Ruby","Bensi","Gin","Jey","Koo","Thrue","Bebee","Gold"
        ];

        const result = characters[Math.floor(Math.random() * characters.length)];

        await spinsCollection.insertOne({
            ip,
            deviceId,
            fingerprint,
            lastSpin: now,
            lastResult: result
        });

        res.json({ success: true, result });

    } catch (err) {
        console.error("spin-wheel:", err);
        res.json({ success: false, message: "Lỗi server" });
    }
});

// ===== START SERVER =====
async function startServer() {
    try {
        await client.connect();

        db = client.db("rubyfree");

        usersCollection = db.collection("users");
        codesCollection = db.collection("codes");
        submittedCodesCollection = db.collection("submittedCodes");
        spinsCollection = db.collection("spins");

        console.log("✅ MongoDB connected");

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
        });

    } catch (err) {
        console.error("❌ MongoDB connect fail:", err);
        process.exit(1);
    }
}

startServer();
