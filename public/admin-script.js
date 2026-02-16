const adminMessages = document.getElementById("admin-messages");
const adminReply = document.getElementById("adminReply");
const sendBtn = document.getElementById("send-btn");
const imageInputAdmin = document.getElementById("imageInputAdmin");
const attachBtnAdmin = document.querySelector(".attach-btn-admin");
const clientListDiv = document.querySelector(".client-list");
const typingStatusAdmin = document.getElementById("typing-status-admin");
const searchInput = document.getElementById("searchClient");
const broadcastModeCheckbox = document.getElementById("broadcastMode");
const broadcastHint = document.getElementById("broadcast-hint");

let clienteSelecionadoId = null;
let socket;
let typingTimeout;
let adminUserId = null;
let allClients = []; // Array para armazenar todos os clientes
const token = localStorage.getItem("token");
const notificationSound = new Audio("https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3");

// Verifica se está autenticado, se não redireciona para admin-login
if (!token) {
    window.location.href = "admin-login.html";
}

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

    setTimeout(() => {
        toast.style.animation = "fadeOut 0.3s forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function openAdminOptionsModal(msgId, isMyMessage) {
    const modal = document.getElementById("admin-msg-options-modal");
    const actionsContainer = document.getElementById("admin-modal-actions");
    if (!modal || !actionsContainer) return;

    actionsContainer.innerHTML = "";

    if (isMyMessage) {
        const btnAll = document.createElement("button");
        btnAll.className = "msg-opt-btn delete-all";
        btnAll.innerHTML = '<span class="icon">🗑️</span> Apagar para todos';
        btnAll.onclick = () => {
            deleteMsg(msgId, "TODOS");
            closeAdminOptionsModal();
        };
        actionsContainer.appendChild(btnAll);
    }

    const btnMe = document.createElement("button");
    btnMe.className = "msg-opt-btn delete-me";
    btnMe.innerHTML = '<span class="icon">👁️</span> Apagar para mim';
    btnMe.onclick = () => {
        deleteMsg(msgId, "MIM");
        closeAdminOptionsModal();
    };
    actionsContainer.appendChild(btnMe);

    modal.style.display = "flex";
}

function closeAdminOptionsModal(event) {
    if (event && event.target.id !== "admin-msg-options-modal") return;
    const modal = document.getElementById("admin-msg-options-modal");
    if (modal) modal.style.display = "none";
}

// --- FUNÇÃO PARA DELETAR MENSAGEM ---
window.deleteMsg = async function (msgId, mode) {
    try {
        const response = await fetch(`/messages/${msgId}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ mode })
        });

        if (response.ok) {
            const msgElement = document.getElementById(`msg-${msgId}`);
            if (msgElement) msgElement.remove();

            if (mode === "TODOS" && socket) {
                socket.emit("deleteMessage", { id: msgId, clienteId: clienteSelecionadoId });
            }
            showToast(`Mensagem apagada ${mode === "TODOS" ? "para todos" : "para você"}`, "success");
        } else {
            showToast("Falha ao apagar mensagem", "error");
        }
    } catch (error) {
        console.error("Erro ao deletar:", error);
        showToast("Erro ao apagar mensagem", "error");
    }
};

// --- RENDERIZAÇÃO ---
function renderAdminMessage(content, senderType, timestamp, msgId, isRead = false) {
    const div = document.createElement("div");
    div.className = `message ${senderType === "ADMIN" ? "user" : "support"}`;
    div.id = `msg-${msgId}`;

    const time = new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const isImage = content.includes("/uploads/") || content.match(/\.(jpeg|jpg|gif|png|webp)$/i);

    let htmlContent = isImage
        ? `<img src="${content}" class="chat-image" onclick="window.open('${content}')" alt="Imagem do chat">`
        : `<span>${content}</span>`;

    // Status de leitura (apenas para mensagens do admin)
    const readStatus = senderType === "ADMIN" ? `<span class="read-status" style="font-size:10px; opacity:0.7; margin-left:5px;">${isRead ? "✓✓" : "✓"}</span>` : "";

    const isMyMessage = senderType === "ADMIN";

    div.innerHTML = `
        ${htmlContent}
        <br><small style="font-size:10px; opacity:0.6">${time}${readStatus}</small>
        <!-- Ícone para desktop (seta) -->
        <span class="menu-icon" onclick="openAdminOptionsModal('${msgId}', ${isMyMessage})">⌄</span>
    `;

    // --- LÓGICA DE LONG PRESS (MOBILE) ---
    let pressTimer;

    div.addEventListener("touchstart", (e) => {
        if (e.target.tagName === "IMG" || e.target.tagName === "A") return;

        // Feedback visual
        div.style.transform = "scale(0.98)";

        pressTimer = setTimeout(() => {
            // Vibração
            if (navigator.vibrate) navigator.vibrate(50);
            div.style.transform = "scale(1)";
            openAdminOptionsModal(msgId, isMyMessage);
        }, 800);
    });

    div.addEventListener("touchend", () => {
        clearTimeout(pressTimer);
        div.style.transform = "scale(1)";
    });

    div.addEventListener("touchmove", () => {
        clearTimeout(pressTimer);
        div.style.transform = "scale(1)";
    });

    adminMessages.appendChild(div);
    adminMessages.scrollTop = adminMessages.scrollHeight;
}

// --- LOGICA DE CLIENTES E MENSAGENS ---
async function carregarListaClientes() {
    try {
        const response = await fetch("/clientes", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const clientes = await response.json();

            // Salva todos os clientes
            allClients = clientes;

            console.log(`📋 Total de clientes: ${allClients.length}`);

            // Busca contador de não lidas
            const unreadResponse = await fetch("/messages/unread/count", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const unreadData = unreadResponse.ok ? await unreadResponse.json() : { unreadByClient: [] };

            clientListDiv.innerHTML = "";

            clientes.forEach(cliente => {
                const item = document.createElement("div");
                item.id = `user-item-${cliente.id}`;
                item.className = "client-item-sidebar";

                // Contador de não lidas
                const unreadInfo = unreadData.unreadByClient.find(u => u.clienteId === cliente.id);
                const unreadCount = unreadInfo ? unreadInfo.count : 0;
                const unreadBadge = unreadCount > 0 ? `<span class="unread-badge" style="background:#ff3d00; color:#fff; border-radius:50%; padding:2px 6px; font-size:10px; font-weight:bold; margin-left:8px;">${unreadCount}</span>` : "";

                item.innerHTML = `
                    <div class="client-info-name" style="font-weight: bold; color: #263238;">👤 ${cliente.name || cliente.email.split("@")[0]}${unreadBadge}</div>
                    <div class="client-info-email" style="font-size: 0.8em; color: #546e7a;">${cliente.email}</div>
                    <span class="notification-dot" id="dot-${cliente.id}" style="${unreadCount > 0 ? "display:block" : "display:none"}"></span>
                `;

                item.onclick = () => {
                    clienteSelecionadoId = cliente.id;
                    item.classList.remove("unreads-highlight");
                    const dot = document.getElementById(`dot-${cliente.id}`);
                    if (dot) dot.style.display = "none";

                    // Remove badge
                    const badge = item.querySelector(".unread-badge");
                    if (badge) badge.remove();

                    document.querySelectorAll(".client-item-sidebar").forEach(d => d.classList.remove("active-chat"));
                    item.classList.add("active-chat");

                    // Mostra o painel de conversas (estilo WhatsApp)
                    const adminMain = document.querySelector(".admin-main");
                    if (adminMain) adminMain.classList.add("show-chat");

                    carregarMensagens(cliente.id);
                };

                clientListDiv.appendChild(item);
            });
        }
    } catch (error) { console.error("Erro lista:", error); }
}


async function carregarMensagens(clienteId) {
    if (!clienteId) return;
    try {
        const response = await fetch(`/messages/${clienteId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
            const mensagens = await response.json();
            adminMessages.innerHTML = "";

            // IDs de mensagens não lidas do cliente
            const unreadClientMessages = [];

            mensagens.forEach(msg => {
                const tipo = msg.senderType || (Number(msg.usuarioId) === Number(clienteId) ? "CLIENTE" : "ADMIN");
                renderAdminMessage(msg.content, tipo, msg.createdAt, msg.id, msg.isRead);

                // Coleta mensagens não lidas do cliente
                if (msg.senderType === "CLIENTE" && !msg.isRead) {
                    unreadClientMessages.push(msg.id);
                }
            });

            // Marca mensagens do cliente como lidas ao abrir conversa
            if (unreadClientMessages.length > 0) {
                marcarComoLida(unreadClientMessages);
            }
        }
    } catch (error) { console.error(error); }
}

// --- LOGICA DE UPLOAD (USANDO imageInputAdmin) ---
if (attachBtnAdmin && imageInputAdmin) {
    attachBtnAdmin.onclick = () => {
        if (clienteSelecionadoId) {
            imageInputAdmin.click();
        } else {
            showToast("Selecione um cliente primeiro!", "error");
        }
    };

    imageInputAdmin.onchange = async (e) => {
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

            if (res.ok) {
                const data = await res.json();
                // Envia a URL da imagem como uma mensagem
                const response = await fetch("/messages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({ content: data.url, clienteId: Number(clienteSelecionadoId) })
                });
                if (response.ok) {
                    imageInputAdmin.value = ""; // Limpa o input
                }
            }
        } catch (err) {
            console.error("Erro no upload:", err);
        }
    };
}

