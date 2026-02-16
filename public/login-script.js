document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const errorMsg = document.getElementById("error-msg");

    if (!loginForm) return;

    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const usernameEl = document.getElementById("username"); 
        const passEl = document.getElementById("password");
        const btn = document.getElementById("login-btn");

        const email = usernameEl.value.trim();
        const password = passEl.value;

        if (errorMsg) errorMsg.innerText = "";

        btn.disabled = true;
        btn.innerText = "Verificando...";

        try {
            const response = await fetch("https://agenteia-22ds.onrender.com/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

           // ... dentro do seu if (response.ok)
if (response.ok) {
    // 1. Armazena as credenciais com nomes simples
    localStorage.setItem("token", data.token); // Removido o @ChatSystem:
    localStorage.setItem("user", JSON.stringify(data.user));

    console.log("Login realizado! Redirecionando...");

    // 2. Redirecionamento
    window.location.replace("index.html"); 
}else {
                const mensagem = data.error || "E-mail ou senha incorretos.";
                if (errorMsg) errorMsg.innerText = mensagem;
                else alert(mensagem);
            }
        } catch (error) {
            console.error("Erro na requisição:", error);
            const erroConexao = "Não foi possível conectar ao servidor na porta 8000.";
            if (errorMsg) errorMsg.innerText = erroConexao;
            else alert(erroConexao);
        } finally {
            btn.disabled = false;
            btn.innerText = "Entrar no Chat";
        }
    });
});
