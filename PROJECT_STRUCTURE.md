# PROJECT_STRUCTURE.md — أرشيف ذكي (Smart Archive)

## نظرة عامة

نظام إدارة أرشيف هندسي متكامل يدعم مشاريع الإنشاء والعقود والمستندات الفنية والمراسلات،
مع نظام تنبيهات تلقائي وتقارير دورية.

---

## بنية المشروع

```
workspace/
├── artifacts/
│   ├── api-server/        # Express 5 REST API (TypeScript)
│   │   └── src/routes/sa/ # جميع مسارات النظام
│   ├── smart-archive/     # واجهة React + Vite (PWA)
│   └── arch-archive/      # واجهة بديلة (React + Vite)
├── lib/
│   ├── api-spec/          # OpenAPI spec + codegen
│   ├── api-client-react/  # Hooks مُولَّدة تلقائياً
│   ├── api-zod/           # Zod schemas مُولَّدة
│   └── db/                # Drizzle ORM (PostgreSQL)
└── scripts/               # سكريبتات مساعدة
```

---

## البنية متعددة المستأجرين (Multi-Tenant) — Prompt 10

### الوضع الحالي
النظام حالياً يستخدم **مخزن في الذاكرة** (in-memory store) للتطوير السريع.
جميع البيانات مشتركة في نفس العملية.

### مخطط التحويل لـ Multi-Tenant مع قاعدة بيانات حقيقية

1. **أضف عمود `workspaceId` لكل جدول:**
   ```sql
   ALTER TABLE projects ADD COLUMN workspace_id UUID NOT NULL;
   ALTER TABLE documents ADD COLUMN workspace_id UUID NOT NULL;
   ALTER TABLE letters ADD COLUMN workspace_id UUID NOT NULL;
   -- ... وهكذا لكل جدول
   ```

2. **ربط كل مستخدم بـ workspace:**
   ```sql
   CREATE TABLE workspaces (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL,
     plan TEXT DEFAULT 'free', -- free / pro / enterprise
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   CREATE TABLE workspace_members (
     workspace_id UUID REFERENCES workspaces(id),
     user_id UUID REFERENCES users(id),
     role TEXT DEFAULT 'data_entry', -- admin / data_entry / viewer
     PRIMARY KEY (workspace_id, user_id)
   );
   ```

3. **Middleware لفلترة البيانات تلقائياً:**
   ```typescript
   // في كل route handler
   const { workspaceId } = req.auth; // من JWT
   const projects = await db.query.projects.findMany({
     where: eq(projects.workspaceId, workspaceId)
   });
   ```

4. **حدود الباقات (Prompt 9):**
   ```typescript
   const PLAN_LIMITS = {
     free:       { projects: 3,  storageMB: 100 },
     pro:        { projects: 50, storageMB: 5000 },
     enterprise: { projects: Infinity, storageMB: Infinity },
   };
   ```

---

## نقل المشروع لاستضافة خارجية مستقلة — Prompt 13

### لا تعتمد على أي API حصري بـ Replit

✅ **ما يمكن نقله مباشرة:**
- Node.js / Express — معيار صناعي
- PostgreSQL — قاعدة بيانات قياسية
- React + Vite — يعمل على أي خادم ويب ثابت
- متغيرات البيئة عبر `.env` — معيار صناعي

### خطوات النقل لاستضافة مستقلة

**1. إعداد قاعدة البيانات:**
```bash
# على خادم PostgreSQL خارجي (AWS RDS, Supabase, Neon, Railway)
createdb smart_archive
psql -d smart_archive -f schema.sql
```

**2. متغيرات البيئة المطلوبة (`.env`):**
```env
DATABASE_URL=postgresql://user:password@host:5432/smart_archive
PORT=3000
SESSION_SECRET=<سلسلة عشوائية طويلة>
NODE_ENV=production
```

**3. بناء ونشر الـ API:**
```bash
cd artifacts/api-server
pnpm install
pnpm run build
node dist/index.mjs
```

**4. بناء الواجهة الأمامية:**
```bash
cd artifacts/smart-archive
pnpm install
pnpm run build
# ثم ارفع dist/ إلى أي CDN أو خادم Nginx
```

**5. ضبط Nginx (مثال):**
```nginx
server {
  listen 80;
  server_name yourdomain.com;

  location /api/ {
    proxy_pass http://localhost:3000/api/;
    proxy_set_header Host $host;
  }

  location /smart-archive/ {
    root /var/www/html;
    try_files $uri $uri/ /smart-archive/index.html;
  }
}
```

### خيارات استضافة مقترحة عند التوسع

| المزود | المناسب لـ | التكلفة التقريبية |
|--------|-----------|-------------------|
| **Railway** | مرحلة النمو | ~5-20$/شهر |
| **Fly.io** | مرحلة النمو | ~5-15$/شهر |
| **AWS EC2 + RDS** | إنتاج متوسط/كبير | ~50-200$/شهر |
| **Vercel + Neon** | فرونت فقط + DB | ~20-50$/شهر |
| **VPS (DigitalOcean)** | تحكم كامل | ~10-50$/شهر |

---

## المسارات الرئيسية للـ API

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | `/api/sa/dashboard` | إحصاءات عامة |
| CRUD | `/api/sa/projects/:id` | إدارة المشاريع |
| CRUD | `/api/sa/projects/:id/documents` | الملفات الفنية |
| POST | `/api/sa/projects/:id/documents/:did/revisions` | إضافة إصدار |
| PATCH | `/api/sa/projects/:id/documents/:did/approval` | تحديث حالة الاعتماد |
| CRUD | `/api/sa/projects/:id/letters` | الخطابات |
| CRUD | `/api/sa/projects/:id/contacts` | جهات الاتصال |
| GET | `/api/sa/reports` | تقارير كل المشاريع |
| GET | `/api/sa/reports/:projectId` | تقرير مشروع محدد |
| POST | `/api/sa/auth/login` | تسجيل الدخول |
| POST | `/api/sa/auth/register` | تسجيل حساب جديد |
| GET | `/api/sa/users` | قائمة المستخدمين |
| PATCH | `/api/sa/users/:uid/role` | تغيير الصلاحية |
| GET | `/api/sa/audit` | سجل التدقيق |
| GET | `/api/sa/notifications` | الإشعارات |

---

## الصلاحيات (Prompt 7)

| الدور | الإضافة | التعديل | الحذف | إدارة المستخدمين |
|-------|---------|---------|-------|-----------------|
| admin | ✅ | ✅ | ✅ | ✅ |
| data_entry | ✅ | ✅ | ❌ | ❌ |
| viewer | ❌ | ❌ | ❌ | ❌ |

---

## المهام المجدولة (Prompt 4 + 12)

تعمل في `scheduler.ts` كل ساعة تلقائياً:
- مستندات قيد المراجعة أكثر من 5 أيام → إشعار تحذيري
- خطابات صادرة لم يُؤكد استلامها بعد 7 أيام → إشعار متابعة
- عقود تنتهي خلال 30 يوم → إشعار تذكيري
- تذكيرات مالية خلال 3 أيام → إشعار مالي

---

*آخر تحديث: يوليو 2026*
