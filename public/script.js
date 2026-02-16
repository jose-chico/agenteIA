const messageInput = document.getElementById("messageInput");
const btnEnviar = document.getElementById("btnEnviar");
const chatMessages = document.getElementById("chat-messages");
const imageInputClient = document.getElementById("imageInputClient");
const attachBtn = document.querySelector(".attach-btn");
const logoutBtn = document.getElementById("logout-btn");
const statusEscritaCliente = document.getElementById("status-escrita-cliente");
const clientSound = document.getElementById("notification-sound-client");

const token = localStorage.getItem("token");
let meuId = null;
let typingTimeout;

const socket = window.io(window.location.origin, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000
});
// Função auxiliar para verificar autenticação
function checkAuth(response) {
    if (response.status === 401) {
        showToast("Sua sessão expirou. Faça login novamente.", "error");
        setTimeout(() => {
            localStorage.clear();
            window.location.href = "login.html";
        }, 2000);
        return false;
    }
    return true;
}

// --- SISTEMA DE TOAST E CONFIRMAÇÃO ---
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    let icon = "";
    if (type === "success") icon = "✅";
    else if (type === "error") icon = "❌";
    else icon = "ℹ️";

    toast.innerHTML = `<span style="font-size: 1.2em;">${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);

    // Remove após 3 segundos
    setTimeout(() => {
        toast.style.animation = "fadeOut 0.3s forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById("confirm-modal");
    const msgEl = document.getElementById("confirm-message");
    const btnYes = document.getElementById("confirm-btn-yes");

    if (!modal || !msgEl || !btnYes) return;

    msgEl.innerText = message;
    modal.style.display = "flex";

    // Configura o botão Sim
    btnYes.onclick = () => {
        onConfirm();
        closeConfirmModal();
    };
}

function closeConfirmModal(event) {
    if (event && event.target.id !== "confirm-modal") return;
    const modal = document.getElementById("confirm-modal");
    if (modal) modal.style.display = "none";
}

// --- FUNÇÃO PARA APAGAR MENSAGEM (REMODELADA) ---
window.handleDeleteClient = async function (msgId, mode) {
    // Se for apagar para todos, exige confirmação via Modal
    if (mode === "TODOS") {
        closeOptionsModal(); // Fecha o menu de opções primeiro
        showConfirmModal("Tem certeza que deseja apagar esta mensagem para todos?", async () => {
            await executeDelete(msgId, mode);
        });
        return;
    }

    // Apagar para mim executa direto
    await executeDelete(msgId, mode);
};

async function executeDelete(msgId, mode) {
    try {
        const response = await fetch(`/messages/${msgId}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ mode: mode })
        });

        if (!checkAuth(response)) return;

        if (response.ok) {
            if (mode === "TODOS") {
                showToast("Mensagem apagada para todos.", "success");
            } else {
                const msgElement = document.getElementById(`msg-${msgId}`);
                if (msgElement) {
                    msgElement.style.transition = "0.3s";
                    msgElement.style.opacity = "0";
                    setTimeout(() => msgElement.remove(), 300);
                }
                showToast("Mensagem apagada para você.", "success");
            }
        } else {
            showToast("Erro ao apagar mensagem.", "error");
        }
    } catch (error) {
        console.error("Erro ao apagar:", error);
        showToast("Erro de conexão.", "error");
    }
}

socket.on("connect", () => {
    console.log("🟢 Conectado!");
    // Entra na sala depois que carregar o histórico e tiver o meuId
});

socket.on("newMessage", (msg) => {
    // Só processa mensagens destinadas a este cliente
    if (msg.clienteId === meuId || msg.usuarioId === meuId) {
        if (msg.senderType === "ADMIN") {
            if (clientSound) clientSound.play().catch(() => { });
            if (statusEscritaCliente) statusEscritaCliente.innerText = "";

            // Marca automaticamente como lida se a janela estiver visível
            if (!document.hidden) {
                marcarComoLida([msg.id]);
            }
        }
        renderMessage(msg.content, msg.senderType, msg.createdAt, msg.id, msg.isRead);
    }
});

