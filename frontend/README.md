# agent-webphone

Next.js 15 (App Router) panel for Wavoip PABX agents. Mobile-first, PWA-ready,
dark by default, branded with the Wavoip green (`#25D366`).

## Requirements

- Node.js 20+
- Backend running on `http://localhost:3001` (Fastify + Socket.IO)

## Setup

```bash
cd agent-webphone
cp .env.example .env.local
npm install
npm run dev
```

The panel will be available at <http://localhost:3000>.

## Scripts

- `npm run dev` — start in dev mode (port 3000)
- `npm run build` — production build
- `npm run start` — run the production server (port 3000)
- `npm run lint` — ESLint

## Tech

- Next.js 15, React 19, TypeScript
- Tailwind v4 + shadcn-style primitives (Radix)
- framer-motion, lucide-react, next-themes
- zustand for global webphone state
- next-intl (PT-BR + EN)
- next-pwa for installability
- socket.io-client + axios for backend integration
- `@wavoip/wavoip-webphone` UMD loaded from jsDelivr CDN
