# Fan! Bienal 2026 — Backend

NestJS + Prisma + PostgreSQL. Deploy: Vercel (serverless).

## Setup

```bash
cp .env.example .env
# Completar DATABASE_URL, DIRECT_URL, CORS_ORIGIN
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Swagger local: `http://localhost:3000/api/docs`

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | PostgreSQL pooled (Neon pooler) |
| `DIRECT_URL` | PostgreSQL directo (migraciones) |
| `CORS_ORIGIN` | Orígenes del frontend (coma-separados) |
| `MAX_PROCESSED_IMAGE_BYTES` | Límite imagen procesada (default 409600) |
| `PORT` | Puerto local (default 3000) |

## Scripts

```bash
npm run dev
npm run build
npm test
npx prisma migrate deploy
npx prisma db seed
```

## Vercel

- Root: este repositorio
- Entry: `api/index.ts` (`vercel.json`)
- Env: las mismas variables de arriba
- Tras el primer deploy: asegurar migraciones aplicadas (`prisma migrate deploy`)
