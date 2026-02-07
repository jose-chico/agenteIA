export function resetPasswordTemplate(link: string, nome?: string) {
  const saudacao = nome ? `Olá, <strong>${nome}</strong>!` : "Olá!";

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color:#059669; text-align: center;">Redefinição de Senha</h2>
      <p style="font-size: 1.1rem;">${saudacao}</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Chat System</strong>.</p>
      <p style="margin-bottom: 25px;">
        Para prosseguir com a alteração, clique no botão abaixo:
      </p>
      <div style="text-align:center; margin-bottom: 30px;">
        <a href="${link}" 
          style="display:inline-block; padding:14px 30px; background-color:#10b981;
          color:#ffffff; text-decoration:none; border-radius:6px; font-weight:bold; font-size: 1rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          Redefinir Minha Senha
        </a>
      </div>
      <p style="color: #4b5563;">Ou copie e cole este link no seu navegador:</p>
      <p style="word-break:break-all; background-color: #f3f4f6; padding: 10px; border-radius: 4px;">
        <a href="${link}" style="color:#059669; text-decoration: none; font-size: 0.85rem;">${link}</a>
      </p>
      <p style="font-size:0.85rem; color:#6b7280; margin-top:20px; background-color: #fef2f2; padding: 10px; border-radius: 4px; border-left: 4px solid #ef4444;">
        ⚠️ Este link é válido por apenas <strong>1 hora</strong>. Após esse período, será necessário solicitar um novo.
      </p>
      <hr style="border:none; border-top:1px solid #e5e7eb; margin:30px 0;">
      <p style="font-size:0.75rem; color:#9ca3af; text-align:center;">
        Se você não solicitou esta alteração, pode ignorar este e-mail com segurança. Sua senha atual permanecerá a mesma.
      </p>
    </div>
  `;
}