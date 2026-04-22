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

// ✨ MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://busidolnew:busidolnew@cluster0.ejinj73.mongodb.net/?appName=Cluster0";
let db;
let usersCollection;
let codesCollection;
let submittedCodesCollection;
let dbReady = false; // ✨ Flag để check connection

const client = new MongoClient(MONGODB_URI);

async function connectDB() {
    try {
        await client.connect();
        db = client.db("rubyfree");
        usersCollection = db.collection("users");
        codesCollection = db.collection("codes");
        submittedCodesCollection = db.collection("submittedCodes");
        
        dbReady = true; // ✨ Set flag = true khi connect xong
        console.log("✅ Kết nối MongoDB thành công!");
    } catch (err) {
        console.error("❌ Lỗi kết nối MongoDB:", err);
        dbReady = false;
    }
}

connectDB();

// ✨ MIDDLEWARE: Chờ database ready trước khi process request
async function waitForDB() {
    let retries = 0;
    while (!dbReady && retries < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
    }
    if (!dbReady) {
        throw new Error("Database connection timeout");
    }
}

// tạo code
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

app.get("/create-token", (req, res) => {
    const token = Math.random().toString(36).substring(2, 15) + Date.now();
    res.json({ token });
});

// GET CODE
app.post("/get-code", async (req, res) => {
    try {
        await waitForDB(); // ✨ Chờ database ready
        
        const { deviceId } = req.body;
        const ip = getIP(req);

        if (!deviceId) {
            return res.json({ success: false, message: "Thiếu deviceId" });
        }

        // Kiểm tra user đã nhận mã chưa
        const existingUser = await usersCollection.findOne({ deviceId });

        if (existingUser) {
            return res.json({
                success: false,
                message: "Bạn đã nhận mã rồi!",
                code: existingUser.code
            });
        }

        const code = generateCode();

        // Lưu user
        await usersCollection.insertOne({
            deviceId,
            code,
            ip,
            time: new Date()
        });

        // Lưu code vào codes collection
        await codesCollection.insertOne({
            code,
            deviceId,
            ip,
            time: new Date()
        });

        res.json({ success: true, code });
    } catch (err) {
        console.error("Lỗi get-code:", err);
        res.json({ success: false, message: "Lỗi server: " + err.message });
    }
});

// NHẬN MÃ + ID + NỀN TẢNG TỪ USER
app.post("/submit-code", async (req, res) => {
    try {
        await waitForDB(); // ✨ Chờ database ready
        
        const { deviceId, userId, platform, userInputCode, systemCode, timestamp } = req.body;
        const ip = getIP(req);

        // ✅ Validation
        if (!deviceId || !userId || !platform || !userInputCode) {
            return res.json({ success: false, message: "Thiếu dữ liệu bắt buộc" });
        }

        // ✅ Kiểm tra nền tảng hợp lệ
        const validPlatforms = ["AMO", "ATV", "LG"];
        if (!validPlatforms.includes(platform)) {
            return res.json({ success: false, message: "Nền tảng không hợp lệ" });
        }

        // ✅ Kiểm tra mã có khớp không
        if (userInputCode.toUpperCase() !== systemCode.toUpperCase()) {
            return res.json({ 
                success: false, 
                message: "Mã không khớp! Vui lòng kiểm tra lại." 
            });
        }

        // 💾 Lưu vào MongoDB
        await submittedCodesCollection.insertOne({
            deviceId,
            userId,
            platform,
            code: userInputCode.toUpperCase(),
            ip,
            timestamp,
            confirmedAt: new Date()
        });

        res.json({ 
            success: true, 
            message: "Thông tin đã được lưu!"
        });
    } catch (err) {
        console.error("Lỗi submit-code:", err);
        res.json({ success: false, message: "Lỗi server: " + err.message });
    }
});

// LỊCH SỬ
app.get("/history", async (req, res) => {
    try {
        await waitForDB(); // ✨ Chờ database ready
        const codes = await codesCollection.find({}).toArray();
        res.json(codes);
    } catch (err) {
        res.json([]);
    }
});

// XEM TẤT CẢ THÔNG TIN USER ĐÃ GỬI
app.get("/submitted-codes", async (req, res) => {
    try {
        await waitForDB(); // ✨ Chờ database ready
        const submissions = await submittedCodesCollection.find({}).toArray();
        res.json(submissions);
    } catch (err) {
        res.json([]);
    }
});

// KIỂM TRA
app.get("/check", async (req, res) => {
    try {
        await waitForDB(); // ✨ Chờ database ready
        const code = req.query.code;
        const found = await codesCollection.findOne({ code });
        res.json(found ? { valid: true, data: found } : { valid: false });
    } catch (err) {
        res.json({ valid: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
    console.log(`📊 Xem thông tin: http://localhost:${PORT}/submitted-codes`);
});
