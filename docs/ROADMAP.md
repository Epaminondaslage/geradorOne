# Roadmap: do GeradorOne atual a um SaaS

Avaliação feita em 22/10/2026. Cada item tem uma caixa para marcar quando for concluído.

## Onde estamos

**Pronto**

- [x] Servidor com folga de recursos: 16 CPUs, 31 GB de RAM, 936 GB de disco.
- [x] Postgres 17 na rede interna do Docker, sem porta publicada, com migrações versionadas, volume próprio e verificação de saúde.
- [x] Backup do banco em `scripts/backup-db.sh`, com restauração comprovada.
- [x] Login por e-mail e senha, perfis admin e usuário, troca de senha obrigatória no primeiro acesso, recuperação por código enviado por e-mail e limite de tentativas.
- [x] Chaves de IA por usuário (BYOK), cifradas com AES-256-GCM. A chave mestra fica em `APP_SECRET`, fora do banco, e o app recusa iniciar se ela mudar.
- [x] Contêiner endurecido (usuário sem privilégios, sistema de arquivos somente leitura, sem capabilities) e suíte de testes contra Postgres real.

**Não está pronto para clientes.** Os blocos abaixo explicam o que falta, em ordem.

---

## Fase 1: beta fechado (infraestrutura)

Meta: convidados usam o app com segurança, num endereço público, sem risco de perder dados.

### Acesso público e HTTPS

- [ ] Definir o domínio, por exemplo `geradorone.seu-dominio.com.br`, e apontar o DNS (quem administra o DNS?).
- [ ] Liberar o servidor para a internet (NAT e firewall nas portas 80 e 443) ou hospedar em outro lugar.
- [ ] Emitir certificado HTTPS (Let's Encrypt pelo Coolify/Traefik, que já escuta nas portas 80 e 443).
- [ ] Fechar a porta 8123, hoje aberta para todos: tirar o `ports:` do `compose.yaml` ou publicar só em `127.0.0.1`.
- [ ] Publicar na raiz do domínio, em vez do caminho `/geradorone`.
- [ ] Adicionar cabeçalho HSTS. O cookie `Secure` já liga sozinho com HTTPS.

### Backup que protege de verdade

- [ ] Agendar `scripts/backup-db.sh` no cron, por exemplo `0 3 * * *`.
- [ ] Copiar os backups para fora do servidor (outro servidor ou armazenamento em nuvem), porque hoje tudo mora num disco só.
- [ ] Guardar o backup do `.env` (contém `APP_SECRET` e `POSTGRES_PASSWORD`) separado do backup do banco.
- [ ] Testar a restauração periodicamente, por exemplo todo mês.

### Monitoramento

- [ ] Verificação de disponibilidade em `/api/health`, com alerta por e-mail ou mensagem.
- [ ] Logs em formato estruturado (JSON), com rotação.
- [ ] Captura de erros (Sentry ou similar) e alertas de disco, memória e falha de backup.

### Proteção contra abuso e sobrecarga

- [ ] Limitar a geração de PDF: hoje cada pedido abre um Chromium, sem fila nem limite por usuário. Definir concorrência máxima, fila e tempo limite.
- [ ] Cotas e limite de ritmo por usuário em `/api/pdf`, `/api/generate` e `/api/improve`.
- [ ] Mover o limite de tentativas de login e os códigos de recuperação para o Postgres (hoje ficam na memória e se perdem a cada deploy).

### E-mail

- [x] Criar uma caixa própria do projeto e usá-la no envio (feito em 23/10/2026). A senha pode ser trocada na tela **E-mail (SMTP)** do administrador, sem mexer no `.env`. Falta trocar a senha que foi enviada por e-mail em texto aberto.
- [ ] Configurar SPF, DKIM e DMARC do domínio, para os e-mails não caírem no spam.

**Pronto quando:** o app abre em `https://` no domínio, a 8123 está fechada, há backup diário com cópia externa, alertas funcionando e a geração de PDF tem limites.

---

## Fase 2: abrir para qualquer pessoa (cadastro e conformidade)

- [x] Cadastro público com verificação de e-mail por código de 6 dígitos (23/10/2026). Os cadastros pendentes ficam na memória do processo.
- [ ] Proteção contra robôs no cadastro (captcha ou equivalente). Hoje só há limite de tentativas por e-mail e por IP; o uso é dentro de rede protegida por firewall.
- [ ] Política de senha mais forte e verificação de senhas vazadas.
- [ ] Verificação em duas etapas (opcional para o usuário).
- [ ] Termos de uso e política de privacidade, com aceite registrado no cadastro.
- [ ] LGPD: exportar os dados da conta, excluir a conta, prazo de retenção, canal do encarregado de dados. Avisar que os textos vão ao provedor de IA escolhido pelo usuário.
- [ ] Registro de auditoria das ações de administrador (criar, desativar, redefinir senha, excluir).
- [ ] Modelos de e-mail transacional (boas-vindas, verificação, recuperação) com a identidade do GeradorOne.
- [ ] Página de suporte e de status.

**Pronto quando:** uma pessoa desconhecida consegue criar a própria conta sozinha, aceitar os termos e pedir a exclusão dos próprios dados.

---

## Fase 3: cobrar (organizações, planos e pagamento)

- [ ] Organizações (equipes): convites, papéis por organização e projetos compartilhados. Hoje tudo é por usuário.
- [ ] Planos e cotas (por usuário, por projetos ou por acesso mensal, conforme a decisão abaixo) e período de teste.
- [ ] Integração com provedor de pagamento (Asaas, Stripe ou Pagar.me) com webhooks de cobrança, renovação e cancelamento.
- [ ] Bloqueio ou aviso por inadimplência e por cota excedida.
- [ ] Painel de uso para o cliente e de faturamento para o administrador.
- [ ] Nota fiscal, se aplicável.

**Pronto quando:** um cliente assina, paga, usa dentro da cota do plano e é bloqueado com aviso claro quando o plano vence.

---

## Fase 4: escala e resiliência

- [ ] Mais de uma instância do app (depende de sessões, limites e códigos já estarem no banco).
- [ ] Fila de tarefas para PDF e chamadas de IA, fora do processo web.
- [ ] Réplica do banco e recuperação até um ponto no tempo (WAL).
- [ ] Atualização sem derrubar o serviço.
- [ ] Rotina de atualização das imagens base (Node, Alpine e Chromium) e dependências.

---

## Decisões em aberto

| Decisão | Por que importa |
|---|---|
| Domínio público do GeradorOne e quem controla o DNS | Bloqueia a Fase 1 inteira |
| Como será a cobrança (por usuário, projetos ou mensalidade) | Define planos, cotas e o desenho da Fase 3 |
| Provedor de pagamento | Define a integração e as taxas |
| Onde guardar a cópia externa do backup | Define o custo e o prazo de retenção |
| Hospedar no servidor atual ou em nuvem | Afeta disponibilidade, firewall e custo |
| Prazo de retenção de dados e responsável pela LGPD | Necessário para os termos de uso |

## Riscos conhecidos hoje

- **Disco único, sem cópia externa:** uma falha de disco perde todos os dados.
- **Porta 8123 aberta e tráfego sem HTTPS:** senhas e cookies trafegam sem proteção fora da rede interna.
- **PDF sem limite:** um único usuário pode esgotar CPU e memória do servidor.
- **Perda do `.env`:** sem o `APP_SECRET`, as chaves de IA salvas ficam ilegíveis e cada pessoa cadastra a sua de novo.
