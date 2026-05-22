# Wavoip PABX

PABX completo em **Node.js + Next.js** que recebe chamadas pelo WhatsApp (via [Baileys v7](https://github.com/WhiskeySockets/Baileys)) e gerencia voz pelo widget [Wavoip](https://wavoip.com), com automações: auto-reply, IVR, callbacks, NPS, resumo IA pós-chamada e mais.

## ✨ Features

### Telefonia
- 📞 **Atende chamadas WhatsApp** via Baileys (detecção `CB:call`)
- 🎧 **Voz pelo widget Wavoip** (UMD oficial, embed no painel)
- 🔄 **Múltiplas sessões WhatsApp** (multi-tenant nativo, 1 cliente N números)
- 🎵 **URA injetada na chamada** (áudio mixado com voz do agente via Web Audio API)
- 📼 **Gravação client-side** (WebRTC `MediaRecorder` capturando mic + áudio do peer)
- 🤖 **IVR multi-step** (texto / áudio / imagem em sequência configurável)

### Automações
- 💬 **Welcome sequence** customizável por sessão (texto + áudio + imagem com delays)
- 🔇 **Auto-recusa** em horário fora do expediente / status do agente (busy/paused)
- 📊 **NPS pós-chamada** automático (Whisper + parse 0-10 + alerta supervisor pra detractor)
- 🤖 **Resumo IA** (OpenAI Whisper → GPT-4o-mini ou Claude Haiku 4.5)
- 📞 **Missed call followup** (WhatsApp automático após chamada perdida)
- 🛡️ **Smart routing**: blacklist, VIP, repeat caller, regras custom (DDD/regex)

### Painel agente
- 🌙 Dark mode + verde Wavoip + mobile-first
- 📱 Widget Wavoip embedado pra fazer/atender chamadas
- 📋 CRUD de conexões com QR Code inline
- 📈 Dashboard com métricas, NPS, distribuição promoter/detractor
- 🔔 Notificações desktop (Web Notifications API)
- 📚 Biblioteca de uploads (áudios/imagens) reutilizável
- 🏷️ Smart Routing UI com presets de condição/ação
- ⚙️ Settings em abas: chamadas, agente, IVR, NPS, IA, follow-up, Wavoip

### Integrações
- 🔗 **API REST** completa (`/sessions`, `/calls`, `/settings`, `/ratings`, `/metrics`, `/timeline`, ...)
- 🔌 **Socket.IO** pra eventos em tempo real (`call.incoming`, `call.terminated`, `session.status`)
- 📦 **Wavoip API** (poller que enriquece chamadas)
- 🌐 **Webhook ready** (próxima fase)

---

## 🏗️ Arquitetura

```
wavoip-pabx/
├── backend/                 Fastify + Baileys + Prisma + Socket.IO
│   ├── src/
│   │   ├── server.ts        Entry point
│   │   ├── baileys/         WhatsApp socket (multifile auth, monitor CB:call)
│   │   ├── pabx/            autoReply, IVR, NPS, AI summary, routing, etc
│   │   ├── http/routes/     /sessions /calls /settings /ratings /metrics etc
│   │   └── wavoip/          Cliente HTTP da API Wavoip + poller
│   ├── prisma/              Schema + migrations (SQLite local; Postgres-ready)
│   ├── Dockerfile
│   └── package.json
├── frontend/                Next.js 15 App Router + Tailwind v4 + shadcn/ui
│   ├── app/                 Páginas (sessions, calls, settings, dialer)
│   ├── components/          Widget Wavoip, AudioMixer, Sections, UI primitives
│   ├── lib/                 api.ts + zustand store + socket.io client
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml       Sobe backend + frontend
├── ecosystem.config.cjs     PM2 (deploy sem Docker)
└── README.md
```

### Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js 20, TypeScript, Fastify 5, Socket.IO, Pino |
| Banco | SQLite (dev) / Postgres (prod, troca a `DATABASE_URL`) via Prisma 6 |
| WhatsApp | [Baileys v7](https://github.com/WhiskeySockets/Baileys) (ESM via dynamic import) |
| Voz | [@wavoip/wavoip-webphone](https://www.npmjs.com/package/@wavoip/wavoip-webphone) (widget UMD) |
| Frontend | Next.js 15, React 19, Tailwind v4, shadcn/ui, zustand, next-intl, framer-motion |
| IA | OpenAI (Whisper + GPT-4o-mini) e/ou Anthropic Claude |

---

## 🚀 Setup local

### Requisitos
- Node.js 20+
- npm
- Conta Wavoip ativa com **token de device** (obtenha em https://wavoip.com)
- (Opcional) OpenAI API key pra transcrição+resumo
- (Opcional) Anthropic API key pra resumo via Claude

### 1. Backend

```bash
cd backend
cp .env.example .env
# edita .env conforme necessário (defaults funcionam pra dev local)
npm install
npx prisma migrate dev   # cria SQLite + roda migrations
npm run dev              # tsx watch, porta 3001
```

API ativa em `http://localhost:3001`. Health check: `http://localhost:3001/health`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev              # next dev, porta 3000
```

Painel em `http://localhost:3000`.

### 3. Primeira conexão WhatsApp

1. Abra `http://localhost:3000/sessions`
2. **Nova conexão** → escolhe nome, locale, cola o token Wavoip
3. Aparece o QR Code → escaneia com WhatsApp do seu celular (Aparelhos conectados)
4. Status vira **Conectado** + número aparece

### 4. (Opcional) Habilitar IA

1. `/settings` → aba **IA**
2. Cola `openai_api_key` (sk-...) → Salvar
3. (Opcional) cola `anthropic_api_key` (sk-ant-...) → Salvar
4. Liga `ai_summary_enabled = true`
5. Escolhe `ai_summary_provider` (`auto` / `openai` / `anthropic`)

> **Nota sobre Whisper:** seu Project OpenAI precisa ter acesso ao modelo de transcrição. Se receber `Project does not have access to model X`, libere `whisper-1` ou `gpt-4o-mini-transcribe` em https://platform.openai.com/settings/organization/projects.

### 5. (Opcional) Habilitar NPS automático

`/settings` → aba **NPS (config)**:
- `nps_enabled = true`
- `nps_delay_seconds` = quantos segundos após chamada antes de enviar (default 600 = 10min)
- `nps_min_duration_seconds` = duração mínima da chamada pra disparar NPS (default 30s)
- `nps_supervisor_phone` = número E.164 que recebe alertas de detractor (0-6)

---

## 🐳 Deploy com Docker

```bash
docker-compose up -d
```

Sobe backend (`:3001`) + frontend (`:3000`) + volumes persistentes pra dados e uploads.

Pra produção, configure as env vars no `docker-compose.yml` ou em um `.env` raiz:

```bash
WAVOIP_API_BASE_URL=https://api.wavoip.com
CORS_ORIGIN=https://seu-dominio.com
DEFAULT_LOCALE=pt-BR
```

**Postgres em produção:** edite `backend/prisma/schema.prisma` (provider `postgresql`) e setta `DATABASE_URL`.

---

## ⚙️ Deploy com PM2 (sem Docker)

```bash
# Build os dois
cd backend && npm install && npm run build && cd ..
cd frontend && npm install && npm run build && cd ..

# Sobe via PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # autostart no boot do servidor
```

Logs em `./logs/`.

---

## 📚 API principal

| Rota | Método | Função |
|---|---|---|
| `/health` | GET | Liveness probe |
| `/sessions` | GET / POST / PUT / DELETE | CRUD conexões WhatsApp |
| `/sessions/:id/start` | POST | Inicia (gera QR se precisar) |
| `/sessions/:id/stop` | POST | Desconecta |
| `/sessions/:id/qr.html` | GET | QR renderizado em HTML (escanear do celular) |
| `/sessions/:id/send-message` | POST | Envia mensagem manual |
| `/calls` | GET | Histórico paginado |
| `/calls/:id` | GET | Detalhes (com events) |
| `/calls/:id/reject` | POST | Recusa chamada via Baileys |
| `/calls/:id/end` | POST | Encerra |
| `/calls/:id/summary` | GET | Resumo IA + transcrição |
| `/calls/recording` | POST | Upload de gravação (multipart) |
| `/settings` | GET / PUT | Configs globais (DB sobrescreve `.env`) |
| `/settings/:key` | GET / PUT / DELETE | Setting individual |
| `/uploads` | GET / POST / DELETE | Biblioteca de mídias |
| `/contact-tags` | GET / POST / DELETE | Blacklist / VIP / trusted |
| `/routing-rules` | GET / POST / PUT / DELETE | Regras de roteamento |
| `/ratings` | GET | Respostas NPS |
| `/ratings/summary` | GET | NPS score calculado |
| `/callbacks` | GET / POST / PUT / DELETE | Fila de retornos |
| `/business-hours` | GET / POST / PUT / DELETE | Horário comercial |
| `/flows` | GET / POST / PUT / DELETE | Fluxos IVR |
| `/metrics` | GET | Estatísticas operacionais |
| `/metrics/calls-by-day` | GET | Série temporal 30d |
| `/timeline?phone=X` | GET | Histórico unificado de um contato |

Socket.IO events (path `/socket.io/`):
- `call.incoming`, `call.terminated`, `call.accepted`, `call.rejected`, `call.missed`
- `session.status` (QR, conectado, etc)

---

## 🔧 Configurações importantes (`/settings`)

| Setting | Padrão | Função |
|---|---|---|
| `reject_calls_default` | `true` | Rejeita chamadas em sessões novas |
| `call_reject_message_pt/_en` | "..." | Mensagem ao rejeitar |
| `on_accept_audio_url` | "" | URA tocada ao atender (URL pública). Pode ser configurado também **por sessão** no welcome sequence com `injectOnAnswer: true` |
| `agent_status` | `available` | available / busy / paused (sincroniza com Sidebar) |
| `agent_busy_message` | "..." | Mensagem ao receber chamada estando busy |
| `outside_hours_reject` | `true` | Recusa chamada fora do expediente + envia msg |
| `nps_enabled` | `false` | Liga pesquisa NPS automática |
| `nps_delay_seconds` | `600` | Atraso antes de mandar |
| `nps_supervisor_phone` | "" | Recebe alertas de detractor |
| `ai_summary_enabled` | `false` | Liga resumo IA pós-chamada |
| `ai_summary_provider` | `auto` | `auto` / `openai` / `anthropic` |
| `openai_api_key` | "" | sk-... (secret, mascarado no GET) |
| `anthropic_api_key` | "" | sk-ant-... (secret) |
| `missed_followup_enabled` | `false` | Envia WhatsApp após chamada perdida |
| `wavoip_poll_interval_ms` | `5000` | Polling da API Wavoip |

---

## 🔒 Segurança / o que NÃO commitar

Já no `.gitignore`:
- ❌ `.env`, `.env.local`, `.env.production`
- ❌ `backend/prisma/dev.db` (contém **tokens Wavoip + API keys** salvos via /settings)
- ❌ `backend/.sessions/` (credenciais Baileys WhatsApp do agente)
- ❌ `backend/.uploads/` (gravações de chamadas — pode ter PII)
- ❌ `node_modules/`, `.next/`, `dist/`

**API keys** ficam em `Setting` no banco (mascaradas no GET, retornadas apenas pra uso interno do backend). Nunca expostas no frontend.

---

## 🐛 Troubleshooting

### Widget Wavoip não carrega
Confira `frontend/.env.local`:
```
NEXT_PUBLIC_WAVOIP_WIDGET_URL=https://cdn.jsdelivr.net/npm/@wavoip/wavoip-webphone/dist/index.umd.min.js
```

### "Project does not have access to model whisper-1"
Acesse https://platform.openai.com/settings/organization/projects → seu project → Limits → habilite o modelo. Ou use uma key de User (sem restrição) em vez de Project key.

### NPS não dispara
- `nps_enabled` está `true`? `/settings` → NPS
- A chamada teve duração ≥ `nps_min_duration_seconds`?
- Status final foi `completed` ou `terminated`?

### Gravação client-side vazia
Confira no console: `[AudioMixer] capturado via srcObject - tracks: N`. Se N=0, o widget não criou áudio peer (chamada muito curta ou sem áudio remoto). 

### Sessão Baileys fica em loop de QR
Apague `backend/.sessions/session-<id>-<nome>/` e reescaneia.

---

## 📝 Licença

Este projeto está licenciado sob a **GNU Affero General Public License v3.0 (AGPL v3)**.

### Principais características da licença

- **Código Aberto**: o software é livre e de código aberto
- **Obrigação de Expor Código-Fonte**: qualquer pessoa que use ou implemente este software deve disponibilizar o código-fonte completo
- **Permite Comercialização**: você pode usar, modificar e distribuir o software comercialmente
- **Proteção de Marcas e Copyright**: as marcas registradas e direitos autorais originais são mantidos
- **Sem Garantias**: o software é fornecido "como está", sem garantias de qualquer tipo

### Requisitos para uso

- **Distribuição**: se você distribuir o software, deve incluir o código-fonte completo
- **Modificações**: qualquer modificação deve ser licenciada sob a mesma licença AGPL v3
- **Uso em Rede**: se o software for usado em um servidor acessível publicamente, o código-fonte deve estar disponível para os usuários
- **Atribuição**: deve manter os avisos de copyright e licença originais

Para mais detalhes, consulte o arquivo [`LICENSE`](./LICENSE) ou visite https://www.gnu.org/licenses/agpl-3.0.html.

## 🙏 Créditos

- [Baileys](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web API
- [Wavoip](https://wavoip.com) — Voice over WhatsApp
- [shadcn/ui](https://ui.shadcn.com), [Radix](https://www.radix-ui.com)
