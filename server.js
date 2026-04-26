const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST"]
}));

app.use(express.json());
app.use(express.static(__dirname));

// ===== MongoDB =====
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://busidolnew:busidol123@cluster0.ejinj73.mongodb.net/?appName=Cluster0";

let db;
let usersCollection;
let codesCollection;
let submittedCodesCollection;
let spinsCollection;

let dbReady = false;

const client = new MongoClient(MONGODB_URI);

async function connectDB() {
    try {
        await client.connect();
        db = client.db("rubyfree");

        usersCollection = db.collection("users");
        codesCollection = db.collection("codes");
        submittedCodesCollection = db.collection("submittedCodes");
        spinsCollection = db.collection("spins");

        // index chống spam
        await spinsCollection.createIndex({ deviceId: 1 });
        await spinsCollection.createIndex({ ip: 1 });

        dbReady = true;
        console.log("✅ Kết nối MongoDB thành công!");
    } catch (err) {
        console.error("❌ Lỗi MongoDB:", err);
        dbReady = false;
    }
}
connectDB();

// ===== CHỜ DB =====
async function waitForDB() {
    let retries = 0;
    while (!dbReady && retries < 30) {
        await new Promise(r => setTimeout(r, 1000));
        retries++;
    }
    if (!dbReady) throw new Error("DB timeout");
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

function getIP(req) {
    return req.headers["x-forwarded-for"] || req.socket.remoteAddress;
}

// ===== TOKEN =====
app.get("/create-token", (req, res) => {
    const token = Math.random().toString(36).substring(2) + Date.now();
    res.json({ token });
});

// ===== GET CODE =====
app.post("/get-code", async (req, res) => {
    try {
        await waitForDB();

        const { deviceId } = req.body;
        const ip = getIP(req);

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
        console.error("Lỗi get-code:", err);
        res.json({ success: false, message: err.message });
    }
});

// ===== SUBMIT CODE =====
app.post("/submit-code", async (req, res) => {
    try {
        await waitForDB();

        const { deviceId, userId, platform, userInputCode, systemCode, timestamp } = req.body;
        const ip = getIP(req);

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

// ===== 🎯 SPIN WHEEL (FIX CHÍNH) =====
app.post("/spin-wheel", async (req, res) => {
    try {
        await waitForDB();

        const { deviceId } = req.body;
        const ip = getIP(req);
        const userAgent = req.headers["user-agent"];

        if (!deviceId) {
            return res.json({ success: false, message: "Thiếu deviceId" });
        }

        const cooldown = 6 * 60 * 60 * 1000;
        const now = Date.now();

        // 🔥 kiểm tra CHẶT hơn
        const user = await spinsCollection.findOne({
            $or: [
                { deviceId },
                { ip },
                { userAgent }
            ]
        });

        if (user && user.lastSpin) {
            if (now - user.lastSpin < cooldown) {
                return res.json({
                    success: false,
                    remain: cooldown - (now - user.lastSpin)
                });
            }
        }

        const characters = [
            "Ace","Echo","Smart","Khan","Lucy Băng","Lucy Idol",
            "Ruby","Bensi","Gin","Jey","Koo","Thrue","Bebee","Gold"
        ];

        const result = characters[Math.floor(Math.random() * characters.length)];

        // 🔥 lưu đủ thông tin
        await spinsCollection.insertOne({
            deviceId,
            ip,
            userAgent,
            lastSpin: now,
            lastResult: result
        });

        res.json({ success: true, result });

    } catch (err) {
        console.error("spin-wheel:", err);
        res.json({ success: false, message: "Lỗi server" });
    }
});

const ipCount = await spinsCollection.countDocuments({
    ip,
    lastSpin: { $gt: now - cooldown }
});

if (ipCount >= 1) {
    return res.json({
        success: false,
        message: "Ai cho quay mà quay ?"
    });
}

// ===== HISTORY =====
app.get("/history", async (req, res) => {
    try {
        await waitForDB();
        const data = await codesCollection.find({}).toArray();
        res.json(data);
    } catch {
        res.json([]);
    }
});

app.get("/submitted-codes-api", async (req, res) => {
    try {
        await waitForDB();
        const data = await submittedCodesCollection.find({}).toArray();
        res.json(data);
    } catch {
        res.json([]);
    }
});

app.get("/submitted-codes", (req, res) => {
    res.sendFile(__dirname + "/submitted-codes.html");
});

app.get("/check", async (req, res) => {
    try {
        await waitForDB();
        const code = req.query.code;
        const found = await codesCollection.findOne({ code });
        res.json(found ? { valid: true } : { valid: false });
    } catch {
        res.json({ valid: false });
    }
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});
