// ===== TẠO DEVICE ID =====
let deviceId = localStorage.getItem("deviceId");

if (!deviceId) {
    deviceId = "DEV-" + Math.random().toString(36).substring(2, 12);
    localStorage.setItem("deviceId", deviceId);
}

// ===== BẤM NÚT =====
function getReward() {
    fetch("/create-token")
    .then(res => res.json())
    .then(data => {
        localStorage.setItem("reward_token", data.token);
        localStorage.setItem("start_time", Date.now());

        // đi link4m
        window.location.href = "https://link4m.com/7ZmOsy";
    });
}

// ===== QUAY LẠI =====
window.onload = function () {
    const token = localStorage.getItem("reward_token");
    const start = localStorage.getItem("start_time");

    if (!token || !start) return;

    const now = Date.now();

    // ❌ quay lại quá nhanh
    if (now - start < 15000) {
        console.log("Chưa đủ thời gian");
        return;
    }

    // ❌ quá lâu -> reset
    if (now - start > 120000) {
        localStorage.removeItem("reward_token");
        localStorage.removeItem("start_time");
        return;
    }

    fetch("/get-code", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            deviceId: deviceId,
            token: token
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById("code").innerText = data.code;
            alert("🎁 Mã của bạn: " + data.code);
        } else {
            alert(data.message);
            if (data.code) {
                document.getElementById("code").innerText = data.code;
            }
        }
    });

    // xoá token sau khi dùng
    localStorage.removeItem("reward_token");
    localStorage.removeItem("start_time");
};