// Escuta quando mensagens são marcadas como lidas
socket.on("messageRead", (data) => {
    data.messageIds.forEach(msgId => {
        const msgElement = document.getElementById(`msg-${msgId}`);
        if (msgElement) {
            const checkmark = msgElement.querySelector(".read-status");
            if (checkmark) {
                checkmark.innerHTML = "✓✓";
                checkmark.style.color = "#4CAF50";
            }
        }
    });
});

// ESCUTA QUANDO ALGUÉM APAGA PARA TODOS
socket.on("messageDeleted", (data) => {
    const msgElement = document.getElementById(`msg-${data.id}`);
    if (msgElement) msgElement.remove();
});

socket.on("displayTyping", (data) => {
    if (data.senderType === "ADMIN" && statusEscritaCliente) {
        statusEscritaCliente.innerText = data.isTyping ? "O suporte está digitando..." : "";
    }
});

async function carregarMeuHistorico() {
    if (!token) return;
    try {
        const response = await fetch("/messages/me", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!checkAuth(response)) return;

        if (response.ok) {
            const mensagens = await response.json();
            if (mensagens.length > 0) {
                meuId = mensagens[0].usuarioId || mensagens[0].clienteId;
                // Entra na sala do socket após obter o ID
                socket.emit("join", { userId: meuId, isAdmin: false });
            }
            chatMessages.innerHTML = "";

            // IDs de mensagens não lidas do admin
            const unreadAdminMessages = [];

            mensagens.forEach(msg => {
                const tipo = msg.clienteId && msg.senderType === "ADMIN" ? "ADMIN" : "USER";
                renderMessage(msg.content, tipo, msg.createdAt, msg.id, msg.isRead);

                // Coleta mensagens não lidas do admin
                if (msg.senderType === "ADMIN" && !msg.isRead) {
                    unreadAdminMessages.push(msg.id);
                }
            });

            // Marca mensagens do admin como lidas ao carregar
            if (unreadAdminMessages.length > 0) {
                marcarComoLida(unreadAdminMessages);
            }
        }
    } catch (error) {
        console.error(error);
    }
}