// --- SOCKETS ---  
function inicializarSocket() {
    if (typeof window.io !== "undefined") {
        socket = window.io(window.location.origin, {
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000
        });

        socket.on("connect", () => {
            console.log("🟢 Admin conectado!");
            // Obtém o ID do admin e entra na sala  
            obterAdminId().then(id => {
                if (id) {
                    adminUserId = id;
                    socket.emit("join", { userId: adminUserId, isAdmin: true });
                }
            });
        });

        socket.on("newMessage", (msg) => {
            const idConversa = String(msg.senderType === "ADMIN" ? msg.clienteId : (msg.usuarioId || msg.clienteId));
            const itemCliente = document.getElementById(`user-item-${idConversa}`);

            if (msg.senderType !== "ADMIN") {
                notificationSound.play().catch(() => { });

                // Se o cliente não estiver na lista (novo cliente), atualiza tudo
                if (!itemCliente) {
                    console.log(`🆕 Novo cliente detectado (${idConversa}). Atualizando lista...`);
                    carregarListaClientes(); // Recarrega a lista do servidor
                    return; // Interrompe para não duplicar a lógica de UI
                }

                if (itemCliente) {
                    clientListDiv.prepend(itemCliente);
                    if (String(clienteSelecionadoId) !== idConversa) {
                        itemCliente.classList.add("unreads-highlight");
                        const dot = document.getElementById(`dot-${idConversa}`);
                        if (dot) dot.style.display = "block";

                        // Atualiza ou cria badge de não lidas  
                        let badge = itemCliente.querySelector(".unread-badge");
                        if (badge) {
                            badge.textContent = (parseInt(badge.textContent) + 1).toString();
                        } else {
                            const nameDiv = itemCliente.querySelector(".client-info-name");
                            badge = document.createElement("span");
                            badge.className = "unread-badge";
                            badge.style.cssText = "background:#ff3d00; color:#fff; border-radius:50%; padding:2px 6px; font-size:10px; font-weight:bold; margin-left:8px;";
                            badge.textContent = "1";
                            nameDiv.appendChild(badge);
                        }
                    } else {
                        // Marca como lida automaticamente se estiver vendo a conversa  
                        marcarComoLida([msg.id]);
                    }
                }
            }

            if (clienteSelecionadoId && String(clienteSelecionadoId) === idConversa) {
                renderAdminMessage(msg.content, msg.senderType, msg.createdAt, msg.id, msg.isRead);
            }
        });

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

        socket.on("messageDeleted", (data) => {
            const msgElement = document.getElementById(`msg-${data.id}`);
            if (msgElement) msgElement.remove();
        });

        socket.on("displayTyping", (data) => {
            if (clienteSelecionadoId && String(data.clienteId) === String(clienteSelecionadoId) && data.senderType === "CLIENTE") {
                if (typingStatusAdmin) typingStatusAdmin.innerText = data.isTyping ? "O cliente está escrevendo..." : "";
            }
        });
    }
}

