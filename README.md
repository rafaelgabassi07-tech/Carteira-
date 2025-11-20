# Carteira de Investimentos (FIIs)

## Deploy na Vercel

Este projeto está configurado para ser implantado na Vercel utilizando o preset de framework "Vite".

### Configuração Essencial: Variáveis de Ambiente

Para que o aplicativo funcione corretamente, é **essencial** configurar as variáveis de ambiente no seu projeto na Vercel.

**Método Recomendado (Padrão Vite):**

-   **Name (Nome)**: `VITE_API_KEY`
-   **Value (Valor)**: `SUA_CHAVE_DE_API_DO_GEMINI`
<br/>
-   **Name (Nome)**: `VITE_BRAPI_TOKEN`
-   **Value (Valor)**: `SEU_TOKEN_DA_BRAPI_API`

**Importante:** O prefixo `VITE_` é o método padrão e recomendado para que o Vite exponha estas variáveis de forma segura para a aplicação no navegador.

**Método Alternativo (Fallback):**

Para garantir a máxima compatibilidade, o aplicativo também tentará ler as variáveis sem o prefixo `VITE_`. Use esta opção se a primeira não funcionar.

-   **Name (Nome)**: `API_KEY`
-   **Value (Valor)**: `SUA_CHAVE_DE_API_DO_GEMINI`
<br/>
-   **Name (Nome)**: `BRAPI_TOKEN`
-   **Value (Valor)**: `SEU_TOKEN_DA_BRAPI_API`


**Como configurar:**

1.  Acesse o painel do seu projeto na Vercel.
2.  Vá para a aba **Settings**.
3.  No menu lateral, clique em **Environment Variables**.
4.  Crie as duas variáveis utilizando um dos métodos acima.
5.  Salve as variáveis. A Vercel iniciará um novo deploy automaticamente para aplicar as alterações.