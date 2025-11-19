# Carteira de Investimentos (FIIs)

## Deploy na Vercel

Este projeto está configurado para ser implantado na Vercel utilizando o preset de framework "Vite", como mostrado na sua imagem.

### Configuração Essencial: Variável de Ambiente

Para que o aplicativo se conecte à API do Gemini e funcione corretamente online, é **essencial** configurar uma variável de ambiente no seu projeto na Vercel. Siga os passos abaixo:

1.  Acesse o painel do seu projeto na Vercel.
2.  Vá para a aba **Settings**.
3.  No menu lateral, clique em **Environment Variables**.
4.  Crie uma nova variável com os seguintes detalhes:
    -   **Name (Nome)**: `VITE_API_KEY`
    -   **Value (Valor)**: `SUA_CHAVE_DE_API_DO_GEMINI` (Cole sua chave de API real aqui)
    
    **Importante**: O prefixo `VITE_` é obrigatório. O sistema de build (Vite) só expõe variáveis com este prefixo para a aplicação, por motivos de segurança.

5.  Certifique-se de que a variável esteja disponível para todos os ambientes (Production, Preview, e Development).
6.  Salve a variável. A Vercel iniciará um novo deploy automaticamente para aplicar a alteração.

O código da aplicação já está preparado para utilizar esta variável `VITE_API_KEY`. Após configurar a variável na Vercel, sua aplicação funcionará perfeitamente.