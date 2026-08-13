# أرشيف ذكي — Smart Archive PWA

نظام إدارة الأرشيف المعماري: مشاريع، عقود، مستندات، اجتماعات، خطابات، مقاولون، أرشيف مالي.

---

## 🗂️ هيكل المشروع

هذا مشروع **pnpm monorepo** يحتوي على تطبيقين رئيسيين:

```
/
├── artifacts/
│   ├── smart-archive/        ← التطبيق الرئيسي (React + Vite PWA)
│   └── api-server/           ← الخادم الخلفي (Express API)
├── lib/
│   ├── api-client-react/     ← هوكس React مولّدة تلقائياً من OpenAPI
│   ├── api-spec/             ← مواصفة OpenAPI (YAML)
│   ├── api-zod/              ← مخططات Zod مولّدة
│   └── db/                   ← (غير مُفعّل حالياً)
└── package.json              ← إعدادات pnpm workspace
```

---

## 🖥️ التطبيق الأمامي — `artifacts/smart-archive/`

```
artifacts/smart-archive/
├── src/
│   ├── App.tsx                      ← نقطة الدخول + Router
│   ├── main.tsx                     ← ReactDOM.render
│   ├── models/
│   │   └── types.ts                 ← جميع أنواع TypeScript المشتركة
│   ├── controllers/
│   │   ├── useGlobal.ts             ← هوكس API الرئيسية (fetch للـ API Server)
│   │   ├── useVoice.ts              ← تسجيل صوتي (stub / OpenAI Whisper)
│   │   └── ...
│   └── views/
│       ├── layouts/
│       │   └── MainLayout.tsx       ← الشريط الجانبي + التخطيط العام
│       ├── pages/
│       │   ├── Dashboard.tsx        ← لوحة التحكم الرئيسية
│       │   ├── Projects.tsx         ← قائمة المشاريع + إنشاء مشروع
│       │   ├── ProjectDetail.tsx    ← تفاصيل مشروع (عقود، مستندات، اجتماعات، خطابات، صور، فئات)
│       │   ├── AllContracts.tsx     ← جميع العقود
│       │   ├── AllMeetings.tsx      ← جميع الاجتماعات
│       │   ├── AllLetters.tsx       ← جميع الخطابات
│       │   ├── AllContractors.tsx   ← جميع المقاولين
│       │   ├── FinancialArchive.tsx ← الأرشيف المالي
│       │   ├── Search.tsx           ← البحث الشامل
│       │   ├── Notifications.tsx    ← الإشعارات
│       │   ├── Reports.tsx          ← التقارير
│       │   ├── Users.tsx            ← إدارة المستخدمين
│       │   ├── Login.tsx            ← تسجيل الدخول / التسجيل
│       │   └── FAQ.tsx              ← الأسئلة الشائعة
│       └── components/
│           └── shared/              ← مكونات مشتركة (ProgressBar, StatusBadge, FileUpload...)
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

### صفحات التطبيق (Routes)

| المسار | الصفحة |
|--------|---------|
| `/` | لوحة التحكم |
| `/projects` | المشاريع |
| `/projects/:id` | تفاصيل مشروع |
| `/contractors` | المقاولون |
| `/contracts` | العقود |
| `/meetings` | الاجتماعات |
| `/letters` | الخطابات والمراسلات |
| `/finance` | الأرشيف المالي |
| `/search` | البحث الموحد |
| `/notifications` | الإشعارات |
| `/reports` | التقارير |
| `/users` | إدارة المستخدمين |
| `/faq` | الأسئلة الشائعة |
| `/login` | تسجيل الدخول |

---

## ⚙️ الخادم الخلفي — `artifacts/api-server/`

```
artifacts/api-server/
├── src/
│   ├── app.ts                       ← إعداد Express
│   ├── index.ts                     ← نقطة تشغيل الخادم
│   └── routes/
│       ├── index.ts                 ← تجميع جميع الـ routers
│       └── sa/
│           ├── store.ts             ← قاعدة البيانات المؤقتة (in-memory)
│           ├── dashboard.ts         ← GET /api/sa/dashboard
│           ├── projects.ts          ← CRUD /api/sa/projects
│           ├── contracts.ts         ← CRUD /api/sa/contracts
│           ├── documents.ts         ← CRUD /api/sa/documents
│           ├── meetings.ts          ← CRUD /api/sa/meetings
│           ├── letters.ts           ← CRUD /api/sa/letters
│           ├── contractors.ts       ← CRUD /api/sa/contractors
│           ├── finance.ts           ← CRUD /api/sa/finance
│           ├── photos.ts            ← رفع صور المشاريع (base64)
│           ├── attachments.ts       ← مرفقات الكيانات (base64)
│           ├── categories.ts        ← فئات المستندات المخصصة
│           ├── notifications.ts     ← الإشعارات
│           ├── users.ts             ← المستخدمون + تسجيل الدخول
│           ├── global.ts            ← البحث الشامل
│           ├── reports.ts           ← التقارير
│           ├── upload.ts            ← رفع الملفات
│           ├── voice.ts             ← التفريغ الصوتي
│           ├── audit.ts             ← سجل التدقيق
│           └── scheduler.ts         ← المجدول الزمني
└── package.json
```

### نقاط API الرئيسية

| Endpoint | الوصف |
|----------|-------|
| `GET /api/sa/dashboard` | إحصائيات لوحة التحكم |
| `GET/POST /api/sa/projects` | المشاريع |
| `GET/POST /api/sa/contracts` | العقود |
| `GET/POST /api/sa/documents` | المستندات |
| `GET/POST /api/sa/meetings` | الاجتماعات |
| `GET/POST /api/sa/letters` | الخطابات |
| `GET/POST /api/sa/contractors` | المقاولون |
| `POST /api/sa/auth/login` | تسجيل الدخول |
| `POST /api/sa/auth/register` | إنشاء حساب |
| `GET /api/sa/search?q=...` | البحث الشامل |

---

## 🗃️ قاعدة البيانات

**حالياً: in-memory store** — البيانات تُخزَّن في الذاكرة وتُمسح عند إعادة تشغيل الخادم.  
الملف المركزي: `artifacts/api-server/src/routes/sa/store.ts`

**مستقبلاً:** الكود مُعدّ لاستقبال Supabase (PostgreSQL) عبر متغيرات البيئة:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 🔌 الارتباطات الخارجية

| الخدمة | الحالة | المتغير |
|--------|--------|---------|
| Supabase | ⏸️ جاهز، غير مُفعّل | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| OpenAI Whisper | ⏸️ جاهز، غير مُفعّل | `VITE_OPENAI_API_KEY` |
| قاعدة بيانات حقيقية | ⏸️ غير مُفعّل | — |

---

## 🚀 تشغيل المشروع

```bash
# تشغيل الخادم الخلفي (port 5000)
pnpm --filter @workspace/api-server run dev

# تشغيل التطبيق الأمامي
pnpm --filter @workspace/smart-archive run dev
```

---

## ⚠️ ملفات محمية — لا تعدّل

الملفات التالية يجب **عدم** تعديلها:
- `artifacts/smart-archive/vite.config.ts`
- `artifacts/smart-archive/tailwind.config.js`
- `artifacts/smart-archive/postcss.config.js`
- أي `package.json` في المشروع

---

## 🎨 التقنيات المستخدمة

| الجانب | التقنية |
|--------|---------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + CSS Variables |
| Routing | React Router v6 |
| State | React Query (TanStack Query) |
| Backend | Express 5 + TypeScript |
| Build | esbuild |
| Package Manager | pnpm workspaces |
