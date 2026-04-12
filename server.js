const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST"]
}));

app.use(express.json());
app.use(express.static(__dirname));

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

    res.json({ success: true, code });
});

// history
app.get("/history", (req, res) => {
    res.json(codes);
});

// check
app.get("/check", (req, res) => {
    const code = req.query.code;
    const found = codes.find(c => c.code === code);

    res.json(found ? { valid: true, data: found } : { valid: false });
});

app.listen(3000, () => {
    console.log("🚀 Server chạy tại http://localhost:3000");
});
