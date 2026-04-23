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
        window.location.href = "https://link4m.com/6bAEoB2";
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
            
            // ✨ Hiển thị phần nhập mã
            document.getElementById("codeInputSection").style.display = "block";
            
            alert("🎁 Mã của bạn: " + data.code);
        } else {
            alert(data.message);
            if (data.code) {
                document.getElementById("code").innerText = data.code;
                // ✨ Hiển thị phần nhập mã ngay cả khi user đã nhận trước đó
                document.getElementById("codeInputSection").style.display = "block";
            }
        }
    });

    // xoá token sau khi dùng
    localStorage.removeItem("reward_token");
    localStorage.removeItem("start_time");
};

// ===== NHẬP & GỬI MÃ =====
function submitCode() {
    const userId = document.getElementById("userIdInput").value.trim();
    const platform = document.getElementById("platformSelect").value;
    const userCode = document.getElementById("userCodeInput").value.trim();
    const displayedCode = document.getElementById("code").innerText;
    const statusEl = document.getElementById("submitStatus");

    // ✅ Kiểm tra validation
    if (!userId) {
        statusEl.innerText = "❌ Vui lòng nhập ID!";
        statusEl.classList.add("error");
        statusEl.classList.remove("success");
        return;
    }

    if (!platform) {
        statusEl.innerText = "❌ Vui lòng chọn nền tảng!";
        statusEl.classList.add("error");
        statusEl.classList.remove("success");
        return;
    }

    if (!userCode) {
        statusEl.innerText = "❌ Vui lòng nhập mã!";
        statusEl.classList.add("error");
        statusEl.classList.remove("success");
        return;
    }

    // 🚀 Gửi mã lên server
    fetch("/submit-code", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            deviceId: deviceId,
            userId: userId,
            platform: platform,
            userInputCode: userCode,
            systemCode: displayedCode,
            timestamp: new Date().toISOString()
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            statusEl.innerText = "✅ Thông tin đã được lưu thành công!";
            statusEl.classList.add("success");
            statusEl.classList.remove("error");
            
            // Reset form
            document.getElementById("userIdInput").value = "";
            document.getElementById("platformSelect").value = "";
            document.getElementById("userCodeInput").value = "";
            
            // Optional: ẩn input sau 2 giây
            setTimeout(() => {
                document.getElementById("codeInputSection").style.display = "none";
            }, 3000);
        } else {
            statusEl.innerText = "❌ " + data.message;
            statusEl.classList.add("error");
            statusEl.classList.remove("success");
        }
    })
    .catch(err => {
        statusEl.innerText = "❌ Lỗi: " + err.message;
        statusEl.classList.add("error");
        statusEl.classList.remove("success");
    });
}
