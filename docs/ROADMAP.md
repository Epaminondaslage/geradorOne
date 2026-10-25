# Roadmap: do GeradorOne atual a um SaaS que escala com segurança

Avaliação feita em 22/10/2026 e reorganizada em 25/10/2026 a partir da releitura completa do código. Cada item tem uma caixa para marcar quando for concluído.

**Especificações técnicas** de cada fase (tabelas em SQL, contratos das rotas, módulos, sequência de PRs, cenários de teste, critérios de aceite e reversão): [docs/specs/](specs/README.md). Visão geral comentada: [Plano de escala do GeradorOne](https://claude.ai/artifact/K8J6ux2kfVgj98gr6vyUWR).

## Onde estamos

**Pronto**

- [x] Servidor com folga de recursos: 16 CPUs, 31 GB de RAM, 936 GB de disco.
- [x] Postgres 17 na rede interna do Docker, sem porta publicada, com migrações versionadas, volume próprio e verificação de saúde.
- [x] Backup do banco em `scripts/backup-db.sh`, com restauração comprovada, status lido pela aba Backup.
- [x] Login por e-mail e senha, perfis admin e usuário, troca de senha obrigatória no primeiro acesso, recuperação por código enviado por e-mail e limite de tentativas.
- [x] Chaves de IA por usuário (BYOK), cifradas com AES-256-GCM. A chave mestra fica em `APP_SECRET`, fora do banco, e o app recusa iniciar se ela mudar.
- [x] Contêiner endurecido (usuário sem privilégios, sistema de arquivos somente leitura, sem capabilities) e suíte de 88 testes contra Postgres real (87 passam e 1 é pulado sem Chromium; conferido em 25/10/2026).
- [x] Cadastro público com verificação de e-mail por código de 6 dígitos (23/10/2026).
- [x] Termos de uso e política de privacidade com aceite registrado e versionado (`lib/legal.js`), ainda sem revisão jurídica.
- [x] LGPD, parte técnica: exportação dos dados da conta, exclusão da conta, prazo de retenção e canal do responsável.
- [x] Caixa de e-mail própria do projeto, configurável na tela **E-mail (SMTP)** (23/10/2026).
- [x] Revisão técnica pedida à IA antes de gerar a imagem (24/10/2026).
- [x] Plano de escala em cinco fases (25/10/2026) e especificações técnicas de cada fase (25/10/2026).

**Não está pronto para clientes.** O que impede escalar, em ordem:

| Área | Situação hoje | Efeito ao escalar |
|---|---|---|
| Geração (`/api/generate`) | Texto, imagens e PDF numa única requisição HTTP de até 7,5 min; Chromium abre no mesmo contêiner, sem fila nem cota | Um usuário esgota CPU e os 32 MB de `/tmp`; proxies cortam a conexão longa |
| Estado do processo | Limites de login, códigos de recuperação, cadastros pendentes e `rate-limit.js` em `Map` na memória | Com duas instâncias os limites valem pela metade e um código pedido numa instância falha na outra; tudo some a cada deploy |
| Operação | `console.log`, sem CI, sem métricas, sem captura de erros, estáticos sem `Cache-Control` nem compressão | Falhas ficam invisíveis; `app.js` e `bncc.json` são relidos do disco a cada pedido |
| Deploy | `container_name` fixo, porta 8123 aberta em HTTP, `--no-sandbox` no Chromium | Impede réplicas; expõe senha em texto claro fora da rede interna |

As fases abaixo são sequenciais porque cada uma remove um bloqueio da seguinte. Ordem recomendada de execução: **0 → 1 → 3 (blocos A e B: CI e logs) → 2 → 3 (blocos C a E) → 4 → 5**.

Princípios que valem para todas as fases:

- Nenhuma mudança entra sem teste correspondente em `test/` e sem passar na suíte inteira (`npm test`).
- Zero dependências novas sem necessidade real; quando entrar uma, fixar a versão como já se faz com `pg` e `nodemailer`.
- O processo web nunca executa trabalho pesado (Chromium, scrypt em massa, SMTP lento) de forma síncrona.
- Todo estado que precisa sobreviver a um deploy ou ser visto por outra instância vive no Postgres.
- Só migrações aditivas; remover ou renomear coluna só numa versão seguinte.
- Cada fase termina com este arquivo e o `docs/CODEBASE_MAP.md` atualizados no mesmo commit.

---

## Fase 0: segurança antes de expor à internet

Especificação: [fase-0-seguranca.md](specs/fase-0-seguranca.md)

Meta: convidados usam o app num endereço público sem vazar senha e sem que um terceiro consiga travar contas alheias.

### Acesso público e HTTPS

- [ ] Definir o domínio e apontar o DNS (quem administra o DNS?).
- [ ] Liberar o servidor para a internet (NAT e firewall nas portas 80 e 443) ou hospedar em outro lugar.
- [ ] Usar o `compose.prod.yaml` com Caddy como padrão de produção (certificado Let's Encrypt automático; HSTS já está no `Caddyfile`).
- [ ] Fechar a porta 8123: `"${LAN_BIND:-127.0.0.1}:8123:3000"` nos dois `compose`.
- [ ] Publicar na raiz do domínio, em vez do caminho `/geradorone`.

### Brechas conhecidas no código

- [ ] **`X-Forwarded-For` confiado cegamente** (`clientIp`, `server.js`): ler só o salto do proxy confiável (`TRUSTED_PROXY_HOPS`); com `0`, usar o IP da conexão.
- [ ] **Enumeração de contas por tempo de resposta** em `/api/auth/signup` e `/api/auth/forgot`: hash sempre calculado e e-mail enviado fora do caminho da resposta.
- [ ] **Travar conta de terceiros**: trocar o bloqueio por e-mail por bloqueio por par IP+e-mail, bloqueio por IP em massa e atraso progressivo por e-mail.
- [ ] **Sair não invalida a sessão**: `sid` no token, tabela `revoked_sessions` (migração 7) e renovação deslizante do cookie.
- [ ] **Senha temporária no log**: exigir `ADMIN_PASSWORD` em produção.
- [ ] **Prova de trabalho** no cadastro e na recuperação, sem serviço de terceiros.
- [ ] **Política de senha**: lista local de senhas comuns e, opcionalmente, consulta k-anonymity a senhas vazadas.
- [ ] **Recuperação substitui código pendente de outra pessoa**: resolvido na Fase 1 (`pending_codes`).

### Backup que protege de verdade

- [x] `scripts/backup-db.sh` agendado todo dia às 03:15 pelo cron, com cópia do `.env` e status lido pelo app.
- [ ] Copiar os backups para fora do servidor (outro servidor ou armazenamento em nuvem).
- [ ] Testar a restauração periodicamente, por exemplo todo mês.

### E-mail

- [ ] Configurar SPF, DKIM e DMARC do domínio, para os e-mails não caírem no spam.
- [ ] Trocar a senha da caixa do projeto que foi enviada por e-mail em texto aberto.

**Pronto quando:** o app abre só em `https://`, a 8123 não responde de fora, e os 16 cenários de teste da especificação passam.

---

## Fase 1: tirar todo estado da memória do processo

Especificação: [fase-1-estado-no-banco.md](specs/fase-1-estado-no-banco.md)

Meta: qualquer instância do app atende qualquer requisição, e um deploy não apaga limites nem códigos pendentes. É o pré-requisito da Fase 4.

- [ ] **Limitador no Postgres** (migração 8, `rate_limits`): mesma interface `blocked/hit/reset`, agora assíncrona, numa única consulta por chamada.
- [ ] **Códigos pendentes no Postgres** (migração 9, `pending_codes`): até 3 códigos vivos por e-mail; pedir de novo não invalida o código de outra pessoa; tentativas no limitador.
- [ ] **`APP_SECRET` obrigatória em produção**: sem ela cada réplica geraria um `secret.key` diferente.
- [ ] **Impressão digital da chave mestra em `settings`**, com transição automática do `runtime/secret.check`; nova ordem de inicialização (migrar antes de conferir a chave).
- [ ] **SMTP do painel coerente entre instâncias**: releitura periódica (`SMTP_RELOAD_SECONDS`).
- [ ] **Registro de auditoria** (migração 10, `audit_log`) das ações de administrador e da exclusão de conta, com `GET /api/audit` e retenção configurável.

**Pronto quando:** `server.js` não guarda estado de segurança em memória, e duas instâncias no mesmo banco passam o roteiro de login e recuperação alternando entre elas.

---

## Fase 2: geração assíncrona com fila, worker e Chromium isolado

Especificação: [fase-2-geracao-assincrona.md](specs/fase-2-geracao-assincrona.md)

Meta: `/api/generate` responde em menos de 100 ms, o trabalho pesado roda em processo separado com concorrência limitada, e nenhum usuário consegue esgotar o servidor.

- [ ] Extrair de `server.js` para `lib/ai/` os provedores, o sanitizador, `embedImages` e `htmlToPdf`, sem mudar comportamento.
- [ ] Tabelas `generation_jobs` e `generation_files` (migração 11) e `lib/jobs.js` com reivindicação por `FOR UPDATE SKIP LOCKED`, sinal de vida e recolhimento de órfãos sem nova tentativa automática (a IA é paga pela chave da pessoa).
- [ ] `worker.js` com semáforo de jobs e do Chromium; texto e imagens em paralelo; cancelamento e prazo por `AbortController`.
- [ ] Cotas: 2 jobs ativos e 20 gerações por dia por usuário (fuso de Brasília).
- [ ] Rotas `POST /api/generate` (202), `GET /api/generate/:id`, `GET /api/generate/:id/files/:n`, `DELETE /api/generate/:id`; `/api/improve` no mesmo mecanismo; modo `GENERATION_MODE=inline` para reversão.
- [ ] Contêiner `worker` com Chromium, `/tmp` de 512 MB, `pids_limit` e limites de memória e CPU; contêiner web sem Chromium.
- [ ] Frontend com progresso, cancelar e retomar ao recarregar a página.
- [ ] Limitadores em `/api/pdf` e `/api/render`.

**Pronto quando:** o contêiner web não tem Chromium; 20 pedidos simultâneos de PDF terminam sem 5xx; nunca há mais Chromiums que `CHROMIUM_CONCURRENCY` por worker.

---

## Fase 3: operação

Especificação: [fase-3-operacao.md](specs/fase-3-operacao.md)

Meta: toda regressão aparece na CI antes do deploy, e toda falha em produção aparece num alerta antes de o usuário reclamar.

### Antes da Fase 2 (blocos A e B)

- [ ] CI no GitHub Actions com Postgres de serviço, Chromium, build da imagem e proteção da `main`.
- [ ] Dividir `auth.test.js` em arquivos independentes, com `test/helpers/app.js`.
- [ ] Cobrir `/api/generate`, `/api/improve`, `/api/pdf`, `/api/render`, estáticos e `backup-db.sh`.
- [ ] `lib/log.js` com JSON por linha, `X-Request-Id`, rota normalizada, teste que garante ausência de dados pessoais no log, rotação no `compose`.

### Depois da Fase 2 (blocos C a E)

- [ ] `GET /api/metrics` em formato Prometheus, protegido por token, também no worker.
- [ ] Captura de erros (Sentry ou GlitchTip) sem corpo, cookies nem cabeçalhos sensíveis.
- [ ] Alertas: fora do ar, fila parada, 5xx em alta, backup atrasado, disco, e-mail travado.
- [ ] Estáticos em memória com `ETag`, gzip e `Cache-Control`; nomes com hash gerados no build da imagem.
- [ ] `UV_THREADPOOL_SIZE=16`.
- [ ] Fila de e-mails (migração 12, `outbox_emails`) com conteúdo cifrado; suporte com anexos e teste de SMTP continuam síncronos.
- [ ] Lista de usuários paginada no servidor.

**Pronto quando:** CI verde obrigatória; um erro forçado aparece no Sentry com `reqId`; os alertas chegam num teste provocado; estáticos com `immutable` e gzip.

---

## Fase 4: múltiplas instâncias, deploy sem queda e banco resiliente

Especificação: [fase-4-replicas-e-banco.md](specs/fase-4-replicas-e-banco.md)

Meta: 2 instâncias web e 2 workers no servidor atual, deploy sem nenhum 502, banco recuperável em qualquer ponto dos últimos 7 dias.

- [ ] Encerramento gracioso: `/api/health` responde 503 ao receber `SIGTERM`, espera de até 30 s.
- [ ] `compose.prod.yaml` sem `container_name` e `ports`, com réplicas e limites; Caddy com `dynamic a`, `least_conn` e verificação de saúde.
- [ ] Deploy com `docker rollout` ou `scripts/deploy.sh`; workers primeiro, web depois.
- [ ] pgBackRest com WAL, completo semanal e diferencial diário; `pg_dump` sem as tabelas temporárias da geração; exercício mensal em `docs/RESTAURACAO.md`.
- [ ] Dependabot ou Renovate.
- [ ] PgBouncer em modo transação quando passar de 80 conexões.
- [ ] Réplica em streaming quando houver segunda máquina.

**Pronto quando:** 2 web e 2 workers saudáveis; um deploy completo sem 502; exercício de PITR registrado.

---

## Fase 5: produto SaaS

Especificação: [fase-5-saas.md](specs/fase-5-saas.md)

Meta: um cliente cria a organização, convida colegas, assina um plano, gera dentro da cota e é bloqueado com aviso claro quando o plano vence.

### Podem começar antes das decisões de negócio

- [ ] **Organizações** (migração 13): organização pessoal para cada conta, membros com papéis, convites por e-mail, projetos compartilhados.
- [ ] **Verificação em duas etapas** (migração 16): TOTP sem dependência, códigos de recuperação.
- [ ] **Planos e cotas** (migração 14) só com o plano gratuito, com os limites atuais.

### Dependem das decisões

- [ ] **Pagamento** (migração 15): webhooks com assinatura conferida e idempotência; checkout na página do provedor.
- [ ] **Painéis** de uso para o cliente e de faturamento para o administrador; nota fiscal, se aplicável.
- [ ] **Página de status** pública, fora do app.
- [ ] **LGPD, parte jurídica**: revisão dos termos e da política com advogado antes de abrir ao público em geral.
- [ ] **Modelos de e-mail transacional** (boas-vindas, verificação, recuperação) com a identidade do GeradorOne.

**Pronto quando:** o roteiro completo funciona em homologação com o provedor em modo de teste, e nenhum dado de cartão passa pelo servidor.

---

## Migrações previstas

| Versão | Nome | Fase | Tabelas |
|---|---|---|---|
| 7 | `sessoes-revogadas` | 0 | `revoked_sessions` |
| 8 | `limites-de-tentativas` | 1 | `rate_limits` |
| 9 | `codigos-pendentes` | 1 | `pending_codes` |
| 10 | `registro-de-auditoria` | 1 | `audit_log` |
| 11 | `tarefas-de-geracao` | 2 | `generation_jobs`, `generation_files` |
| 12 | `fila-de-emails` | 3 | `outbox_emails`, índice de busca em `users` |
| 13 a 16 | organizações, planos, cobrança, duas etapas | 5 | ver a especificação da Fase 5 |

## Mapa de mudanças por arquivo

| Arquivo | Fase | Mudança |
|---|---|---|
| `server.js` | 0, 1, 2, 3, 4 | `clientIp` com `TRUSTED_PROXY_HOPS`; `sid` no token e revogação; limitadores assíncronos; rotas `/api/generate/:id`; log JSON; estáticos em memória; `/api/metrics`; encerramento gracioso |
| `lib/rate-limit.js` | 1 | Mesma interface, armazenamento no Postgres |
| `lib/pending-codes.js` (novo) | 1 | Códigos de recuperação e cadastro |
| `lib/audit.js` (novo) | 1 | Registro de auditoria |
| `lib/password-policy.js` (novo) | 0 | Senhas comuns e vazadas |
| `lib/db.js` | 0, 1, 2, 3, 5 | Migrações 7 em diante |
| `lib/secret-check.js` | 1 | Impressão digital em `settings` |
| `lib/crypto.js` | 0, 1 | Prova de trabalho; `APP_SECRET` obrigatória em produção |
| `lib/ai/*.js` (novo) | 2 | Provedores, sanitizador, `embedImages`, `htmlToPdf` extraídos de `server.js` |
| `lib/jobs.js`, `lib/semaphore.js` (novos) | 2 | Fila de geração e limite de concorrência |
| `worker.js` (novo) | 2, 3 | Laço de jobs, semáforo do Chromium, fila de e-mails, métricas |
| `lib/visuals.js` | 2 | Chamado só pelo worker |
| `lib/mailer.js` | 3 | Envio pela fila, exceto suporte com anexos e teste de SMTP |
| `lib/log.js` (novo) | 3 | JSON por linha com `reqId` |
| `lib/users.js` | 3, 5 | Lista paginada; contagem de administradores em SQL; duas etapas |
| `lib/projects.js` | 5 | Projetos compartilhados por organização; limite vindo do plano |
| `public/app.js` | 0, 2, 3 | Prova de trabalho; progresso, cancelar e retomar; usuários paginados |
| `public/pow-worker.js` (novo) | 0 | Resolve o desafio no navegador |
| `public/index.html` | 3 | Referências com hash geradas no build da imagem |
| `Dockerfile` | 2, 3 | Alvos `web` e `worker`; `scripts/hash-assets.js` no build |
| `compose.yaml`, `compose.prod.yaml` | 0, 2, 3, 4 | `LAN_BIND`; serviço `worker`; rotação de log; sem `container_name`; réplicas e limites |
| `deploy/Caddyfile` | 0, 4 | Cabeçalhos; balanceamento e verificação de saúde |
| `.github/workflows/ci.yml` (novo) | 3 | Testes com Postgres de serviço, build da imagem |
| `test/*.test.js` | todas | Casos de cada especificação; `auth.test.js` dividido; `store.test.js` atualizado a cada migração |
| `docs/ROADMAP.md`, `docs/CODEBASE_MAP.md` | todas | Atualizados no mesmo commit de cada fase |

## Decisões em aberto

| Decisão | Afeta | Padrão assumido nas especificações |
|---|---|---|
| Domínio público e quem controla o DNS | Fase 0 inteira | Não assumido |
| Hospedar no servidor atual ou em nuvem | Fase 4 | Servidor atual, Caddy |
| Arquivos gerados em `bytea` ou em disco/S3 | Fase 2 | `bytea` com retenção de 24 h |
| Prova de trabalho própria ou captcha de terceiro | Fase 0 | Prova de trabalho própria, sem dependência |
| Sentry em nuvem ou GlitchTip local | Fase 3 | GlitchTip no mesmo servidor |
| Canal dos alertas | Fase 3 | E-mail do administrador |
| Cota diária de gerações por usuário no beta | Fase 2 | 20 por dia, 2 simultâneas |
| Onde guardar a cópia externa do backup | Fase 0 | Não assumido |
| Modelo de cobrança e provedor de pagamento | Fase 5 | Não assumido |
| Revisão jurídica dos termos e da política | Fases 1, 2 e 5 | Necessária antes de abrir ao público em geral |

## Riscos conhecidos hoje

- **Disco único, sem cópia externa:** uma falha de disco perde todos os dados.
- **Porta 8123 aberta e tráfego sem HTTPS:** senhas e cookies trafegam sem proteção fora da rede interna.
- **PDF sem limite:** um único usuário pode esgotar CPU e memória do servidor.
- **Perda do `.env`:** sem o `APP_SECRET`, as chaves de IA salvas ficam ilegíveis e cada pessoa cadastra a sua de novo.
- **Refatoração de `server.js` sem CI:** a extração para `lib/ai/` e `worker.js` é a maior mudança do plano; por isso a CI (Fase 3, blocos A e B) vem antes.
- **Arquivos em `bytea`:** 50 gerações por hora com retenção de 24 h são cerca de 12 GB rotativos; a limpeza precisa existir desde o primeiro dia, e o `pg_dump` deve excluir essas tabelas.
- **`--no-sandbox` no Chromium:** mantido, compensado com contêiner separado, `seccomp`, `pids_limit` e limites; avaliar gVisor se o conteúdo gerado por IA for considerado hostil.

## Como saber que o projeto escala

- [ ] Teste de carga reproduzível com provedor de IA simulado: 200 usuários virtuais e 50 gerações por hora, p95 de `/api/projects` abaixo de 200 ms, zero 5xx.
- [ ] Derrubar uma instância web e um worker durante o teste de carga sem erro visível ao usuário.
- [ ] Restauração do backup num banco vazio seguida da suíte de testes passando contra ele.
- [ ] Revisão de segurança externa (ou ao menos um OWASP ZAP baseline) antes de abrir o cadastro público.
