document.addEventListener("DOMContentLoaded", () => {
    const cadastroForm = document.getElementById("cadastro-form");

    if (!cadastroForm) return;

    cadastroForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const nameEl = document.getElementById("new-username");
        const emailEl = document.getElementById("email");
        const phoneEl = document.getElementById("phone");
        const passEl = document.getElementById("new-password");
        const btn = document.getElementById("cadastro-btn");

        if (!nameEl || !emailEl || !passEl) {
            console.error("Erro: Campos do formulário não encontrados.");
            return;
        }

        const name = nameEl.value.trim();
        const email = emailEl.value.trim();
        const phone = phoneEl ? phoneEl.value.trim() : "";
        const password = passEl.value;

        if (name === "" || email === "" || password.length < 6) {
            alert("Preencha todos os campos. A senha deve ter no mínimo 6 caracteres.");
            return;
        }

        btn.disabled = true;
        btn.innerText = "Criando conta...";

        try {
            // URL ATUALIZADA PARA O BACKEND NA PORTA 8000
            const response = await fetch("https://agenteia-22ds.onrender.com/users", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    phone: phone,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert("Cadastro realizado com sucesso!");
                window.location.href = "login.html";
            } else {
                alert("Erro: " + (data.error || "Falha ao cadastrar"));
            }
        } catch (error) {
            console.error("Erro na requisição:", error);
            alert("Servidor offline ou erro de conexão. Verifique se o backend está rodando na porta 8000.");
        } finally {
            btn.disabled = false;
            btn.innerText = "Finalizar Cadastro";
        }
    });
});
