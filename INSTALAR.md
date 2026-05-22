# 🚀 Como rodar o Wavoip PABX no seu PC

Guia rápido pra instalar e usar em **5 minutos**. Sem complicação.

---

## 📋 O que você precisa ter

1. **Node.js 20 ou mais novo** — baixe em https://nodejs.org (instala junto o `npm`)
2. **Uma conta Wavoip** com pelo menos um **token** — pegue em https://wavoip.com
3. Um **celular com WhatsApp** pra conectar

> 💡 Dica: pra ver se o Node está instalado, abra o terminal/PowerShell e digite `node -v`. Se aparecer uma versão tipo `v20.x.x`, está OK.

---

## 📥 1. Baixar o projeto

```bash
git clone https://github.com/pedroherpeto/wavoip-center
cd wavoip-center
```

(Ou baixe o ZIP do GitHub e extraia)

---

## ⚙️ 2. Configurar o servidor (backend)

Abra um terminal **dentro da pasta `backend`**:

```bash
cd backend
copy .env.example .env
npm install
```

> ☕ A instalação demora uns 2 minutos.

Quando terminar, crie o banco de dados local:

```bash
npx prisma migrate dev
```

E **deixa o servidor rodando**:

```bash
npm run dev
```

✅ Quando aparecer **"HTTP server listening"**, o servidor está no ar em `http://localhost:3001`.

**Deixe esse terminal aberto.**

---

## 🎨 3. Configurar o painel (frontend)

Abra **outro terminal** (separado do anterior) na pasta `frontend`:

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

✅ Quando aparecer **"Ready"**, abra no navegador: **http://localhost:3000**

🎉 Painel carregado!

---

## 📱 4. Conectar o primeiro WhatsApp

1. No painel, clique em **Conexões** (ícone de celular)
2. Clique **+ Nova conexão**
3. Preencha:
   - **Nome**: como você quer chamar (ex: "Vendas SP")
   - **Tokens Wavoip**: cole seu token da Wavoip
   - **IVR habilitado**: pode deixar desligado se for primeira vez
4. Clique **Criar**
5. Expanda o card da conexão criada (seta pra baixo)
6. Aparece o **QR Code**
7. No seu celular: WhatsApp → **Configurações** → **Aparelhos conectados** → **Conectar um aparelho** → escaneia o QR
8. Status muda pra **Conectado** ✅

Agora você pode ligar pra esse número WhatsApp de outro telefone e a mágica acontece!

---

## 🎯 5. Testar

1. **Faça uma ligação** do seu celular pessoal pro número conectado
2. Você verá:
   - 📞 O **widget Wavoip** no canto da tela tocando
   - 💬 Mensagens automáticas de boas-vindas chegando no WhatsApp do chamador (se você configurou welcome sequence)
3. Atenda direto no widget ou recuse

---

## ⚙️ 6. (Opcional) Configurar funções extras

Em **Ajustes** (engrenagem) você pode ativar:

- 📊 **NPS** — pergunta de satisfação automática depois da ligação
- 🤖 **Resumo IA** — transcreve e resume a ligação (precisa de chave OpenAI ou Anthropic)
- 🎵 **Áudio na chamada (URA)** — toca um áudio gravado quando você atende
- ⏰ **Horário comercial** — recusa chamadas fora do expediente
- 🛡️ **Lista de bloqueio** — bloqueia números indesejados
- 🌟 **VIP** — prioriza certos contatos

Tudo configurável sem mexer em código.

---

## 🆘 Deu problema?

### O painel não abre
- Confira se os **dois terminais** (backend + frontend) estão rodando
- Acesse http://localhost:3000 (frontend) — se der erro de rede, o frontend não subiu
- Acesse http://localhost:3001/health — se der erro, o backend não subiu

### QR Code não aparece
- Status precisa estar em **QRCODE** ou **OPENING**
- Espere uns 5-10 segundos
- Se ficar travado, clica **Desconectar** e depois **Conectar** de novo

### Widget Wavoip não toca chamada
- Confira se o token está correto na conexão
- Veja o **badge no canto** do painel: tem que estar **verde "ready"**
- Recarregue o painel (Ctrl+Shift+R)

### Outras dúvidas
Consulte o **README.md** completo na raiz do projeto pra detalhes técnicos.

---

## 🎬 Comandos rápidos pra colar

**Toda vez que for usar:**

Terminal 1:
```bash
cd wavoip-pabx/backend
npm run dev
```

Terminal 2:
```bash
cd wavoip-pabx/frontend
npm run dev
```

Painel: http://localhost:3000

**Pra parar tudo:** Ctrl+C em cada terminal.

---

Feito! Bom uso 🚀