// Função para obter o ID do admin
async function obterAdminId() {
    try {
        const response = await fetch("/messages/me", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
            const mensagens = await response.json();
            if (mensagens.length > 0) {
                return mensagens[0].usuarioId;
            }
        }
    } catch (error) {
        console.error("Erro ao obter ID do admin:", error);
    }
    return null;
}

// --- EVENTOS DE ENVIO ---
async function enviarMensagemAdmin() {
    const conteudo = adminReply.value.trim();
    const isBroadcast = broadcastModeCheckbox.checked;

    // Se não está em modo broadcast, precisa ter cliente selecionado
    if (!conteudo || (!isBroadcast && !clienteSelecionadoId)) {
        if (!isBroadcast && !clienteSelecionadoId) {
            showToast("Selecione um cliente ou ative o modo broadcast", "error");
        }
        return;
    }

    try {
        if (isBroadcast) {
            // Modo BROADCAST - Usa endpoint específico que não salva para o admin
            const response = await fetch("/messages/broadcast", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ content: conteudo })
            });

            if (response.ok) {
                const data = await response.json();
                adminReply.value = "";
                showToast(`📢 Mensagem enviada para ${data.count} cliente(s)`, "success");
            } else {
                const error = await response.json();
                showToast(error.error || "Erro ao enviar broadcast", "error");
            }
        } else {
            // Modo NORMAL - Envia apenas para o cliente selecionado
            const response = await fetch("/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    content: conteudo,
                    clienteId: Number(clienteSelecionadoId)
                })
            });

            if (response.ok) {
                adminReply.value = "";
                socket.emit("typing", {
                    clienteId: clienteSelecionadoId,
                    senderType: "ADMIN",
                    isTyping: false
                });
            }
        }
    } catch (error) {
        console.error(error);
        showToast("Erro ao enviar mensagem", "error");
    }
}

