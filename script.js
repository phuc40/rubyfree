// ================= DEVICE ID =================
let deviceId = localStorage.getItem("deviceId");

if (!deviceId) {
    deviceId = "DEV-" + Math.random().toString(36).substring(2, 12);
    localStorage.setItem("deviceId", deviceId);
}

// ================= NHẬN MÃ =================
function getReward() {
    fetch("/create-token")
    .then(res => res.json())
    .then(data => {
        localStorage.setItem("reward_token", data.token);
        localStorage.setItem("start_time", Date.now());

        window.location.href = "https://link4m.com/6bAEoB2";
    });
}

// ================= LOAD LẠI =================
window.onload = function () {
    const token = localStorage.getItem("reward_token");
    const start = localStorage.getItem("start_time");

    if (!token || !start) return;

    const now = Date.now();

    if (now - start < 20000) return;

    if (now - start > 240000) {
        localStorage.removeItem("reward_token");
        localStorage.removeItem("start_time");
        return;
    }

    fetch("/get-code", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            deviceId: deviceId,
            token: token
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById("code").innerText = data.code;
            document.getElementById("codeInputSection").style.display = "block";
        } else {
            if (data.code) {
                document.getElementById("code").innerText = data.code;
                document.getElementById("codeInputSection").style.display = "block";
            }
            alert(data.message);
        }
    });

    localStorage.removeItem("reward_token");
    localStorage.removeItem("start_time");
};

// ================= GỬI CODE =================
function submitCode() {
    const userId = document.getElementById("userIdInput").value.trim();
    const platform = document.getElementById("platformSelect").value;
    const userCode = document.getElementById("userCodeInput").value.trim();
    const displayedCode = document.getElementById("code").innerText;
    const statusEl = document.getElementById("submitStatus");

    if (!userId) return showError("❌ Vui lòng nhập ID!");
    if (!platform) return showError("❌ Vui lòng chọn nền tảng!");
    if (!userCode) return showError("❌ Vui lòng nhập mã!");

    fetch("/submit-code", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            deviceId,
            userId,
            platform,
            userInputCode: userCode,
            systemCode: displayedCode,
            timestamp: new Date().toISOString()
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            statusEl.innerText = "✅ Thành công!";
            statusEl.className = "submit-status success";

            document.getElementById("userIdInput").value = "";
            document.getElementById("platformSelect").value = "";
            document.getElementById("userCodeInput").value = "";

        } else {
            showError("❌ " + data.message);
        }
    })
    .catch(err => showError("❌ Lỗi: " + err.message));

    function showError(msg){
        statusEl.innerText = msg;
        statusEl.className = "submit-status error";
    }
}

// ================= POPUP =================
function openPrice() {
    document.getElementById("priceModal").style.display = "flex";
}
function closePrice() {
    document.getElementById("priceModal").style.display = "none";
}

function openWheel() {
    document.getElementById("wheelModal").style.display = "flex";
}
function closeWheel() {
    document.getElementById("wheelModal").style.display = "none";
}

// đóng popup khi click ngoài
window.addEventListener("click", function(e) {
    if (e.target.classList.contains("modal")) {
        e.target.style.display = "none";
    }
});

// ================= VÒNG QUAY =================

// tên hiển thị
const characters = [
    "Ace","Echo","Smart","Khan","Lucy Băng","Lucy Idol",
    "Ruby","Bensi","Gin","Jey","Koo","Thrue","Bebee","Gold"
];

// tên file ảnh
const characterImages = [
    "ace","echo","smart","khan","lucy_bang","lucy_idol",
    "ruby","bensi","gin","jey","koo","thrue","bebee","gold"
];

let currentRotation = 0;

// tạo item ảnh
function createWheelItems() {
    const wheel = document.getElementById("wheel");
    wheel.innerHTML = "";

    const total = characterImages.length;
    const radius = 95;

    characterImages.forEach((char, index) => {
        const angle = index * (360 / total);

        const item = document.createElement("div");
        item.className = "wheel-item";

        item.style.transform = `
            rotate(${angle}deg)
            translate(${radius}px)
            translate(-50%, -50%)
        `;

        item.innerHTML = `<img src="./images/${char}.png">`;
        wheel.appendChild(item);
    });
}

function getFingerprint() {
    return btoa(
        navigator.userAgent +
        screen.width +
        screen.height +
        navigator.language
    );
}

// ===== 🎯 SPIN (SERVER) =====
function spinWheel() {
    const wheel = document.getElementById("wheel");
    const resultText = document.getElementById("result");
    const cooldownText = document.getElementById("cooldown");

    fetch("/spin-wheel", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ deviceId, fingerprint: getFingerprint() })
    })
    .then(res => res.json())
    .then(data => {

        if (!data.success) {
            if (data.remain) {
                const h = Math.floor(data.remain / 3600000);
                const m = Math.floor((data.remain % 3600000) / 60000);
                cooldownText.innerText = `⏳ Chờ ${h}h ${m}p`;
            } else {
                alert(data.message);
            }
            return;
        }

        const result = data.result;

        const index = characters.indexOf(result);
        const angle = 360 / characters.length;

        const rotateTo = 360 * 5 + (index * angle);
        currentRotation += rotateTo;

        wheel.style.transform = `rotate(${currentRotation}deg)`;

        cooldownText.innerText = "";

        setTimeout(() => {
            resultText.innerText = "🎉 Bạn trúng: " + result;
        }, 4000);
    });
}

// ===== INIT =====
window.addEventListener("load", () => {
    createWheelItems();
});

function openShop() {
    document.getElementById("shopModal").style.display = "flex";
    loadShop();
}

function closeShop() {
    document.getElementById("shopModal").style.display = "none";
}

async function loadShop() {
    const res = await fetch("/shop-acc");
    const data = await res.json();

    const container = document.getElementById("shopList");

    if (!data.length) {
        container.innerHTML = "<p>Chưa có acc</p>";
        return;
    }

    container.innerHTML = data.map(acc => `
        <div class="shop-item">
            <img src="${acc.image}" />
            <div class="shop-price">${acc.price}</div>
            <button class="buy-btn" onclick="buyAcc()">Mua</button>
        </div>
    `).join("");
}

function buyAcc() {
    window.open("https://discord.com/users/1201014400350429284", "_blank");
}
