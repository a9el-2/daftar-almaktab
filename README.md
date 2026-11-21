# دفتر الصندوق اليومي

نظام ويب للمكاتب الخدمية: تسجيل الوارد والمنصرف والديون والحوالات يومياً، مع لوحة متابعة
للمحاسب لكل الفروع، وإغلاق يومي مقفل.

- **الواجهة:** Next.js 15 + Tailwind CSS (عربي، من اليمين لليسار، مصمم للجوال أولاً)
- **قاعدة البيانات والدخول:** Supabase (PostgreSQL + Auth + RLS)
- **التعدد:** كل مكتب (منظمة) معزول تماماً عن المكاتب الأخرى على مستوى قاعدة البيانات

## ✅ ما اكتمل حتى الآن (الخطوة 1 - بعد المعالجة الأمنية)

1. تهيئة المشروع بالكامل.
2. مخطط قاعدة البيانات `supabase/schema.sql`:
   - كل الجداول المطلوبة (المكاتب، الفروع، المستخدمون، الوارد، المنصرف، المديونون،
     الديون، سداد الديون، الحوالات، إغلاق اليوم).
   - سياسات Row Level Security لكل دور ولكل جدول.
   - قفل الأيام المغلقة تلقائياً (لا إدخال ولا تعديل ولا حذف).
   - منع الموظف من التعديل والحذف نهائياً (في قاعدة البيانات وليس في الواجهة فقط).
   - منع تصعيد الصلاحيات (محاسب لا يستطيع إنشاء مدير نظام أو تغيير دوره).
   - إجبار تغيير كلمة المرور عند أول دخول (`must_change_password`) مطبق على السيرفر وقاعدة البيانات.
   - المبالغ `numeric(14,2)` وليست أرقاماً عشرية عائمة.
3. صفحة تسجيل الدخول + تحويل كل دور لصفحته:
   - مدير النظام ← `/admin`
   - المحاسب ← `/dashboard`
   - الموظف ← `/employee`
4. صفحة إجبار تغيير كلمة السر `/change-password` لحماية الحسابات الجديدة.
5. صفحات مؤقتة لكل دور + تسجيل خروج + شاشة "الحساب موقوف / المكتب موقوف".
6. **وضع المعاينة (أثناء التطوير المحلي فقط):** يفتح الموقع على `/demo` ويعرض شاشات الأدوار
   الثلاث ببيانات تجريبية، ومستحيل العمل نهائياً في بيئة الإنتاج (`NODE_ENV = production`).

## 🚀 التشغيل أول مرة

### 1) إنشاء مشروع Supabase وضبط الأمان

1. ادخل إلى [supabase.com](https://supabase.com) وأنشئ مشروعاً جديداً (اختر منطقة قريبة مثل `Middle East (Bahrain)` إن توفرت).
2. احتفظ بكلمة مرور قاعدة البيانات في مكان آمن.
3. **مهم جداً (تعطيل التسجيل العام):** من لوحة Supabase اذهب إلى:
   **Authentication ← Providers ← Email**
   ثم عطّل خيار **`Allow new users to sign up` (أو Enable Sign Up)**.
   > يجب أن يكون التسجيل العام معطلاً لأن جميع الحسابات تُنشأ من قبل الإدارة فقط، ولا يُسمح بالتسجيل الذاتي.

### 2) إنشاء الجداول

1. من لوحة Supabase: **SQL Editor ← New query**.
2. افتح ملف `supabase/schema.sql` وانسخ كامل محتواه والصقه.
3. اضغط **Run**. يجب أن تظهر رسالة `Success. No rows returned`.

### 3) المفاتيح

من **Project Settings ← API** انسخ:

- `Project URL`
- `anon public`
- `service_role` (سري — للسيرفر فقط)

ثم افتح ملف `.env.local` واملأ:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
```

### 4) إنشاء أول مدير نظام (Super Admin) يدوياً

1. من لوحة Supabase: اذهب إلى **Authentication ← Users**.
2. اضغط **Add user ← Create user**.
3. أدخل بريدك الإلكتروني وكلمة مرور قوية واختر `Auto Confirm User?` (مفعّل).
4. اذهب إلى **SQL Editor ← New query** والصق الأمر التالي (مع استبدال بريدك):

```sql
insert into public.profiles (user_id, role, full_name, active, must_change_password)
select id, 'super_admin', 'مدير النظام', true, false
from auth.users
where email = 'your-email@example.com'
on conflict (user_id) do update
set role = 'super_admin',
    must_change_password = false,
    active = true;
```

5. اضغط **Run**. الآن حسابك جاهز كمدير نظام بصلاحيات كاملة ولن يُجبر على تغيير كلمة السر.

### 5) تشغيل الموقع

```bash
npm install
npm run dev
```

افتح: <http://localhost:3000> وسجّل الدخول بحساب مدير النظام.

## 🗂️ بنية المشروع

```
src/
  app/
    login/            صفحة الدخول + Server Action
    change-password/  إجبار تعيين كلمة مرور جديدة + Server Action
    admin/            لوحة مدير النظام (مؤقتة)
    dashboard/        لوحة المحاسب (مؤقتة)
    employee/         شاشة الموظف (مؤقتة)
    pending/          حساب غير مرتبط/موقوف
    demo/             معاينة التصميم (محلية فقط)
  components/         مكونات الواجهة (الشعار، الأيقونات، الهيدر)
  lib/
    auth.ts           قراءة الجلسة، الصلاحيات، وإجبار تغيير كلمة السر
    supabase/         عملاء Supabase (سيرفر / أدمن / middleware)
    env.ts            قراءة متغيرات البيئة العامة
```
