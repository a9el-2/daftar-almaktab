import { CheckIcon } from "@/components/Icons";

type Props = { userName: string };

export default function AdminHome({ userName }: Props) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <CheckIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              أهلاً، {userName}
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              تم تسجيل الدخول بنجاح بصفة مدير النظام. هذه الصفحة ستكون مركز إدارة
              المكاتب والاشتراكات.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">ما يعمل الآن</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
            <li>• تسجيل الدخول وتحويل كل دور إلى صفحته.</li>
            <li>• عزل بيانات كل مكتب في قاعدة البيانات.</li>
            <li>• إيقاف أي مكتب أو مستخدم فوراً من قاعدة البيانات.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
          <h2 className="text-sm font-semibold text-slate-900">الخطوة التالية</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            إنشاء المكاتب والفروع وحسابات المحاسبين من داخل الموقع (بدلاً من
            SQL).
          </p>
        </div>
      </section>

      <p className="mt-5 text-center text-xs leading-6 text-slate-400">
        مدير النظام لا يرى بيانات الوارد والمنصرف والديون الخاصة بالمكاتب، حمايةً
        لخصوصية المشتركين.
      </p>
    </main>
  );
}