function renderMessage(content, senderType, timestamp, msgId, isRead = false) {
    if (!chatMessages) return;

    const idElemento = `msg-${msgId}`;
    if (document.getElementById(idElemento)) return;

    const div = document.createElement("div");
    div.id = idElemento;
    div.className = `message ${senderType === "ADMIN" ? "support" : "user"}`;
    div.style.position = "relative";

    const hora = new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const isImage = content.includes("/uploads/") || content.match(/\.(jpeg|jpg|gif|png|webp)$/i);

    let htmlContent = isImage
        ? `<img src="${content}" class="chat-image" onclick="window.open('${content}')" alt="Imagem">`
        : `<p>${content}</p>`;

    // Normaliza o senderType para garantir comparação correta
    const rawType = senderType || "CLIENTE";
    const type = String(rawType).toUpperCase().trim();
    const isMyMessage = type !== "ADMIN" && type !== "SUPPORT";

    // Status de leitura (apenas para mensagens do cliente)
    const readStatus = isMyMessage ? `<span class="read-status" style="font-size:10px; opacity:0.7; margin-left:5px;">${isRead ? "✓✓" : "✓"}</span>` : "";

    div.innerHTML = `
        ${htmlContent}
        <small style="font-size:10px; opacity:0.6; display:block; text-align:right; margin-top: 4px;">
            ${hora}${readStatus}
        </small>
        <!-- Ícone para desktop (seta) -->
        <span class="menu-icon" onclick="openOptionsModal('${msgId}', ${isMyMessage})">⌄</span>
    `;

    // --- LÓGICA DE LONG PRESS (MOBILE) ---
    let pressTimer;

    div.addEventListener("touchstart", (e) => {
        if (e.target.tagName === "IMG" || e.target.tagName === "A") return;

        // Feedback visual imediato (se quiser)
        div.style.transform = "scale(0.98)";

        pressTimer = setTimeout(() => {
            // Vibração
            if (navigator.vibrate) navigator.vibrate(50);

            // Restaura tamanho
            div.style.transform = "scale(1)";

            openOptionsModal(msgId, isMyMessage);
        }, 800);
    });

    div.addEventListener("touchend", () => {
        clearTimeout(pressTimer);
        div.style.transform = "scale(1)"; // Restaura se soltar antes
    });

    div.addEventListener("touchmove", () => {
        clearTimeout(pressTimer);
        div.style.transform = "scale(1)"; // Restaura se mover
    });

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- FUNÇÕES DO MODAL GLOBAL ---
function openOptionsModal(msgId, isMyMessage) {
    const modal = document.getElementById("msg-options-modal");
    const actionsContainer = document.getElementById("modal-actions");

    if (!modal || !actionsContainer) return;

    actionsContainer.innerHTML = "";

    if (isMyMessage) {
        const btnAll = document.createElement("button");
        btnAll.className = "msg-opt-btn delete-all";
        btnAll.innerHTML = '<span class="icon">�️</span> Apagar para todos';
        btnAll.onclick = () => {
            handleDeleteClient(msgId, "TODOS");
            closeOptionsModal();
        };
        actionsContainer.appendChild(btnAll);
    }

    const btnMe = document.createElement("button");
    btnMe.className = "msg-opt-btn delete-me";
    btnMe.innerHTML = '<span class="icon">👁️</span> Apagar para mim';
    btnMe.onclick = () => {
        handleDeleteClient(msgId, "MIM");
        closeOptionsModal();
    };
    actionsContainer.appendChild(btnMe);

    modal.style.display = "flex";
}

function closeOptionsModal(event) {
    if (event && event.target.id !== "msg-options-modal") return;

    const modal = document.getElementById("msg-options-modal");
    if (modal) modal.style.display = "none";
}

async function sendMessage(content) {
    if (!token || !content.trim()) return;
    socket.emit("typing", { clienteId: meuId, senderType: "CLIENTE", isTyping: false });

    try {
        const response = await fetch("/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ content })
        });

        if (!checkAuth(response)) return;

        if (response.ok) {
            const novaMsg = await response.json();
            if (!meuId) meuId = novaMsg.usuarioId;
            // Não precisa renderizar aqui - o socket.on("newMessage") vai fazer isso
            messageInput.value = "";
        }
    } catch (error) {
        console.error(error);
    }
}

async function marcarComoLida(messageIds) {
    if (!token || !messageIds || messageIds.length === 0) return;
    try {
        const response = await fetch("/mark-read", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ messageIds })
        });

        checkAuth(response);
    } catch (error) {
        console.error("Erro ao marcar como lida:", error);
    }
}

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        const unreadMessages = Array.from(document.querySelectorAll(".message.support")).map(el => {
            const id = el.id.replace("msg-", "");
            return parseInt(id);
        }).filter(id => !isNaN(id));

        if (unreadMessages.length > 0) {
            marcarComoLida(unreadMessages);
        }
    }
});

messageInput.oninput = () => {
    if (!meuId || !socket) return;
    socket.emit("typing", { clienteId: meuId, senderType: "CLIENTE", isTyping: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit("typing", { clienteId: meuId, senderType: "CLIENTE", isTyping: false });
    }, 2000);
};

document.addEventListener("DOMContentLoaded", () => {
    if (!token) {
        window.location.href = "login.html";
        return;
    }
    carregarMeuHistorico();
});

if (btnEnviar) {
    btnEnviar.onclick = () => sendMessage(messageInput.value);
}

