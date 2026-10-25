# Fase 5: produto SaaS

## Objetivo

Um cliente cria uma organização, convida colegas, assina um plano, usa o app dentro da cota do plano e é avisado (e depois bloqueado) quando o plano vence.

## Decisões que precisam vir antes

Esta fase depende de decisões de negócio. As partes marcadas como **independente** podem ser feitas antes delas; as outras esperam.

| Decisão | Afeta | Opções |
|---|---|---|
| Modelo de cobrança | 5.2, 5.3 | por organização com número de membros; por usuário; por gerações no mês |
| Provedor de pagamento | 5.3 | Asaas (Pix e boleto, foco no Brasil), Stripe (cartão, internacional), Pagar.me |
| Período de teste | 5.2 | dias de teste e cota durante o teste |
| Nota fiscal | 5.3 | emissão pelo provedor ou por sistema à parte |
| Revisão jurídica | tudo | termos de uso com cobrança, política de reembolso, LGPD com dados de pagamento |

## Estado atual

- Tudo é por usuário: `projects.owner_id`, `users.ai`, cotas da Fase 2 por `owner_id`.
- Papéis só no sistema todo (`users.role` = `admin` ou `user`). Não existe papel dentro de um grupo.
- O BYOK (chave de IA por pessoa) já tira o custo de IA da conta do serviço. O plano cobra pelo uso da plataforma (geração de PDF, armazenamento, número de pessoas), não pelos tokens.

## Desenho

### 5.1 Organizações (independente; migração 13)

```sql
CREATE TABLE orgs (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE org_members (
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX org_members_user ON org_members (user_id);

CREATE TABLE org_invites (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  token_hash text NOT NULL,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz
);
CREATE INDEX org_invites_org ON org_invites (org_id);

ALTER TABLE projects ADD COLUMN org_id uuid REFERENCES orgs(id) ON DELETE SET NULL;
CREATE INDEX projects_org_updated ON projects (org_id, updated_at DESC) WHERE org_id IS NOT NULL;
```

Regras:

- Toda conta nova ganha uma organização pessoal (`Espaço de <nome>`) da qual é `owner`. Contas existentes ganham a sua numa migração de dados no mesmo PR.
- Projeto pessoal: `org_id` nulo, visível só para o dono (como hoje). Projeto compartilhado: `org_id` preenchido, visível a todos os membros; editável por `owner`, `admin` e pelo autor.
- `lib/projects.js`: `list`, `get`, `save` e `remove` recebem `{ userId, orgIds }`. O filtro passa de `owner_id = $1` para `(owner_id = $1 OR org_id = ANY($2))`. Os testes de isolamento atuais continuam valendo para projetos pessoais.
- Convite: token aleatório de 32 bytes, enviado por e-mail (fila da Fase 3), guardado como HMAC. Vale 7 dias. Aceitar exige estar logado com o mesmo e-mail do convite.
- Sempre sobra um `owner`: a mesma lógica de `activeAdminCount` aplicada por organização.
- A chave de IA continua por pessoa. Uma chave por organização fica como evolução, com a mesma cifra do BYOK.

Rotas:

| Método e caminho | Acesso | Função |
|---|---|---|
| `GET /api/orgs` | sessão | organizações da pessoa, com o papel dela |
| `POST /api/orgs` | sessão | cria (a pessoa vira `owner`) |
| `GET /api/orgs/:id/members` | membro | lista membros e convites pendentes |
| `POST /api/orgs/:id/invites` | `owner`, `admin` | convida por e-mail |
| `POST /api/orgs/invites/accept` | sessão | `{ token }` |
| `PUT /api/orgs/:id/members/:userId` | `owner`, `admin` | muda papel |
| `DELETE /api/orgs/:id/members/:userId` | `owner`, `admin`, ou a própria pessoa | remove ou sai |

A exportação de dados (`GET /api/auth/export`) passa a incluir as organizações e os projetos compartilhados de autoria da pessoa.

### 5.2 Planos e cotas (migração 14; depende do modelo de cobrança)

