# Sistema Financeiro Baseado em Planilha

Este projeto transforma uma planilha de controle financeiro em um sistema web local com painel visual, organizacao mensal, login por usuario e sincronizacao com Supabase.

## Estrutura do projeto

- `index.html`, `styles.css` e `client.js`: interface do painel financeiro.
- `server.js`: ponto de entrada do servidor local.
- `request-handler.js`: fachada HTTP compartilhada pelo servidor local e pelas rotas da Vercel.
- `src/server/config.js`: leitura de ambiente e configuracoes centrais.
- `src/server/http.js`: helpers de resposta, headers de seguranca e leitura de payload.
- `src/server/api-router.js`: roteamento das APIs de auth, saude e estado remoto.
- `src/server/supabase.js`: comunicacao com Supabase Auth e REST.
- `src/server/static-files.js`: entrega segura de arquivos publicos.
- `api/`: adaptadores pequenos usados em deploy serverless.

## O que o sistema cobre

- configuracao inicial do controle
- entradas mensais
- gastos fixos
- saidas por categoria e forma de pagamento
- metas e investimentos
- comparativo anual
- login com Supabase Auth
- dados financeiros separados por usuario

## Estrutura usada como referencia

Abas identificadas na planilha original:

- `Comece aqui`
- `Comparativo anual`
- `Investimentos`
- 12 abas mensais

A aplicacao foi inspirada principalmente na organizacao desses blocos e na logica de consolidacao mensal e anual.

## Como rodar

### Modo local

Rode `node server.js` e abra `http://localhost:3010`.

O login usa o Supabase Auth e cada usuario carrega apenas o proprio estado financeiro.

### Modo online com GitHub Pages

O repositório pode publicar automaticamente a interface estatica pelo GitHub Pages.

Nesse modo:

- o painel abre online normalmente
- os dados continuam funcionando no navegador via `localStorage`
- a sincronizacao com Supabase fica reservada para a execucao local com `node server.js`

### Modo com Supabase

1. Crie a tabela usando `supabase-schema.sql`
2. No painel do Supabase, habilite Auth por email/senha
3. Copie `.env.example` para `.env.local`
4. Preencha `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`
5. Rode `node server.js`
6. Abra `http://localhost:3010`

O navegador nunca recebe a `SERVICE_ROLE`. Ela fica somente no servidor, que valida o token do usuario e grava os dados na chave `user:<id-do-usuario>`.

## Recursos principais

- painel com calendario financeiro
- visao consolidada do mes
- abas para configuracao, entradas, gastos fixos, saidas, investimentos e anual
- resumo por categoria e forma de pagamento
- metas com acompanhamento de progresso
- login e cadastro por email/senha
- salvamento automatico por usuario no Supabase

## Observacao

A planilha analisada estava essencialmente como modelo. Por isso, o sistema foi construido com base na estrutura e nas regras da planilha, e nao em um historico financeiro preenchido.