messageInput.onkeypress = (e) => {
    if (e.key === "Enter") sendMessage(messageInput.value);
};

if (attachBtn && imageInputClient) {
    attachBtn.onclick = () => imageInputClient.click();

    imageInputClient.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append("image", file);
        try {
            const res = await fetch("/messages/upload", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });

            if (!checkAuth(res)) return;

            if (res.ok) {
                const data = await res.json();
                sendMessage(data.url);
                imageInputClient.value = "";
            }
        } catch (err) {
            console.error(err);
        }
    };
}

if (logoutBtn) {
    logoutBtn.onclick = () => {
        localStorage.clear();
        window.location.href = "login.html";
    };
}

// Função para inserir emoji no input
function insertEmoji(emoji) {
    const input = document.getElementById("messageInput");
    if (input) {
        const cursorPos = input.selectionStart;
        const textBefore = input.value.substring(0, cursorPos);
        const textAfter = input.value.substring(cursorPos);
        input.value = textBefore + emoji + textAfter;
        input.focus();
        input.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    }
}

// Função para mostrar/esconder o picker de emojis
function toggleEmojiPicker(type) {
    const emojiBar = document.getElementById(`emoji-bar-${type}`);
    if (emojiBar) {
        if (emojiBar.style.display === "none" || !emojiBar.style.display) {
            emojiBar.style.display = "flex";
        } else {
            emojiBar.style.display = "none";
        }
    }
}

// Fecha o emoji picker ao clicar fora
document.addEventListener("click", function (event) {
    const emojiBar = document.getElementById("emoji-bar-client");
    const emojiBtn = document.querySelector(".emoji-toggle-btn");

    if (emojiBar && emojiBtn && !emojiBar.contains(event.target) && event.target !== emojiBtn) {
        emojiBar.style.display = "none";
    }
});

// --- PUSH NOTIFICATIONS ---
const publicVapidKey = "BJJ8fren03WaYXm6588uhXgUDgLXEQj-qHdUDRB9EcSC1wzEl5k5qWjvr1zIhypAThhBKH7Ma2GSYoUxI-JiTM4"; // Chave PÚBLICA gerada

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

if ("serviceWorker" in navigator && "PushManager" in window) {
    window.addEventListener("load", async () => {
        try {
            const register = await navigator.serviceWorker.register("/sw.js", {
                scope: "/"
            });
            console.log("Service Worker registrado...");

            // Só pede permissão se o usuário clicar em algo ou se já tiver dado permissão antes
            if (Notification.permission === "granted") {
                await subscribeUser(register);
            } else if (Notification.permission !== "denied") {
                const btnNotify = document.getElementById("btn-notify");
                if (btnNotify) btnNotify.style.display = "block";
            }
        } catch (err) {
            console.error("Erro no Service Worker:", err);
        }
    });
}

// Chame esta função via botão no UI para garantir permissão
window.requestNotificationPermission = async () => {
    const register = await navigator.serviceWorker.ready;
    await subscribeUser(register);
};

async function subscribeUser(register) {
    try {
        const subscription = await register.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });

        console.log("Push Registered...");

        // Envia subscrição para o backend
        // Tenta pegar o ID do cliente do localStorage ou espera carregar
        // Como o script roda no load, o carregarMeuHistorico já deve ter setado meuId ou vai setar
        // Melhor enviar quando tiver certeza do ID

        if (meuId) {
            await sendSubscription(subscription);
        } else {
            // Aguarda um pouco ou usa um evento customizado
            setTimeout(() => {
                if (meuId) sendSubscription(subscription);
            }, 2000);
        }

    } catch (err) {
        console.error("Erro ao inscrever push:", err);
    }
}

async function sendSubscription(subscription) {
    await fetch("/subscribe", {
        method: "POST",
        body: JSON.stringify({ subscription, clienteId: meuId }),
        headers: {
            "content-type": "application/json"
        }
    });
    console.log("Sent push to server...");
}
