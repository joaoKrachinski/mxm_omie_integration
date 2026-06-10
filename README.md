# Integração MXM × Omie + Baixa Automática

Monorepo com três Cloud Run Services responsáveis por sincronizar títulos a pagar entre MXM, Omie e Jira.

## Serviços

| Serviço | Porta local | Responsabilidade |
|---|---|---|
| `mxm-omie-sync-service` | 3001 | Sincroniza títulos do MXM para o Omie |
| `jira-payment-orchestrator-service` | 3002 | Recebe automações do Jira e valida/atualiza títulos |
| `omie-payment-settlement-service` | 3003 | Recebe webhook do Omie e executa baixa no MXM |

## Estrutura

```
shared/           # Utilitários compartilhados (logger, http, errors, mongo, utils, types)
adapters/         # Stubs de integrações externas (mxm, omie, jira, slack, sheets)
services/
  mxm-omie-sync-service/src/
  jira-payment-orchestrator-service/src/
  omie-payment-settlement-service/src/
tests/
  fixtures/       # Payloads representativos
```

Cada serviço tem: `server.ts` → `routes.ts` → `handlers.ts` → `useCases.ts` → `repository.ts` / `adapters.ts`

## Pré-requisitos

- Node.js 22+
- MongoDB rodando localmente (`mongodb://localhost:27017`)

## Instalação

```bash
npm install
```

## Desenvolvimento local

```bash
# Copiar e preencher variáveis de cada serviço
cp services/mxm-omie-sync-service/.env.example services/mxm-omie-sync-service/.env
cp services/jira-payment-orchestrator-service/.env.example services/jira-payment-orchestrator-service/.env
cp services/omie-payment-settlement-service/.env.example services/omie-payment-settlement-service/.env

# Subir cada serviço (terminais separados)
npm run dev:sync
npm run dev:jira
npm run dev:settlement
```

## Comandos

```bash
npm test              # Rodar todos os testes
npm run typecheck     # Verificar tipos TypeScript
npm run build         # Compilar para dist/
npm run lint          # Lint + fix
```

## Índices MongoDB

Criar manualmente ou via função `setupIndexes`:

```js
db.payment_integrations.createIndex({ numero_documento: 1, cnpj_cpf: 1, valor: 1 }, { unique: true });
db.payment_integrations.createIndex({ omie_id: 1 });
db.payment_integrations.createIndex({ jira_id: 1 });
db.payment_integrations.createIndex({ status: 1 });
db.payment_integrations.createIndex({ vencimento: 1 });
```

## Coleção MongoDB

Única coleção: `payment_integrations`

Campos principais:

| Campo | Tipo | Descrição |
|---|---|---|
| `mxm_id` | string | ID no MXM (número do documento) |
| `omie_id` | string | Código do lançamento no Omie |
| `jira_id` | string | Issue key do Jira |
| `numero_documento` | string | Número do documento |
| `cnpj_cpf` | string | CNPJ/CPF sem formatação |
| `valor` | number | Valor em **centavos** (inteiro) |
| `status` | string | Status atual do fluxo |
| `data_criacao` | string | AAAA-MM-DD |
| `vencimento` | string | AAAA-MM-DD |

## Status do fluxo

```
criado_omie → criado_jira → aguardando_aprovacao → agendado_pagamento
                          → nota_nao_encontrada
                          → vencido
                          → cancelado
pago_omie → baixado_mxm
          → erro_baixa_mxm  (reprocessável)
```

## Deploy no Cloud Run

Cada serviço tem seu próprio `deploy.sh`. Executar a partir da **raiz do repositório**:

```bash
bash services/mxm-omie-sync-service/deploy.sh
bash services/jira-payment-orchestrator-service/deploy.sh
bash services/omie-payment-settlement-service/deploy.sh
```

Variáveis sensíveis devem ser configuradas como **Secrets** no Cloud Run (não como env vars plaintext).

## Cloud Scheduler

| Job | Endpoint | Frequência |
|---|---|---|
| Sync MXM → Omie | `POST /syncOmie` | A cada 24h |
| Reprocess Jira | `POST /jira/reprocess` | A cada 24h |
| Reconciliar pagamentos | `POST /reconcileOmiePayments` | Fim do dia |

## TODOs manuais obrigatórios

Todos os adapters em `adapters/` são stubs. A lógica real deve ser implementada manualmente:

- **`adapters/mxm.ts`**: `listarTituloPagar`, `consultarTituloMxm`, `baixarTituloMxm`
- **`adapters/omie.ts`**: `criarContaPagarOmie`, `consultarContaPagarOmie`, `alterarContaPagarOmie`, `listarContasPagarOmie`
- **`adapters/jira.ts`**: `buscarIssueJira`, `atualizarCampoJira`, `atualizarStatusJira`, `atualizarJiraComoPago`
- **`adapters/slack.ts`**: `enviarAlertaSlack`
- **`adapters/sheets.ts`**: `consultarPlanilha`

Nos `useCases.ts` de cada serviço há comentários `// TODO:` indicando onde descomentar as chamadas reais após implementar os adapters.

Autenticação do webhook Omie: implementar validação via `OMIE_WEBHOOK_TOKEN` em `omie-payment-settlement-service/src/useCases.ts`.
