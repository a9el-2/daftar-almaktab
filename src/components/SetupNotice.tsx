import { AlertIcon, BrandMark } from "@/components/Icons";

/**
 * تظهر عندما لا تكون مفاتيح Supabase موجودة في ملف .env.local
 * حتى لا يرى المستخدم شاشة خطأ إنجليزية غامضة.
 */
export default function SetupNotice() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <BrandMark className="h-11 w-11 text-amber-500" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              النظام يحتاج إلى ربط قاعدة البيانات
            </h1>
            <p className="text-sm text-slate-500">خطوة واحدة قبل الاستخدام</p>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-800">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            لم يتم العثور على مفاتيح Supabase. أضفها في ملف{" "}
            <code className="rounded bg-white px-1 py-0.5 text-xs" dir="ltr">
              .env.local
            </code>{" "}
            ثم أعد تشغيل السيرفر.
          </span>
        </div>

        <ol className="mt-5 space-y-2 text-sm leading-7 text-slate-600">
          <li>
            1. أنشئ مشروعاً جديداً على{" "}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-teal-700 underline-offset-4 hover:underline"
            >
              supabase.com
            </a>
          </li>
          <li>
            2. من Project Settings ← API انسخ{" "}
            <code dir="ltr" className="text-xs">Project URL</code> و{" "}
            <code dir="ltr" className="text-xs">anon public</code>
          </li>
          <li>
            3. الصقهما في ملف{" "}
            <code dir="ltr" className="text-xs">.env.local</code> بجانب المشروع
          </li>
          <li>4. أوقف السيرفر (Ctrl+C) ثم شغّله من جديد</li>
        </ol>

        <p className="mt-6 text-center text-xs text-slate-400">
          بعد إضافة المفاتيح وتشغيل ملف الجداول، يتم إنشاء حساب مدير النظام يدوياً من Supabase.
        </p>
      </div>
    </main>
  );
}
