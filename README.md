# Carteira de Investimentos (FIIs)

## Deploy na Vercel

Este projeto está configurado para ser implantado na Vercel utilizando o preset de framework "Vite".

### Configuração Essencial: Variáveis de Ambiente

Para que o aplicativo funcione corretamente, é **essencial** configurar duas variáveis de ambiente no seu projeto na Vercel. O prefixo `VITE_` é **obrigatório** para que o Vite exponha estas variáveis de forma segura para a aplicação no navegador.

#### 1. Chave da API do Google Gemini

Utilizada para buscar notícias e dados fundamentalistas dos ativos.

-   **Name (Nome)**: `VITE_API_KEY`
-   **Value (Valor)**: `SUA_CHAVE_DE_API_DO_GEMINI`

#### 2. Token da API da Brapi

Utilizado para buscar as cotações em tempo real dos ativos de forma rápida e precisa.

-   **Name (Nome)**: `VITE_BRAPI_TOKEN`
-   **Value (Valor)**: `SEU_TOKEN_DA_BRAPI_API`

**Como configurar:**

1.  Acesse o painel do seu projeto na Vercel.
2.  Vá para a aba **Settings**.
3.  No menu lateral, clique em **Environment Variables**.
4.  Crie as duas variáveis conforme descrito acima, garantindo que o nome (`Name`) esteja **exatamente** como especificado (incluindo o prefixo `VITE_`).
5.  Certifique-se de que as variáveis estejam disponíveis para todos os ambientes (Production, Preview, e Development).
6.  Salve as variáveis. A Vercel iniciará um novo deploy automaticamente para aplicar as alterações.

### Solução de Problemas (Troubleshooting)

Se você encontrar erros como "Token não configurado" ou "Cannot read properties of undefined", siga estes passos para verificar:

1.  **Confirme o Preset do Framework:** No painel do seu projeto Vercel, em **Settings > General**, certifique-se de que o **Framework Preset** está definido como **Vite**.
2.  **Verifique os Nomes das Variáveis:** Em **Settings > Environment Variables**, confirme se os nomes estão **exatamente** como `VITE_API_KEY` e `VITE_BRAPI_TOKEN`.
    *   ✅ **Correto:** `VITE_API_KEY`
    *   ❌ **Incorreto:** `API_KEY`, `vite_api_key`, `VITE_API_KEY ` (com espaço no final).
3.  **Redeploy:** Após confirmar os nomes, acione um novo deploy para garantir que as variáveis sejam aplicadas. Vá para a aba **Deployments**, clique no último deploy, e no menu "..." escolha **Redeploy**.