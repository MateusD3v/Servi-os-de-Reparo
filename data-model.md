# Modelo Extraído da Planilha

## Configurações

- moeda: `R$`
- métodos de pagamento:
  - `Débito`
  - `Pix`
  - `Boleto`
  - `Dinheiro`
  - `Crédito 1`
  - `Crédito 2`
  - `Crédito 3`
  - `Crédito 4`
  - `Crédito 5`
  - `Crédito 6`
- categorias padrão identificadas:
  - `Contas`
  - `Saúde`
  - `Lazer`
  - `Transporte`
  - `Vestuário`
  - `Despesas eventuais`
  - `Ifood`
  - `Mercado`
  - `Assinaturas`
  - `Academia`
  - `Presentes`
  - `Desenvolvimento`

## Módulos mensais

Cada mês na planilha contém:

- calendário
- saldo do mês
- total de entradas
- total de saídas
- gastos fixos
- investimentos
- metas
- resumo por forma de pagamento
- resumo por categoria

## Entidades do sistema

### Entrada

- descrição
- data
- valor

### Gasto fixo

- nome
- data
- categoria
- pagamento
- valor

### Saída

- descrição
- data
- categoria
- pagamento
- valor

### Meta

- nome
- valor alvo
- valor acumulado

### Investimento

- meta relacionada
- mês
- valor

## Indicadores calculados

- entradas por mês
- saídas por mês
- saldo por mês
- saídas por categoria
- saídas por forma de pagamento
- total investido no ano
- categoria com maior gasto
- mês com maior gasto
- mês com menor gasto
