const API_KEY = "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";

const authScreen = document.getElementById("authScreen");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const welcome = document.getElementById("welcome");
const chatBox = document.getElementById("chatBox");
const userInput = document.getElementById("userInput");
const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const historyBox = document.getElementById("history");

let selectedFile = null;
let currentUser = JSON.parse(localStorage.getItem("shohinCurrentUser"));
let chats = [];
let currentChat = null;

function checkAuth() {
    if (currentUser && currentUser.email) {
        authScreen.style.display = "none";
        document.getElementById("profileName").innerText = "👤 " + currentUser.name;
        document.getElementById("profileEmail").innerText = currentUser.email;
        
        const hour = new Date().getHours();
        let greeting = "Good morning";
        if (hour >= 12 && hour < 18) greeting = "Good afternoon";
        else if (hour >= 18) greeting = "Good evening";
        
        document.getElementById("welcomeTitle").innerText = greeting + ", " + currentUser.name;
        
        chats = JSON.parse(localStorage.getItem("shohinChats_" + currentUser.email) || "[]");
        renderHistory();
    } else {
        authScreen.style.display = "flex";
    }
}

function loginUser() {
    const name = document.getElementById("loginName").value.trim();
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    if (!name || !email) {
        alert("Please enter both your name and email address!");
        return;
    }
    currentUser = { name: name, email: email };
    localStorage.setItem("shohinCurrentUser", JSON.stringify(currentUser));
    newChat();
    checkAuth();
}

function logoutUser() {
    localStorage.removeItem("shohinCurrentUser");
    currentUser = null;
    toggleSidebar();
    checkAuth();
}

function saveUserChats() {
    if (currentUser && currentUser.email) {
        localStorage.setItem("shohinChats_" + currentUser.email, JSON.stringify(chats));
    }
}

function toggleSidebar() {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("open");
}

function useTemplate(text) {
    userInput.value = text;
    userInput.focus();
}

userInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") sendMessage();
});

fileInput.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    if (file.type.startsWith("image/")) {
        reader.onload = function(ev) {
            selectedFile = { name: file.name, type: file.type, url: ev.target.result };
            preview.style.display = "block";
            preview.innerText = "🖼️ " + file.name + " (Attached)";
        };
        reader.readAsDataURL(file);
    } else {
        reader.onload = function(ev) {
            selectedFile = { name: file.name, type: "text/plain", text: ev.target.result };
            preview.style.display = "block";
            preview.innerText = "📄 " + file.name + " (Attached)";
        };
        reader.readAsText(file);
    }
});

function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Your browser does not support voice recognition."); return; }
    const rec = new SR();
    rec.lang = "uz-UZ";
    const micBtn = document.getElementById("micBtn");
    micBtn.classList.add("recording");
    rec.onresult = function(e) {
        userInput.value += (userInput.value ? " " : "") + e.results[0][0].transcript;
    };
    rec.onend = function() { micBtn.classList.remove("recording"); };
    rec.start();
}

function renderHistory() {
    historyBox.innerHTML = "";
    chats.forEach(c => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.innerText = "💬 " + c.title;
        div.onclick = () => { loadChat(c.id); toggleSidebar(); };
        historyBox.appendChild(div);
    });
}

function newChat() {
    currentChat = null;
    chatBox.innerHTML = "";
    chatBox.style.display = "none";
    welcome.style.display = "flex";
    selectedFile = null;
    preview.style.display = "none";
}

function loadChat(id) {
    const found = chats.find(c => c.id === id);
    if (!found) return;
    currentChat = id;
    welcome.style.display = "none";
    chatBox.style.display = "flex";
    chatBox.innerHTML = "";
    found.messages.forEach(m => addMsg(m.text, m.role, m.img));
}

function addMsg(text, role, imgUrl) {
    welcome.style.display = "none";
    chatBox.style.display = "flex";
    const div = document.createElement("div");
    div.className = "message " + (role === "user" ? "user-message" : "ai-message");
    if (imgUrl) {
        const img = document.createElement("img");
        img.src = imgUrl;
        div.appendChild(img);
    }
    const p = document.createElement("div");
    p.innerText = text;
    div.appendChild(p);
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendMessage() {
    let text = userInput.value.trim();
    if (!text && !selectedFile) return;

    const fileCopy = selectedFile;
    const label = text || (fileCopy ? "Uploaded: " + fileCopy.name : "");

    if (!currentChat) {
        currentChat = Date.now();
        chats.unshift({ id: currentChat, title: label.slice(0, 25), messages: [] });
    }

    const active = chats.find(c => c.id === currentChat);
    addMsg(label, "user", fileCopy && fileCopy.url ? fileCopy.url : null);
    active.messages.push({ text: label, role: "user", img: fileCopy ? fileCopy.url : null });
    saveUserChats();
    renderHistory();

    userInput.value = "";
    selectedFile = null;
    fileInput.value = "";
    preview.style.display = "none";

    if (fileCopy && fileCopy.text) {
        text += "\n\nAttached File Content:\n" + fileCopy.text;
    }

    try {
        const res = await fetch("https://groq.com", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + API_KEY
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "Your name is SHOHIN AI. Assist " + (currentUser ? currentUser.name : "User") + " in Uzbek, English, Russian, or Tajik. Be smart, fast, and helpful." },
                    { role: "user", content: text || "Please analyze this attachment." }
                ]
            })
        });
        const data = await res.json();
        if (data.error) { addMsg("API Error: " + data.error.message, "ai"); return; }
        const reply = data.choices?.[0]?.message?.content || "No response received.";
        addMsg(reply, "ai");
        active.messages.push({ text: reply, role: "ai" });
        saveUserChats();
    } catch (err) {
        addMsg("Connection Error: " + err.message, "ai");
    }
}

checkAuth();
