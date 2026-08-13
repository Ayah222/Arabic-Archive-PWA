# أرشيف ذكي — Smart Archive PWA

نظام إدارة الأرشيف المعماري: مشاريع، عقود، مستندات، اجتماعات، خطابات.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- البيانات تُخزَّن في ذاكرة مؤقتة (in-memory store) — تُمسح عند إعادة التشغيل، لا قاعدة بيانات حقيقية حالياً.
- الصور والملفات تُخزَّن كـ base64 في الذاكرة.
- كل طلبات الواجهة تمر عبر `/api/sa/*` على API Server الداخلي.

## User preferences — MUST follow always

🚫 **لا تلمس هذه الملفات أبداً بأي تعديل أو إعادة كتابة:**
- `vite.config.ts` / `vite.config.js`
- `tailwind.config.js`
- `package.json` (في أي مكان في المشروع)
- `postcss.config.js`

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
