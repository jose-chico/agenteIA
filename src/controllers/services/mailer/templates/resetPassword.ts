export function resetPasswordTemplate(link: string, nome?: string) {
  const saudacao = nome ? `Olá, <strong>${nome}</strong>!` : "Olá!";

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Redefinição de Senha</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">🔐 Redefinição de Senha</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="font-size: 16px; color: #333333; margin: 0 0 20px;">${saudacao}</p>
                  
                  <p style="font-size: 15px; color: #555555; line-height: 1.6; margin: 0 0 20px;">
                    Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Agente IA</strong>.
                  </p>
                  
                  <p style="font-size: 15px; color: #555555; line-height: 1.6; margin: 0 0 30px;">
                    Para criar uma nova senha, clique no botão abaixo:
                  </p>
                  
                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${link}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                          Redefinir Minha Senha
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Alternative Link -->
                  <p style="font-size: 13px; color: #6b7280; margin: 30px 0 10px;">Ou copie e cole este link no navegador:</p>
                  <p style="word-break: break-all; background-color: #f9fafb; padding: 15px; border-radius: 6px; border-left: 4px solid #667eea; margin: 0 0 30px;">
                    <a href="${link}" style="color: #667eea; text-decoration: none; font-size: 13px;">${link}</a>
                  </p>
                  
                  <!-- Warning -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="font-size: 14px; color: #991b1b; margin: 0; line-height: 1.5;">
                          ⚠️ <strong>Atenção:</strong> Este link é válido por <strong>1 hora</strong>. Após esse período, será necessário solicitar um novo.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 30px; border-top: 1px solid #e5e7eb; background-color: #f9fafb; border-radius: 0 0 12px 12px;">
                  <p style="font-size: 13px; color: #9ca3af; text-align: center; margin: 0; line-height: 1.5;">
                    Se você não solicitou esta alteração, ignore este email com segurança.<br>
                    Sua senha atual permanecerá inalterada.
                  </p>
                  <p style="font-size: 12px; color: #d1d5db; text-align: center; margin: 15px 0 0;">
                    © ${new Date().getFullYear()} Agente IA - Todos os direitos reservados
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}