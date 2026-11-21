import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertIcon, BrandMark, LogoutIcon } from "@/components/Icons";
import AdminHome from "@/components/screens/AdminHome";
import AccountantHome from "@/components/screens/AccountantHome";
import EmployeeHome from "@/components/screens/EmployeeHome";
import { isPreviewEnabled } from "@/lib/env";

export const metadata = {
  title: "معاينة التصميم | دفتر الصندوق",
  robots: { index: false, follow: false },
};

type ScreenKey = "accountant" | "employee" | "admin";

const SCREENS: { key: ScreenKey; label: string; role: string }[] = [
  { key: "accountant", label: "المحاسب", role: "المحاسب" },
  { key: "employee", label: "الموظف", role: "موظف" },
  { key: "admin", label: "مدير النظام", role: "مدير النظام" },
];

const ORG_NAME = "مكتب النخبة للخدمات";

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  const { screen } = await searchParams;

  // المعاينة متاحة محلياً فقط أثناء التطوير. في الإنتاج أو عند ربط قاعدة البيانات: 404 نهائي.
  if (!isPreviewEnabled || process.env.NODE_ENV === "production") notFound();

  const active: ScreenKey =
    screen === "admin" || screen === "employee" ? screen : "accountant";

  const activeMeta = SCREENS.find((s) => s.key === active)!;

  const subtitle =
    active === "admin"
      ? "لوحة مدير النظام"
      : active === "employee"
        ? "فرع الملز — شاشة الموظف"
        : "لوحة المحاسب";

  return (
    <div className="min-h-dvh pb-10">
      <header className="no-print sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <BrandMark className="h-10 w-10 shrink-0 text-teal-600" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">
              {ORG_NAME}
            </p>
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
              معاينة
            </span>
            <span className="hidden rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 sm:inline">
              {activeMeta.role}
            </span>
            <Link
              href="/login"
              aria-label="الخروج من المعاينة"
              title="الخروج من المعاينة"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <LogoutIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 pt-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-6 text-amber-900">
          <div className="flex items-start gap-2">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">أنت في وضع المعاينة</p>
              <p className="text-amber-800">
                البيانات المعروضة تجريبية، وقاعدة البيانات غير مربوطة بعد. جرّب
                التنقل بين شاشات الأدوار من الأزرار بالأسفل.
              </p>
              <div className="mt-2">
                <Link
                  href="/login"
                  className="font-semibold text-teal-700 underline underline-offset-4"
                >
                  شاشة تسجيل الدخول
                </Link>
              </div>
            </div>
          </div>
        </div>

        <nav className="no-print mt-4 flex gap-2 overflow-x-auto pb-1">
          {SCREENS.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={`/demo?screen=${item.key}`}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-teal-600 text-white shadow-sm shadow-teal-600/20"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:text-teal-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {active === "admin" ? (
        <AdminHome userName="عبدالله العتيبي" />
      ) : active === "employee" ? (
        <EmployeeHome
          userName="سعود الحربي"
          branchName="فرع الملز"
          officeName={ORG_NAME}
          primaryColor="#0f766e"
          todayDateFormatted="السبت، 21 نوفمبر 2026"
          incomeTypes={[
            { id: "1", name: "خدمات مكتبية", amount_optional: false },
            { id: "2", name: "سداد", amount_optional: false },
            { id: "3", name: "شغل", amount_optional: false },
          ]}
          unpaidDebts={[
            {
              debtId: "d1",
              debtorId: "deb1",
              debtorName: "خالد المنصور",
              remainingAmount: 450,
              originalAmount: 1200,
              date: "2026-11-20",
            },
          ]}
          transactions={[
            {
              id: "t1",
              kind: "income",
              amount: 250,
              description: "خدمات مكتبية: استخراج رخصة",
              time: "02:15 م",
            },
            {
              id: "t2",
              kind: "expense",
              amount: 80,
              description: "قرطاسية: ورق A4",
              time: "01:40 م",
            },
          ]}
          todayIncome={1250}
          todayExpenses={180}
          cashInDrawer={1070}
          dayClosing={null}
        />
      ) : (
        <AccountantHome
          userName="عبدالله العتيبي"
          orgName={ORG_NAME}
          branchCount={3}
        />
      )}

      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            خطة الصفحات القادمة
          </h2>
          <ul className="mt-2 grid gap-1.5 text-xs text-slate-500 sm:grid-cols-2">
            <li>✅ تسجيل الدخول والأدوار</li>
            <li>⏳ الإعدادات (المكتب، الفروع، أنواع الوارد، المستخدمون)</li>
            <li>⏳ الوارد (سداد / شغل) مع إجمالي اليوم</li>
            <li>⏳ المنصرف (نقدي / بنكي)</li>
            <li>⏳ المديونون والديون والسداد الجزئي</li>
            <li>⏳ الحوالات البنكية</li>
            <li>⏳ تقرير نهاية اليوم والإغلاق</li>
            <li>⏳ لوحة المحاسب لكل الفروع</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
