# إعداد Supabase — خطوات مطلوبة قبل الاستخدام

## 1. تشغيل SQL لإنشاء جدول الملفات الشخصية

افتح **Supabase Dashboard → SQL Editor** وانسخ هذا الكود وشغّله:

```sql
-- ===================================================
-- جدول الملفات الشخصية للمستخدمين
-- ===================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT UNIQUE NOT NULL,
  full_name        TEXT,
  job_title        TEXT,
  role             TEXT NOT NULL DEFAULT 'employee'
                   CHECK (role IN ('super_admin', 'admin', 'employee')),
  can_upload       BOOLEAN NOT NULL DEFAULT true,
  access_expires_at TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  invited_by       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ===================================================
-- SECURITY DEFINER helper — يقرأ الدور دون recursion
-- ===================================================
-- هذه الدالة تعمل بصلاحية المالك (تتجاوز RLS) مما يمنع
-- الاستدعاء الدائري عند استخدامها داخل policies على نفس الجدول.
CREATE OR REPLACE FUNCTION public.get_my_profile_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ===================================================
-- Row Level Security (RLS)
-- ===================================================
-- تصميم الأمان:
--   • جميع عمليات الكتابة (INSERT / UPDATE / DELETE) تتم حصرياً
--     عبر خادم API باستخدام service_role key الذي يتجاوز RLS.
--   • العميل (anon key) يحق له القراءة فقط.
--   • هذا يمنع تصعيد الصلاحيات عبر PostgREST مباشرة.
-- ===================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- المستخدم يرى ملفه الشخصي دائماً
CREATE POLICY "self_select" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- المدير والمدير الرئيسي يريان جميع الملفات الشخصية
-- يستخدم get_my_profile_role() بدلاً من EXISTS لمنع الاستدعاء الدائري
CREATE POLICY "admin_select_all" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.get_my_profile_role() IN ('admin', 'super_admin'));

-- ملاحظة: لا توجد سياسات INSERT أو UPDATE أو DELETE للـ authenticated role.
-- الكتابة تتم فقط عبر service_role key (خادم API) الذي يتجاوز RLS تلقائياً.
-- هذا يمنع أي مستخدم من تغيير role أو can_upload مباشرةً عبر PostgREST.
```

---

## 2. تفعيل Google OAuth في Supabase

1. افتح **Supabase Dashboard → Authentication → Providers → Google**
2. فعّل Google Provider
3. أدخل **Google Client ID** و **Client Secret** من [Google Cloud Console](https://console.cloud.google.com/)
4. في Google Cloud Console أضف Authorized redirect URI:
   ```
   https://wzfpexcsznfgvdoelvpn.supabase.co/auth/v1/callback
   ```

---

## 3. إضافة Redirect URLs المسموحة

في **Supabase Dashboard → Authentication → URL Configuration**:

**Site URL** (الصفحة الرئيسية بعد تسجيل الدخول):
```
https://<your-replit-domain>/smart-archive/auth/callback
```

**Redirect URLs** (أضف هذا أيضاً):
```
https://<your-replit-domain>/smart-archive/auth/callback
```

(استبدل `<your-replit-domain>` بنطاق Replit الخاص بك، مثال: `abc123.replit.app`)

> **ملاحظة**: رابط الدعوة في البريد الإلكتروني يستخدم Site URL المضبوط هنا.
> تأكد من ضبطه بشكل صحيح قبل إرسال أي دعوات.

---

## 4. إضافة متغيرات البيئة المطلوبة (Replit Secrets)

أضف هذه القيم في Replit Secrets:

| المتغير | القيمة |
|---------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | من Supabase Dashboard → Settings → API → service_role key |
| `ADMIN_EMAIL` | بريد Gmail الخاص بمدير النظام الرئيسي |

---

## 5. لماذا هذا التصميم آمن؟

### منع تصعيد الصلاحيات
جميع عمليات INSERT وUPDATE وDELETE على جدول `profiles` تتم **حصرياً** عبر خادم API
باستخدام `SUPABASE_SERVICE_ROLE_KEY`. مفتاح الخدمة هذا يتجاوز RLS تلقائياً، لذا لا توجد
سياسات كتابة للمستخدمين العاديين — يعني أن أي مستخدم يحاول تغيير `role` أو `can_upload`
مباشرةً عبر PostgREST (anon key) سيُرفض.

### منع الاستدعاء الدائري في RLS
دالة `get_my_profile_role()` تعمل بصلاحية `SECURITY DEFINER` (صلاحية المالك)
فتتجاوز RLS عند الاستعلام الداخلي، مما يحل مشكلة الاستدعاء الدائري التي تحدث
عند استخدام `EXISTS (SELECT 1 FROM public.profiles ...)` داخل policy على نفس الجدول.

### التسلسل الهرمي للصلاحيات مُطبَّق على الخادم
منطق `super_admin > admin > employee` مُطبَّق في `users.ts` على خادم API:
- `super_admin` يمكنه إدارة أي حساب
- `admin` يمكنه إدارة الموظفين فقط (`role = 'employee'`)
- لا يمكن لأحد تعديل حسابات `super_admin` أو تعيين دور يفوق صلاحياته

---

## 6. ملاحظات مهمة

- **SUPABASE_URL** و **SUPABASE_ANON_KEY** تم إعدادهما تلقائياً.
- `SUPABASE_SERVICE_ROLE_KEY` مطلوب لإرسال دعوات الموظفين وإدارة حساباتهم.
- `ADMIN_EMAIL` مطلوب لتعيين المدير الرئيسي تلقائياً عند أول تسجيل دخول.
- بعد تسجيل دخول المدير لأول مرة، سيُنشأ ملفه الشخصي برتبة `super_admin` تلقائياً.
