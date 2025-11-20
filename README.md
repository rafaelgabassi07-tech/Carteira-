# Carteira de Investimentos (FIIs)

## Deploy na Vercel

Este projeto está configurado para ser implantado na Vercel utilizando o preset de framework "Vite".

### Configuração Essencial: Variáveis de Ambiente

Para que o aplicativo funcione corretamente, é **essencial** configurar as variáveis de ambiente no seu projeto na Vercel.

**Configuração Obrigatória:**

-   **Name (Nome)**: `VITE_API_KEY`
-   **Value (Valor)**: `SUA_CHAVE_DE_API_DO_GEMINI`
<br/>
-   **Name (Nome)**: `VITE_BRAPI_TOKEN`
-   **Value (Valor)**: `SEU_TOKEN_DA_BRAPI_API`

**Importante:** O prefixo `VITE_` é **obrigatório**. É o método padrão para que o Vite (a tecnologia de construção deste app) exponha estas variáveis de forma segura para a aplicação no navegador. Variáveis sem este prefixo não serão encontradas.

**Como configurar:**

1.  Acesse o painel do seu projeto na Vercel.
2.  Vá para a aba **Settings**.
3.  No menu lateral, clique em **Environment Variables**.
4.  Crie as duas variáveis utilizando os nomes exatos acima.
5.  Salve as variáveis. A Vercel iniciará um novo deploy automaticamente para aplicar as alterações.