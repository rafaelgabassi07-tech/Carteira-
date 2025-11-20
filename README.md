# Carteira de Investimentos (FIIs)

## Deploy na Vercel

Este projeto está configurado para ser implantado na Vercel utilizando o preset de framework "Vite".

### Configuração Essencial: Variáveis de Ambiente

Para que o aplicativo funcione corretamente, é **essencial** configurar duas variáveis de ambiente no seu projeto na Vercel.

#### 1. Chave da API do Google Gemini

Utilizada para buscar notícias e dados fundamentalistas dos ativos.

-   **Name (Nome)**: `API_KEY`
-   **Value (Valor)**: `SUA_CHAVE_DE_API_DO_GEMINI`

#### 2. Token da API da Brapi

Utilizado para buscar as cotações em tempo real dos ativos de forma rápida e precisa.

-   **Name (Nome)**: `BRAPI_TOKEN`
-   **Value (Valor)**: `SEU_TOKEN_DA_BRAPI_API`

**Como configurar:**

1.  Acesse o painel do seu projeto na Vercel.
2.  Vá para a aba **Settings**.
3.  No menu lateral, clique em **Environment Variables**.
4.  Crie as duas variáveis conforme descrito acima.
5.  Certifique-se de que as variáveis estejam disponíveis para todos os ambientes (Production, Preview, e Development).
6.  Salve as variáveis. A Vercel iniciará um novo deploy automaticamente para aplicar as alterações.

O código da aplicação já está preparado para utilizar estas variáveis. Após configurá-las, sua aplicação funcionará perfeitamente.