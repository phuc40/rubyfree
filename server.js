const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST"]
}));

app.use(express.json());
app.use(express.static(__dirname));

let users = {};
let codes = [];
let submittedCodes = []; // ✨ Mới: lưu mã user gửi

// File để lưu dữ liệu vĩnh viễn
const dataFile = path.join(__dirname, "data.json");

// Load dữ liệu từ file khi server khởi động
function loadData() {
    try {
        if (fs.existsSync(dataFile)) {
            const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
            users = data.users || {};
            codes = data.codes || [];
            submittedCodes = data.submittedCodes || [];
        }
    } catch (err) {
        console.log("Lỗi khi load dữ liệu:", err);
    }
}

// Lưu dữ liệu vào file
function saveData() {
    try {
        fs.writeFileSync(dataFile, JSON.stringify({
            users,
            codes,
            submittedCodes
        }, null, 2));
    } catch (err) {
        console.log("Lỗi khi save dữ liệu:", err);
    }
}

loadData();

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
app.post("/get-code", (req, res) => {
    const { deviceId } = req.body;
    const ip = getIP(req);

    if (!deviceId) {
        return res.json({ success: false, message: "Thiếu deviceId" });
    }

    if (users[deviceId]) {
        return res.json({
            success: false,
            message: "Bạn đã nhận mã rồi!",
            code: users[deviceId].code
        });
    }

    const code = generateCode();

    users[deviceId] = { code, ip, time: Date.now() };
    codes.push({ code, deviceId, ip, time: Date.now() });
    
    saveData(); // ✨ Lưu vào file

    res.json({ success: true, code });
});

// ✨ ENDPOINT MỚI: NHẬN MÃ + ID + NỀN TẢNG TỪ USER
app.post("/submit-code", (req, res) => {
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

    // 💾 Lưu dữ liệu
    submittedCodes.push({
        deviceId,
        userId,
        platform,
        code: userInputCode.toUpperCase(),
        ip,
        timestamp,
        confirmedAt: new Date().toISOString()
    });

    saveData(); // ✨ Lưu vào file

    res.json({ 
        success: true, 
        message: "Thông tin đã được lưu!"
    });
});

// LỊCH SỬ
app.get("/history", (req, res) => {
    res.json(codes);
});

// ✨ XEM TẤT CẢ THÔNG TIN USER ĐÃ GỬI
app.get("/submitted-codes", (req, res) => {
    res.json(submittedCodes);
});

// KIỂM TRA
app.get("/check", (req, res) => {
    const code = req.query.code;
    const found = codes.find(c => c.code === code);

    res.json(found ? { valid: true, data: found } : { valid: false });
});

app.listen(3000, () => {
    console.log("🚀 Server chạy tại http://localhost:3000");
    console.log("📊 Xem thông tin: http://localhost:3000/submitted-codes");
});
