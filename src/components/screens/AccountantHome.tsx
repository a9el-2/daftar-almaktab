import { BuildingIcon, CheckIcon } from "@/components/Icons";

type Props = {
  userName: string;
  orgName: string;
  branchCount: number;
};

export default function AccountantHome({
  userName,
  orgName,
  branchCount,
}: Props) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <CheckIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900">
              أهلاً، {userName}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <BuildingIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{orgName}</span>
              <span className="text-slate-300">•</span>
              <span>{branchCount} فرع</span>
            </p>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "الإعدادات",
            text: "اسم المكتب، الشعار، الفروع، أنواع الوارد، المستخدمون.",
          },
          {
            title: "متابعة الفروع",
            text: "الوارد والمنصرف والديون لكل فرع في مكان واحد.",
          },
          {
            title: "تقارير اليوم",
            text: "إغلاق اليوم ومقارنة النقد الفعلي مع الدفتر.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4"
          >
            <h2 className="text-sm font-semibold text-slate-900">
              {item.title}
            </h2>
            <p className="mt-1.5 text-xs leading-6 text-slate-500">
              {item.text}
            </p>
          </div>
        ))}
      </section>

      <p className="mt-5 rounded-2xl bg-teal-50/70 px-4 py-3 text-center text-xs leading-6 text-teal-800">
        هذه شاشة مؤقتة بعد تسجيل الدخول. ستُبنى الإعدادات أولاً، ثم الوارد
        والمنصرف والديون وتقرير نهاية اليوم — صفحة واحدة في كل مرة.
      </p>
    </main>
  );
}
