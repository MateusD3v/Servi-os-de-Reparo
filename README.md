# Sistema Financeiro Baseado em Planilha

Este projeto transforma uma planilha de controle financeiro em um sistema web local com painel visual, organizacao mensal e sincronizacao opcional com Supabase.

## O que o sistema cobre

- configuracao inicial do controle
- entradas mensais
- gastos fixos
- saidas por categoria e forma de pagamento
- metas e investimentos
- comparativo anual
- sincronizacao remota com Supabase

## Estrutura usada como referencia

Abas identificadas na planilha original:

- `Comece aqui`
- `Comparativo anual`
- `Investimentos`
- 12 abas mensais

A aplicacao foi inspirada principalmente na organizacao desses blocos e na logica de consolidacao mensal e anual.

## Como rodar

### Modo local

Abra `index.html` no navegador.

Os dados ficam salvos no `localStorage` da maquina.

### Modo online com GitHub Pages

O repositório pode publicar automaticamente a interface estatica pelo GitHub Pages.

Nesse modo:

- o painel abre online normalmente
- os dados continuam funcionando no navegador via `localStorage`
- a sincronizacao com Supabase fica reservada para a execucao local com `node server.js`

### Modo com Supabase

1. Crie a tabela usando `supabase-schema.sql`
2. Copie `.env.example` para `.env.local`
3. Preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
4. Rode `node server.js`
5. Abra `http://localhost:3010`

## Recursos principais

- painel com calendario financeiro
- visao consolidada do mes
- abas para configuracao, entradas, gastos fixos, saidas, investimentos e anual
- resumo por categoria e forma de pagamento
- metas com acompanhamento de progresso
- auto sync opcional com perfil remoto no Supabase

## Observacao

A planilha analisada estava essencialmente como modelo. Por isso, o sistema foi construido com base na estrutura e nas regras da planilha, e nao em um historico financeiro preenchido.
