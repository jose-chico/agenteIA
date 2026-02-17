// Menu Hamburger Mobile
const hamburger = document.getElementById("hamburger");

if (hamburger) {
    const navLinks = document.getElementById("navLinks");
    
    hamburger.addEventListener("click", function() {
        hamburger.classList.toggle("active");
        navLinks?.classList.toggle("active");
    });

    // Fechar menu ao clicar em um link
    navLinks?.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", function() {
            hamburger.classList.remove("active");
            navLinks?.classList.remove("active");
        });
    });
}

// Botões de Logar e Cadastrar: agora são links externos, nenhum handler necessário

// Aviso breve antes do redirecionamento para páginas de login/cadastro
function showRedirectNotice(href) {
    const toast = document.createElement("div");
    toast.className = "redirect-toast";
    toast.textContent = "Você será redirecionado...";
    document.body.appendChild(toast);
    // trigger animation
    requestAnimationFrame(() => toast.classList.add("visible"));

    // Redirecionar após breve atraso para exibir o aviso
    setTimeout(() => {
        window.location.href = href;
    }, 900);

    // Remover o toast após redirecionamento (caso o redirecionamento seja interrompido)
    setTimeout(() => {
        toast.classList.remove("visible");
        setTimeout(() => toast.remove(), 300);
    }, 1600);
}

document.querySelectorAll(".auth-buttons a").forEach(link => {
    link.addEventListener("click", function(e) {
        e.preventDefault();
        showRedirectNotice(this.href);
    });
});

// Side chat panel: lazy-load iframe when opening, toggle open/close
const toggleChatBtn = document.getElementById("toggleChatBtn");
const closeChatBtn = document.getElementById("closeChatBtn");
const sideChat = document.getElementById("sideChat");
const embeddedChat = document.getElementById("embeddedChat");
const chatLoader = document.getElementById("chatLoader");
const chatBlocked = document.getElementById("chatBlocked");

// Login/Signup buttons open side panel with login/signup routes
const loginChatBtn = document.getElementById("loginChatBtn");
const signupChatBtn = document.getElementById("signupChatBtn");

function openSideChat(route = "/chat") {
    if (!sideChat) return;
    sideChat.classList.remove("closed");
    sideChat.classList.add("open");
    sideChat.setAttribute("aria-hidden", "false");

    // Reset and reload iframe with specified route
    if (embeddedChat) {
        embeddedChat.src = ""; // Reset iframe
        setTimeout(() => {
            embeddedChat.src = route;
            chatLoader.hidden = false;
            chatBlocked.hidden = true;

            const loadTimeout = setTimeout(() => {
                chatLoader.hidden = true;
                chatBlocked.hidden = false;
            }, 8000);

            embeddedChat.onload = () => {
                clearTimeout(loadTimeout);
                chatLoader.hidden = true;
                chatBlocked.hidden = true;
            };
        }, 100);
    }
}

function closeSideChat() {
    if (!sideChat) return;
    sideChat.classList.remove("open");
    sideChat.classList.add("closed");
    sideChat.setAttribute("aria-hidden", "true");
}

if (toggleChatBtn) toggleChatBtn.addEventListener("click", () => openSideChat("../index.html"));
if (closeChatBtn) closeChatBtn.addEventListener("click", closeSideChat);

// Login/Signup buttons open side panel with their respective routes
if (loginChatBtn) loginChatBtn.addEventListener("click", () => openSideChat("../login.html"));
if (signupChatBtn) signupChatBtn.addEventListener("click", () => openSideChat("../cadastro.html"));

// Close on Escape
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSideChat();
});

// Monitor iframe for successful redirect to chat (auto-reload after login)
if (embeddedChat) {
    let lastPath = "";
    setInterval(() => {
        try {
            const iframePath = embeddedChat.contentWindow.location.pathname;
            if (iframePath && iframePath !== lastPath) {
                lastPath = iframePath;
                // Se o iframe redirecionou para /index ou / (após login bem-sucedido)
                if ((iframePath === "/index.html" || iframePath === "/") && embeddedChat.src.includes("login.html")) {
                    console.log("Login detected, reloading to chat");
                    embeddedChat.src = "../index.html";
                }
            }
        } catch (e) {
            // Same-origin: conseguimos acessar contentWindow agora, mas ainda safe
        }
    }, 1000);
}

// Botões CTA de Contato
const ctaButtons = document.querySelectorAll(".cta-buttons .btn");

ctaButtons.forEach(button => {
    button.addEventListener("click", function() {
        if (this.textContent.includes("Ativar")) {
            alert("Você será redirecionado para ativar o Falcon AI...");
            // window.location.href = 'activate.html';
        } else if (this.textContent.includes("Demo")) {
            alert("Abrindo agendamento de demo gratuita...");
            // window.location.href = 'demo.html';
        }
    });
});

// Smooth Scroll para navegação
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
        e.preventDefault();
        
        const target = document.querySelector(this.getAttribute("href"));
        if (target) {
            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
});

// Formulário de Contato (Removido - Seção simplificada)
// const contactForm = document.querySelector('.contact-form');
// if (contactForm) {
//     contactForm.addEventListener('submit', function(e) {
//         e.preventDefault();
//         alert('Obrigado pelas suas informações! Entraremos em contato em breve.');
//         this.reset();
//     });
// }

// Botão Hero
const heroButton = document.querySelector(".hero .btn");
if (heroButton) {
    heroButton.addEventListener("click", function() {
        const aboutSection = document.getElementById("sobre");
        if (aboutSection) {
            aboutSection.scrollIntoView({ behavior: "smooth" });
        }
    });
}

// Menu mobile responsivo (opcional)
// Adicione esta função se quiser um menu hamburger para mobile
function handleMobileMenu() {
    const navLinks = document.querySelector(".nav-links");
    
    // Aqui você pode adicionar lógica para mostrar/esconder menu em telas pequenas
    if (window.innerWidth <= 768) {
        // Adicione código para menu mobile
    }
}


window.addEventListener("resize", handleMobileMenu);
handleMobileMenu();

// Log de carregamento
console.log("Página carregada com sucesso!");