```sql
CREATE TABLE plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  monthly_generations integer NOT NULL,
  max_members integer NOT NULL,
  max_projects integer NOT NULL,
  price_cents integer NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE subscriptions (
  org_id uuid PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id),
  status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- Plano `gratuito` semeado na migração, com os limites atuais (os da Fase 2 e os 500 projetos de `projects.js`), para nada mudar para quem já usa.
- A cota mensal lê `generation_jobs` (Fase 2) por organização: o job ganha `org_id` (preenchido com a organização ativa da pessoa ao enfileirar).
- `MAX_PROJECTS_PER_USER` (`lib/projects.js:5`) passa a vir do plano.
- Ao chegar a 80% da cota: aviso no app. A 100%: 429 com `code: PLAN_QUOTA` e mensagem com o nome do plano e a data de renovação.
- Situação `past_due`: aviso por 7 dias, depois só leitura (abrir e exportar projetos, sem gerar). `canceled`: volta ao plano gratuito no fim do período.

### 5.3 Pagamento (migração 15; depende do provedor)

```sql
CREATE TABLE billing_events (
  provider text NOT NULL,
  event_id text NOT NULL,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  PRIMARY KEY (provider, event_id)
);
```

- `POST /api/billing/webhook/:provider`: rota pública, fora da verificação de origem, com corpo lido em bruto para conferir a assinatura do provedor (cabeçalho e segredo próprios de cada um, `BILLING_WEBHOOK_SECRET`).
- **Idempotência**: grava em `billing_events` com `ON CONFLICT DO NOTHING`; se o evento já existia, responde 200 sem reprocessar. Provedores reenviam eventos.
- Eventos tratados: assinatura criada, pagamento confirmado, pagamento falhou, assinatura cancelada. Cada um atualiza `subscriptions` numa transação.
- Checkout: redirecionar para a página de pagamento do provedor. O app nunca recebe nem guarda dado de cartão.
- `billing_events.payload` apagado após 90 dias (só o necessário para conferência).

### 5.4 Verificação em duas etapas (independente; migração 16)

```sql
ALTER TABLE users ADD COLUMN totp_secret_enc text;
ALTER TABLE users ADD COLUMN totp_enabled_at timestamptz;

CREATE TABLE recovery_codes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  PRIMARY KEY (user_id, code_hash)
);
```

- TOTP padrão (RFC 6238: SHA-1, 30 s, 6 dígitos) com `node:crypto`, sem dependência. Segredo cifrado com a chave derivada `byok`, como as chaves de IA.
- Ativar: o app mostra o segredo (texto e QR em SVG desenhado no servidor); a pessoa confirma com um código; recebe 10 códigos de recuperação (mostrados uma vez, guardados como hash scrypt).
- Login com 2FA ativo: depois da senha, o servidor emite um token curto (5 min, `purpose: 2fa`) em vez da sessão; `POST /api/auth/2fa` com o código troca pela sessão. Tentativas no limitador da Fase 1 (`2fa:<uid>`, 5 em 15 min).
- Ativar ou desativar invalida as outras sessões (`pwd_version + 1`).
- Exigir 2FA de administradores do sistema é uma opção (`REQUIRE_ADMIN_2FA=true`).

### 5.5 Painéis

- **Cliente** (`owner` e `admin` da organização): gerações do mês sobre a cota, membros sobre o limite, plano, próxima cobrança, link para a área do provedor.
- **Administrador do sistema**: organizações por plano, assinaturas em `past_due`, receita do mês (soma de `plans.price_cents` das `active`), gerações por dia. Lê das tabelas acima; sem métricas novas.

### 5.6 Página de status

Página pública estática gerada pelo verificador de disponibilidade (Uptime Kuma tem página de status embutida) a partir de `/api/health` e das métricas da Fase 3. Fora do app, para continuar no ar quando o app cair.

## Sequência de entrega

| PR | Conteúdo | Pode começar antes das decisões? |
|---|---|---|
| 5-a | Organizações pessoais e migração de dados | sim |
| 5-b | Convites, membros e projetos compartilhados | sim |
| 5-c | Verificação em duas etapas | sim |
| 5-d | Planos e cotas por organização (só o plano gratuito) | sim |
| 5-e | Pagamento com o provedor escolhido | não |
| 5-f | Painéis | depois de 5-e |
| 5-g | Textos legais revisados, `LEGAL_VERSION` nova | não |

## Testes

| Cenário | Então |
|---|---|
| Conta nova | Ganha organização pessoal como `owner` |
| Membro abre projeto compartilhado | 200; quem não é membro recebe 404 |
| Projeto pessoal | Continua invisível para os outros membros da organização |
| Último `owner` tenta sair | 409 |
| Convite com outro e-mail logado | Recusado |
| Convite expirado | Recusado |
| Webhook com assinatura errada | 401, nada gravado |
| Mesmo evento recebido duas vezes | Processado uma vez |
| Pagamento falhou há 8 dias | Geração recusada com `PLAN_QUOTA`; abrir e exportar projetos continuam funcionando |
| Cota do plano | A geração seguinte ao limite recebe 429 com a data de renovação |
| Login com 2FA | Senha certa devolve token curto, não sessão; código certo devolve sessão |
| Código de recuperação | Funciona uma vez; a segunda é recusada |

## Critérios de aceite

- [ ] Roteiro completo em homologação com o provedor em modo de teste: criar organização, convidar, assinar, gerar dentro da cota, simular falha de pagamento, ver o aviso e o bloqueio.
- [ ] Nenhum dado de cartão passa pelo servidor (conferido no log e no banco).
- [ ] Termos e Política revisados por advogado antes de abrir a cobrança.

## Reversão

- 5-a a 5-d são aditivas; projetos sem `org_id` continuam funcionando como hoje.
- Pagamento: desligar a rota do webhook e marcar todas as assinaturas como `active` no plano atual evita bloqueio indevido enquanto se corrige.
- 2FA: uma variável `DISABLE_2FA=true` de emergência faz o login ignorar o segundo fator, registrada no `audit_log`.