adminReply.oninput = () => {
    if (!clienteSelecionadoId || !socket) return;
    socket.emit("typing", { clienteId: clienteSelecionadoId, senderType: "ADMIN", isTyping: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit("typing", { clienteId: clienteSelecionadoId, senderType: "ADMIN", isTyping: false });
    }, 2000);
};

sendBtn.onclick = enviarMensagemAdmin;
adminReply.onkeypress = (e) => { if (e.key === "Enter") enviarMensagemAdmin(); };

// Função para marcar mensagens como lidas
async function marcarComoLida(messageIds) {
    if (!token || !messageIds || messageIds.length === 0) return;
    try {
        await fetch("/messages/mark-read", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ messageIds })
        });
    } catch (error) {
        console.error("Erro ao marcar como lida:", error);
    }
}

// --- INICIALIZAÇÃO ---
document.addEventListener("DOMContentLoaded", () => {
    carregarListaClientes();
    inicializarSocket();
});

// Busca de clientes
if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        const termo = e.target.value.toLowerCase();
        const cards = document.querySelectorAll(".client-item-sidebar");
        cards.forEach(card => {
            const texto = card.innerText.toLowerCase();
            card.style.display = texto.includes(termo) ? "block" : "none";
        });
    });
}

// Função para inserir emoji no input do admin
function insertEmojiAdmin(emoji) {
    const input = document.getElementById("adminReply");
    if (input) {
        const cursorPos = input.selectionStart;
        const textBefore = input.value.substring(0, cursorPos);
        const textAfter = input.value.substring(cursorPos);
        input.value = textBefore + emoji + textAfter;
        input.focus();
        input.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    }
}

// Função para mostrar/esconder o picker de emojis (global para acesso via onclick)
window.toggleEmojiPicker = function (type) {
    const emojiBar = document.getElementById(`emoji-bar-${type}`);
    if (emojiBar) {
        if (emojiBar.style.display === "none" || !emojiBar.style.display) {
            emojiBar.style.display = "flex";
        } else {
            emojiBar.style.display = "none";
        }
    }
};

// Fecha o emoji picker ao clicar fora
document.addEventListener("click", function (event) {
    const emojiBar = document.getElementById("emoji-bar-admin");
    const emojiBtn = document.querySelector(".emoji-toggle-btn");

    if (emojiBar && emojiBtn && !emojiBar.contains(event.target) && event.target !== emojiBtn) {
        emojiBar.style.display = "none";
    }
});

// Botão de voltar para lista de clientes (mobile - estilo WhatsApp)
const backBtn = document.getElementById("back-to-list-btn");
if (backBtn) {
    backBtn.onclick = () => {
        const adminMain = document.querySelector(".admin-main");
        if (adminMain) adminMain.classList.remove("show-chat");
        clienteSelecionadoId = null;
    };
}

// Listener para o toggle de broadcast
if (broadcastModeCheckbox) {
    broadcastModeCheckbox.addEventListener("change", (e) => {
        if (e.target.checked) {
            broadcastHint.style.display = "block";
            showToast("📢 Modo Broadcast ativado: mensagem será enviada para TODOS", "info");
        } else {
            broadcastHint.style.display = "none";
        }
    });
}

// Botão de logout
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
    logoutBtn.onclick = () => {
        if (confirm("Deseja realmente sair?")) {
            localStorage.removeItem("token");
            window.location.href = "admin-login.html";
        }
    };
}
