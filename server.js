const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// lưu dữ liệu (sau này có thể thay DB)
let users = {}; 
let codes = [];

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

// lấy IP
function getIP(req) {
    return req.headers["x-forwarded-for"] || req.socket.remoteAddress;
}

// ===== API NHẬN CODE =====
app.post("/get-code", (req, res) => {
    const { deviceId } = req.body;
    const ip = getIP(req);

    if (!deviceId) {
        return res.json({ success: false, message: "Thiếu deviceId" });
    }

    // check đã nhận chưa
    if (users[deviceId]) {
        return res.json({
            success: false,
            message: "Bạn đã nhận mã rồi!",
            code: users[deviceId].code
        });
    }

    const code = generateCode();

    users[deviceId] = {
        code: code,
        ip: ip,
        time: Date.now()
    };

    codes.push({
        code: code,
        deviceId: deviceId,
        ip: ip,
        time: Date.now()
    });

    console.log("NEW CODE:", code, ip);

    res.json({
        success: true,
        code: code
    });
});

// ===== LỊCH SỬ =====
app.get("/history", (req, res) => {
    res.json(codes);
});

// ===== CHECK CODE =====
app.get("/check", (req, res) => {
    const code = req.query.code;

    const found = codes.find(c => c.code === code);

    if (!found) {
        return res.json({ valid: false });
    }

    res.json({ valid: true, data: found });
});

app.listen(3000, () => {
    console.log("🚀 Server chạy tại http://localhost:3000");
});