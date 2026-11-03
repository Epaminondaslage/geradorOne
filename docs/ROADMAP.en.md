[Português](ROADMAP.md) | **English**

# Roadmap: from the current GeradorOne to a SaaS

Assessment made on 2026-10-22. Each item has a checkbox to tick when it is done.

## Where we are

**Done**

- [x] Server with spare resources: 16 CPUs, 31 GB of RAM, 936 GB of disk.
- [x] Postgres 17 on the internal Docker network, with no published port, with versioned migrations, its own volume and a health check.
- [x] Database backup in `scripts/backup-db.sh`, with proven restoration.
- [x] Login by email and password, admin and user roles, mandatory password change on first access, recovery by a code sent by email and an attempt limit.
- [x] Per-user AI keys (BYOK), encrypted with AES-256-GCM. The master key lives in `APP_SECRET`, outside the database, and the app refuses to start if it changes.
- [x] Hardened container (unprivileged user, read-only file system, no capabilities) and a test suite against a real Postgres.
- [x] 2026-10-29: app in pt-BR, en, es, de and it (interface, FAQ, emails, prompts and text inside the images), with a flag selector and language stored on the account. Missing: native-speaker review, landing page and carousel in other languages (commercial repository) and the 40 example images.

**Not ready for customers.** The blocks below explain what is missing, in order.

---

## Phase 1: closed beta (infrastructure)

Goal: invited users use the app safely, at a public address, with no risk of losing data.

### Public access and HTTPS

- [ ] Define the domain, for example `geradorone.your-domain.com`, and point the DNS (who administers the DNS?).
- [ ] Open the server to the internet (NAT and firewall on ports 80 and 443) or host it elsewhere.
- [ ] Issue an HTTPS certificate (Let's Encrypt through Coolify/Traefik, which already listens on ports 80 and 443).
- [ ] Close port 8123, currently open to everyone: remove `ports:` from `compose.yaml` or publish only on `127.0.0.1`.
- [ ] Publish at the domain root, instead of the `/geradorone` path.
- [ ] Add an HSTS header. The `Secure` cookie already turns on by itself with HTTPS.

### Backup that actually protects

- [ ] Schedule `scripts/backup-db.sh` in cron, for example `0 3 * * *`.
- [ ] Copy the backups off the server (another server or cloud storage), because today everything lives on a single disk.
- [ ] Keep the `.env` backup (it contains `APP_SECRET` and `POSTGRES_PASSWORD`) separate from the database backup.
- [ ] Test restoration periodically, for example every month.

### Monitoring

- [ ] Availability check on `/api/health`, with an alert by email or message.
- [ ] Logs in a structured format (JSON), with rotation.
- [ ] Error capture (Sentry or similar) and alerts for disk, memory and backup failure.

### Protection against abuse and overload

- [ ] Limit PDF generation: today each request opens a Chromium, with no queue and no per-user limit. Define maximum concurrency, a queue and a timeout.
- [ ] Quotas and rate limits per user on `/api/pdf`, `/api/generate` and `/api/improve`.
- [ ] Move the login attempt limit and the recovery codes to Postgres (today they live in memory and are lost on every deploy).

### Email

- [x] Create a dedicated mailbox for the project and use it for sending (done on 2026-10-23). The password can be changed on the administrator's **Email (SMTP)** screen, without touching `.env`. Still to do: change the password that was sent by email in plain text.
- [ ] Configure SPF, DKIM and DMARC for the domain, so the emails do not land in spam.

**Done when:** the app opens at `https://` on the domain, port 8123 is closed, there is a daily backup with an external copy, alerts are working and PDF generation has limits.

---

## Phase 2: open to anyone (sign-up and compliance)

- [x] Public sign-up with email verification by a 6-digit code (2026-10-23). Pending sign-ups are kept in the process memory.
- [ ] Bot protection on sign-up (captcha or equivalent). Today there is only an attempt limit per email and per IP; use is inside a firewall-protected network.
- [ ] Stronger password policy and a check for leaked passwords.
- [ ] Two-step verification (optional for the user).
- [x] Terms of use and privacy policy, with acceptance recorded at sign-up (2026-10-23): public pages `termos.html` and `privacidade.html`, an acceptance box at sign-up, an acceptance screen for earlier accounts and for each new version (`lib/legal.js`), version and date stored on the account and in the export. It is a draft: the legal review below is still missing.
- [x] LGPD (Brazilian data protection law), technical part (2026-10-23): export the account data (`GET /api/auth/export`, button "Download my data (JSON)" in My account), delete the account, retention period (the account leaves the database immediately; backups are kept for 14 days and then deleted) and the contact channel of the person responsible (John Doe, john.doe@example.com). The texts go to the AI provider the user chose, and the app warns about this.
- [x] Technical review requested from the AI before generating the image (2026-10-24): every workbook and cover prompt carries the "Technical review" block (checks formulas, units, dates, names, numbers and terms; does not include data, sources or quotes it cannot confirm), the PDF/HTML instruction and the "Improve with AI" one preserve it, and the FAQ explains it.
- [ ] LGPD, legal part: have the text of the privacy policy and the terms reviewed (with a lawyer) by someone who knows the law, before opening to the general public.
- [ ] Audit log of administrator actions (create, disable, reset password, delete).
- [ ] Transactional email templates (welcome, verification, recovery) with the GeradorOne identity.
- [ ] Support and status page.

**Done when:** an unknown person can create their own account alone, accept the terms and request deletion of their own data.

---

## Phase 3: charging (organizations, plans and payment)

- [ ] Organizations (teams): invitations, per-organization roles and shared projects. Today everything is per user.
- [ ] Plans and quotas (per user, per project or per monthly access, depending on the decision below) and a trial period.
- [ ] Integration with a payment provider (Asaas, Stripe or Pagar.me) with webhooks for billing, renewal and cancellation.
- [ ] Block or warning for non-payment and for exceeded quota.
- [ ] Usage dashboard for the customer and billing dashboard for the administrator.
- [ ] Invoice (nota fiscal), if applicable.

**Done when:** a customer subscribes, pays, uses the product within the plan quota and is blocked with a clear warning when the plan expires.

---

## Phase 4: scale and resilience

- [ ] More than one instance of the app (depends on sessions, limits and codes already being in the database).
- [ ] Task queue for PDF and AI calls, outside the web process.
- [ ] Database replica and point-in-time recovery (WAL).
- [ ] Updates without taking the service down.
- [ ] Routine for updating base images (Node, Alpine and Chromium) and dependencies.

---

## Open decisions

| Decision | Why it matters |
|---|---|
| Public domain for GeradorOne and who controls the DNS | Blocks all of Phase 1 |
| How billing will work (per user, per project or monthly fee) | Defines plans, quotas and the design of Phase 3 |
| Payment provider | Defines the integration and the fees |
| Where to keep the external backup copy | Defines the cost and the retention period |
| Host on the current server or in the cloud | Affects availability, firewall and cost |
| Legal review of the terms of use and the privacy policy | Required before opening to the general public |

## Known risks today

- **Single disk, no external copy:** a disk failure loses all the data.
- **Port 8123 open and traffic without HTTPS:** passwords and cookies travel unprotected outside the internal network.
- **PDF without a limit:** a single user can exhaust the server's CPU and memory.
- **Loss of `.env`:** without `APP_SECRET`, the saved AI keys become unreadable and each person registers theirs again.
