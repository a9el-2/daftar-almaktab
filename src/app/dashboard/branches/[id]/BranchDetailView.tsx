"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BuildingIcon,
  CalendarIcon,
  LockIcon,
  PrinterIcon,
} from "@/components/Icons";
import { reopenDayAction } from "@/app/dashboard/actions";

export type BranchIncomeRow = {
  id: string;
  amount: number;
  profit: number;
  displayType: string;
  isCustom: boolean;
  note: string | null;
  employeeName: string;
  time: string;
};

export type BranchExpenseRow = {
  id: string;
  amount: number;
  recipient_name: string;
  method: "cash" | "bank";
  note: string | null;
  employeeName: string;
  time: string;
};

export type BranchDebtRow = {
  id: string;
  amount: number;
  debtor_name: string;
  note: string | null;
  employeeName: string;
  time: string;
};

export type BranchPaymentRow = {
  id: string;
  amount: number;
  debtor_name: string;
  employeeName: string;
  time: string;
};

export type BranchTransferRow = {
  id: string;
  amount: number;
  statement: string;
  employeeName: string;
  time: string;
};

export type BranchDayClosing = {
  opening_balance: number;
  actual_cash_counted: number | null;
  book_balance: number;
  difference: number | null;
  closed_at: string;
  locked: boolean;
} | null;

export type MonthDaySummary = {
  date: string;
  formattedDate: string;
  dayName: string;
  income: number;
  expense: number;
  payment: number;
  debt: number;
  netCash: number;
  isClosed: boolean;
};

type Props = {
  org: {
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  };
  branch: {
    id: string;
    name: string;
    active: boolean;
  };
  allBranches: Array<{ id: string; name: string }>;
  selectedDate: string;
  formattedDate: string;
  todayDateStr: string;
  dayClosing: BranchDayClosing;
  incomes: BranchIncomeRow[];
  expenses: BranchExpenseRow[];
  debts: BranchDebtRow[];
  debtPayments: BranchPaymentRow[];
  transfers: BranchTransferRow[];
  totals: {
    income: number;
    expense: number;
    payment: number;
    debt: number;
    transfer: number;
    netCash: number;
  };
  selectedMonth: string;
  monthSummary: {
    days: MonthDaySummary[];
    totalIncome: number;
    totalExpense: number;
    totalPayment: number;
    totalDebt: number;
    netCash: number;
  };
};

export default function BranchDetailView({
  org,
  branch,
  allBranches,
  selectedDate,
  formattedDate,
  todayDateStr,
  dayClosing,
  incomes,
  expenses,
  debts,
  debtPayments,
  transfers,
  totals,
  selectedMonth,
  monthSummary,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"daily" | "monthly">("daily");
  const [actionMsg, setActionMsg] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const primaryColor = org.primary_color || "#0f766e";
  const isToday = selectedDate === todayDateStr;
  const isClosed = dayClosing?.locked ?? false;

  const navigateToDate = (targetDate: string) => {
    startTransition(() => {
      router.push(
        `/dashboard/branches/${branch.id}?date=${targetDate}&month=${selectedMonth}`,
      );
    });
  };

  const navigateToMonth = (targetMonth: string) => {
    startTransition(() => {
      router.push(
        `/dashboard/branches/${branch.id}?date=${selectedDate}&month=${targetMonth}`,
      );
    });
  };

  const handleQuickStep = (offsetDays: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + offsetDays);
    const nextDate = cur.toISOString().split("T")[0];
    navigateToDate(nextDate);
  };

  const handleReopenDay = () => {
    if (
      !confirm(
        `هل أنت متأكد من إعادة فتح اليوم (${selectedDate}) للفرع؟ سيتمكن الموظف من تسجيل وتعديل الحركات مجدداً.`,
      )
    ) {
      return;
    }
    setActionMsg(null);
    startTransition(async () => {
      const res = await reopenDayAction(branch.id, selectedDate);
      if (res?.error) {
        setActionMsg({ text: res.error, type: "error" });
      } else {
        setActionMsg({
          text: `تم إعادة فتح اليوم (${selectedDate}) بنجاح.`,
          type: "success",
        });
        router.refresh();
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* 1) أعلى الصفحة: العودة + مبدل الفروع + الترويسة (يختفي عند الطباعة) */}
      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeftIcon className="h-4 w-4 rotate-180" />
            <span>العودة للوحة المحاسب الرئيسية</span>
          </Link>

          {/* مبدل الفروع السريع (الفرع الأول، الفرع الثاني...) */}
          {allBranches.length > 1 && (
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-xs">
              <span className="px-2 text-[11px] font-semibold text-slate-400">
                الفروع:
              </span>
              {allBranches.map((b) => {
                const isSelected = b.id === branch.id;
                return (
                  <Link
                    key={b.id}
                    href={`/dashboard/branches/${b.id}?date=${selectedDate}&month=${selectedMonth}`}
                    style={{
                      backgroundColor: isSelected ? primaryColor : "transparent",
                      color: isSelected ? "#ffffff" : "#475569",
                    }}
                    className={`rounded-xl px-3 py-1 text-xs font-bold transition ${
                      isSelected
                        ? "shadow-xs"
                        : "hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {b.name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* بطاقة معلومات الفرع الحالية */}
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span
              style={{
                backgroundColor: `${primaryColor}15`,
                color: primaryColor,
              }}
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
            >
              <BuildingIcon className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900 sm:text-xl">
                  {branch.name}
                </h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    branch.active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {branch.active ? "نشط" : "معطل"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                سجلات العمليات اليومية والأرشيف التاريخي وتقارير الصندوق
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              style={{ backgroundColor: primaryColor }}
              className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:opacity-95"
            >
              <PrinterIcon className="h-4 w-4" />
              <span>
                طباعة / PDF {activeTab === "daily" ? "كشف اليوم" : "ملخص الشهر"}
              </span>
            </button>
          </div>
        </div>

        {/* رسائل التنبيه والعمليات */}
        {actionMsg && (
          <div
            className={`flex items-center justify-between rounded-2xl p-4 text-xs font-bold ${
              actionMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            <span>{actionMsg.text}</span>
            <button
              onClick={() => setActionMsg(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        )}

        {/* تبويبات الشاشة: سجل اليوم أو ملخص الشهر */}
        <div className="flex border-b border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab("daily")}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
              activeTab === "daily"
                ? "border-[var(--brand-primary)] text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            style={{
              borderColor: activeTab === "daily" ? primaryColor : "transparent",
              color: activeTab === "daily" ? primaryColor : undefined,
            }}
          >
            <CalendarIcon className="h-4 w-4" />
            <span>سجل اليوم والتنقل الزمني</span>
          </button>

          <button
            onClick={() => setActiveTab("monthly")}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
              activeTab === "monthly"
                ? "border-[var(--brand-primary)] text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            style={{
              borderColor: activeTab === "monthly" ? primaryColor : "transparent",
              color: activeTab === "monthly" ? primaryColor : undefined,
            }}
          >
            <BuildingIcon className="h-4 w-4" />
            <span>ملخص نهاية الشهر للفرع</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2) محتوى تبويب: سجل اليوم والتنقل الزمني (Daily View) */}
      {/* ==================================================================== */}
      {activeTab === "daily" && (
        <div className="mt-5 space-y-6">
          {/* شريط محدد التاريخ الذكي والأرشيف (يختفي عند الطباعة) */}
          <div className="no-print rounded-3xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-700">
                  تاريخ اليوم المعروض:
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) navigateToDate(e.target.value);
                  }}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs font-bold text-slate-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                />

                {/* أزرار تنقل سريع */}
                <button
                  type="button"
                  onClick={() => navigateToDate(todayDateStr)}
                  disabled={isToday}
                  className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                    isToday
                      ? "bg-slate-100 text-slate-400 cursor-default"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  اليوم الحالي
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStep(-1)}
                  className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
                  title="اليوم السابق"
                >
                  ← السابق
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickStep(1)}
                  className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
                  title="اليوم التالي"
                >
                  التالي →
                </button>
              </div>

              {/* شارة حالة اليوم وإعادة الفتح للمحاسب */}
              <div className="flex items-center gap-2">
                <span
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                    isClosed
                      ? "bg-amber-50 text-amber-800 border border-amber-200"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {isClosed ? (
                    <>
                      <LockIcon className="h-3.5 w-3.5 text-amber-700" />
                      <span>🔒 اليوم مقفل رسمياً</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>🟢 اليوم مفتوح للتسجيل</span>
                    </>
                  )}
                </span>

                {isClosed && (
                  <button
                    onClick={handleReopenDay}
                    disabled={isPending}
                    className="rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900 transition hover:bg-amber-100"
                  >
                    {isPending ? "جاري الفتح..." : "إعادة فتح اليوم"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* كروت المؤشرات المالية لهذا اليوم المختار */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">
                إجمالي الوارد
              </span>
              <p className="mt-1 font-mono text-lg font-black text-emerald-700 sm:text-xl">
                {totals.income.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                <span className="text-[10px] font-normal">ريال</span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">
                إجمالي المنصرف
              </span>
              <p className="mt-1 font-mono text-lg font-black text-rose-700 sm:text-xl">
                {totals.expense.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                <span className="text-[10px] font-normal">ريال</span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">
                تحصيل سداد الديون
              </span>
              <p className="mt-1 font-mono text-lg font-black text-teal-700 sm:text-xl">
                {totals.payment.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                <span className="text-[10px] font-normal">ريال</span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
              <span className="text-xs font-semibold text-slate-500">
                ديون جديدة آجلة
              </span>
              <p className="mt-1 font-mono text-lg font-black text-amber-700 sm:text-xl">
                {totals.debt.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                <span className="text-[10px] font-normal">ريال</span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-slate-900 p-4 text-white shadow-xs col-span-2 sm:col-span-1">
              <span className="text-xs font-bold text-slate-300">
                صافي نقدية الدرج
              </span>
              <p className="mt-1 font-mono text-lg font-black text-emerald-400 sm:text-xl">
                {totals.netCash.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                <span className="text-[10px] font-normal text-slate-300">
                  ريال
                </span>
              </p>
            </div>
          </div>

          {/* ================================================================ */}
          {/* الجداول التفصيلية الخمسة المنظمة */}
          {/* ================================================================ */}

          {/* 1) جدول الوارد والمبيعات */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900">
                  1. حركة الوارد والمبيعات ({incomes.length})
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-700">
                المجموع:{" "}
                {totals.income.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                ريال
              </span>
            </div>

            {incomes.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">
                لا توجد مدخلات وارد مسجلة في هذا اليوم لهذا الفرع.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">نوع الخدمة</th>
                      <th className="p-3">المبلغ</th>
                      <th className="p-3">الربح</th>
                      <th className="p-3">البيان / الملاحظة</th>
                      <th className="p-3">الموظف</th>
                      <th className="p-3">الوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {incomes.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {row.isCustom ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 border border-teal-200">
                              <span>✨</span>
                              <span>{row.displayType}</span>
                              <span className="text-[9px] text-teal-600 font-normal">
                                (مخصص)
                              </span>
                            </span>
                          ) : (
                            <span>{row.displayType}</span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-700">
                          {row.amount.toLocaleString("ar-SA", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          ريال
                        </td>
                        <td className="p-3 font-mono text-slate-600">
                          {row.profit > 0
                            ? `${row.profit.toLocaleString("ar-SA", {
                                minimumFractionDigits: 2,
                              })} ريال`
                            : "—"}
                        </td>
                        <td className="p-3 text-slate-600 max-w-xs">
                          {row.note || "—"}
                        </td>
                        <td className="p-3 text-slate-700">{row.employeeName}</td>
                        <td className="p-3 font-mono text-slate-400">
                          {row.time}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2) جدول المنصرفات والمصاريف */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <h3 className="text-sm font-bold text-slate-900">
                  2. المصروفات والمنصرف ({expenses.length})
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-rose-700">
                المجموع:{" "}
                {totals.expense.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                ريال
              </span>
            </div>

            {expenses.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">
                لا توجد مصروفات مسجلة في هذا اليوم لهذا الفرع.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">المستلم / الجهة</th>
                      <th className="p-3">المبلغ</th>
                      <th className="p-3">طريقة الدفع</th>
                      <th className="p-3">البيان / الغرض</th>
                      <th className="p-3">الموظف</th>
                      <th className="p-3">الوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {row.recipient_name}
                        </td>
                        <td className="p-3 font-mono font-bold text-rose-700">
                          {row.amount.toLocaleString("ar-SA", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          ريال
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              row.method === "cash"
                                ? "bg-amber-50 text-amber-800"
                                : "bg-sky-50 text-sky-800"
                            }`}
                          >
                            {row.method === "cash" ? "نقداً (كاش)" : "بنكي / شبكة"}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 max-w-xs">
                          {row.note || "—"}
                        </td>
                        <td className="p-3 text-slate-700">{row.employeeName}</td>
                        <td className="p-3 font-mono text-slate-400">
                          {row.time}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3) جدول الديون الجديدة المسجلة اليوم */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">
                  3. الديون الجديدة الآجلة ({debts.length})
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-amber-700">
                المجموع:{" "}
                {totals.debt.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                ريال
              </span>
            </div>

            {debts.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">
                لا توجد ديون جديدة مسجلة في هذا اليوم.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">اسم المديون / العميل</th>
                      <th className="p-3">مبلغ الدين</th>
                      <th className="p-3">البيان / الملاحظة</th>
                      <th className="p-3">الموظف</th>
                      <th className="p-3">الوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {debts.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {row.debtor_name}
                        </td>
                        <td className="p-3 font-mono font-bold text-amber-700">
                          {row.amount.toLocaleString("ar-SA", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          ريال
                        </td>
                        <td className="p-3 text-slate-600 max-w-xs">
                          {row.note || "—"}
                        </td>
                        <td className="p-3 text-slate-700">{row.employeeName}</td>
                        <td className="p-3 font-mono text-slate-400">
                          {row.time}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4) جدول سداد وتحصيل الديون اليوم */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                <h3 className="text-sm font-bold text-slate-900">
                  4. تحصيل وسداد الديون ({debtPayments.length})
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-teal-700">
                المجموع:{" "}
                {totals.payment.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                ريال
              </span>
            </div>

            {debtPayments.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">
                لم يتم تحصيل أي مبالغ سداد ديون في هذا اليوم.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">اسم المسدد / العميل</th>
                      <th className="p-3">المبلغ المحصل</th>
                      <th className="p-3">الموظف المستلم</th>
                      <th className="p-3">الوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {debtPayments.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {row.debtor_name}
                        </td>
                        <td className="p-3 font-mono font-bold text-teal-700">
                          {row.amount.toLocaleString("ar-SA", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          ريال
                        </td>
                        <td className="p-3 text-slate-700">{row.employeeName}</td>
                        <td className="p-3 font-mono text-slate-400">
                          {row.time}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 5) جدول الحوالات البنكية */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                <h3 className="text-sm font-bold text-slate-900">
                  5. الحوالات البنكية ({transfers.length})
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-sky-700">
                المجموع:{" "}
                {totals.transfer.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                ريال
              </span>
            </div>

            {transfers.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">
                لا توجد حوالات مسجلة في هذا اليوم.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3">البيان / التفاصيل</th>
                      <th className="p-3">المبلغ</th>
                      <th className="p-3">الموظف</th>
                      <th className="p-3">الوقت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transfers.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {row.statement}
                        </td>
                        <td className="p-3 font-mono font-bold text-sky-700">
                          {row.amount.toLocaleString("ar-SA", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          ريال
                        </td>
                        <td className="p-3 text-slate-700">{row.employeeName}</td>
                        <td className="p-3 font-mono text-slate-400">
                          {row.time}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* كشف إغلاق ومطابقة الصندوق */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              كشف ومطابقة الصندوق (نهاية اليوم)
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs text-slate-500">رصيد الافتتاح</span>
                <p className="mt-1 font-mono font-bold text-slate-800">
                  {dayClosing?.opening_balance
                    ? dayClosing.opening_balance.toLocaleString("ar-SA", {
                        minimumFractionDigits: 2,
                      })
                    : "0.00"}{" "}
                  ريال
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs text-slate-500">الرصيد الدفتري</span>
                <p className="mt-1 font-mono font-bold text-slate-900">
                  {totals.netCash.toLocaleString("ar-SA", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  ريال
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs text-slate-500">
                  العد الفعلي للنقدية
                </span>
                <p className="mt-1 font-mono font-bold text-teal-800">
                  {dayClosing?.actual_cash_counted !== null &&
                  dayClosing?.actual_cash_counted !== undefined
                    ? `${dayClosing.actual_cash_counted.toLocaleString("ar-SA", {
                        minimumFractionDigits: 2,
                      })} ريال`
                    : "لم يُسجل بعد"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs text-slate-500">الفارق / المطابقة</span>
                <p
                  className={`mt-1 font-mono font-bold ${
                    dayClosing?.difference === 0
                      ? "text-emerald-700"
                      : dayClosing?.difference && dayClosing.difference < 0
                      ? "text-rose-700"
                      : "text-amber-700"
                  }`}
                >
                  {dayClosing?.difference !== null &&
                  dayClosing?.difference !== undefined
                    ? dayClosing.difference === 0
                      ? "مطابق تماماً (0)"
                      : `${dayClosing.difference.toLocaleString("ar-SA", {
                          minimumFractionDigits: 2,
                        })} ريال`
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3) محتوى تبويب: ملخص نهاية الشهر (Monthly Summary View) */}
      {/* ==================================================================== */}
      {activeTab === "monthly" && (
        <div className="mt-5 space-y-6">
          {/* محدد الشهر (يختفي عند الطباعة) */}
          <div className="no-print rounded-3xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">
                  اختر الشهر للملخص:
                </span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    if (e.target.value) navigateToMonth(e.target.value);
                  }}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs font-bold text-slate-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
              >
                <PrinterIcon className="h-3.5 w-3.5" />
                <span>طباعة تقرير الشهر (PDF)</span>
              </button>
            </div>
          </div>

          {/* كروت ملخص الشهر الإجمالية */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs text-slate-500">إجمالي وارد الشهر</span>
              <p className="mt-1 font-mono text-lg font-black text-emerald-700 sm:text-xl">
                {monthSummary.totalIncome.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                <span className="text-xs font-normal">ريال</span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs text-slate-500">إجمالي منصرف الشهر</span>
              <p className="mt-1 font-mono text-lg font-black text-rose-700 sm:text-xl">
                {monthSummary.totalExpense.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                <span className="text-xs font-normal">ريال</span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <span className="text-xs text-slate-500">
                إجمالي تحصيل الديون
              </span>
              <p className="mt-1 font-mono text-lg font-black text-teal-700 sm:text-xl">
                {monthSummary.totalPayment.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                <span className="text-xs font-normal">ريال</span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white shadow-xs">
              <span className="text-xs text-slate-300 font-bold">
                صافي نقدية الشهر
              </span>
              <p className="mt-1 font-mono text-lg font-black text-emerald-400 sm:text-xl">
                {monthSummary.netCash.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                <span className="text-xs font-normal text-slate-300">ريال</span>
              </p>
            </div>
          </div>

          {/* جدول حركة أيام الشهر */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
              <h3 className="text-sm font-bold text-slate-900">
                بيان تفصيلي بالأيام لشهر ({selectedMonth})
              </h3>
            </div>

            {monthSummary.days.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">
                لا توجد حركات مسجلة لهذا الفرع في هذا الشهر.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3">التاريخ / اليوم</th>
                      <th className="p-3">وارد اليوم</th>
                      <th className="p-3">منصرف اليوم</th>
                      <th className="p-3">سداد الديون</th>
                      <th className="p-3">ديون جديدة</th>
                      <th className="p-3">صافي الصندوق</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3 no-print">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthSummary.days.map((d) => (
                      <tr key={d.date} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-800">
                          <div>{d.formattedDate}</div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {d.date}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-700">
                          {d.income.toLocaleString("ar-SA", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-3 font-mono font-bold text-rose-700">
                          {d.expense.toLocaleString("ar-SA", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-3 font-mono text-teal-700">
                          {d.payment.toLocaleString("ar-SA", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-3 font-mono text-amber-700">
                          {d.debt.toLocaleString("ar-SA", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {d.netCash.toLocaleString("ar-SA", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              d.isClosed
                                ? "bg-amber-50 text-amber-800"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {d.isClosed ? "🔒 مقفل" : "🟢 مفتوح"}
                          </span>
                        </td>
                        <td className="p-3 no-print">
                          <button
                            onClick={() => {
                              navigateToDate(d.date);
                              setActiveTab("daily");
                            }}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-teal-700 hover:bg-teal-50"
                          >
                            عرض يوم {d.date.split("-")[2]} ↗
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
                    <tr>
                      <td className="p-3">الإجمالي للشهر</td>
                      <td className="p-3 font-mono text-emerald-800">
                        {monthSummary.totalIncome.toLocaleString("ar-SA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 font-mono text-rose-800">
                        {monthSummary.totalExpense.toLocaleString("ar-SA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 font-mono text-teal-800">
                        {monthSummary.totalPayment.toLocaleString("ar-SA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 font-mono text-amber-800">
                        {monthSummary.totalDebt.toLocaleString("ar-SA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 font-mono text-slate-950">
                        {monthSummary.netCash.toLocaleString("ar-SA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4) ورقة التقرير الرسمي للطباعة فقط (A4 Print-Only Sheet) */}
      {/* ==================================================================== */}
      <div className="print-only hidden font-sans">
        {/* ترويسة التقرير الرسمي */}
        <div className="border-b-2 border-slate-900 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {org.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={org.logo_url}
                  alt={org.name}
                  className="h-14 w-14 object-contain"
                />
              )}
              <div>
                <h1 className="text-xl font-black text-slate-950">{org.name}</h1>
                <p className="text-xs text-slate-600 font-bold">
                  فرع: {branch.name}
                </p>
              </div>
            </div>

            <div className="text-left">
              <span className="inline-block rounded-lg border border-slate-900 px-3 py-1 font-bold text-xs text-slate-900">
                {activeTab === "daily"
                  ? "كشف حركة الصندوق اليومي"
                  : `ملخص حركة الشهر (${selectedMonth})`}
              </span>
              <p className="mt-1 text-xs text-slate-700">
                التاريخ: {activeTab === "daily" ? formattedDate : selectedMonth}
              </p>
              <p className="text-[10px] text-slate-500">
                طُبع بتاريخ: {todayDateStr}
              </p>
            </div>
          </div>
        </div>

        {/* ملخص الأرقام المطبوع */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-lg border border-slate-300 p-2">
            <span className="text-slate-600 block">إجمالي الوارد</span>
            <span className="font-bold text-slate-900 font-mono">
              {(activeTab === "daily"
                ? totals.income
                : monthSummary.totalIncome
              ).toLocaleString("ar-SA", { minimumFractionDigits: 2 })}{" "}
              ريال
            </span>
          </div>

          <div className="rounded-lg border border-slate-300 p-2">
            <span className="text-slate-600 block">إجمالي المنصرف</span>
            <span className="font-bold text-slate-900 font-mono">
              {(activeTab === "daily"
                ? totals.expense
                : monthSummary.totalExpense
              ).toLocaleString("ar-SA", { minimumFractionDigits: 2 })}{" "}
              ريال
            </span>
          </div>

          <div className="rounded-lg border border-slate-300 p-2">
            <span className="text-slate-600 block">سداد الديون</span>
            <span className="font-bold text-slate-900 font-mono">
              {(activeTab === "daily"
                ? totals.payment
                : monthSummary.totalPayment
              ).toLocaleString("ar-SA", { minimumFractionDigits: 2 })}{" "}
              ريال
            </span>
          </div>

          <div className="rounded-lg border-2 border-slate-900 bg-slate-50 p-2">
            <span className="text-slate-900 font-bold block">
              صافي نقدية الدرج
            </span>
            <span className="font-black text-slate-950 font-mono text-sm">
              {(activeTab === "daily"
                ? totals.netCash
                : monthSummary.netCash
              ).toLocaleString("ar-SA", { minimumFractionDigits: 2 })}{" "}
              ريال
            </span>
          </div>
        </div>

        {/* جداول العمليات لليوم (إذا كان كشف يومي) */}
        {activeTab === "daily" && (
          <div className="mt-4 space-y-4">
            {/* 1) الوارد */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 mb-1 border-b border-slate-300 pb-1">
                أولاً: الوارد والمبيعات ({incomes.length} حركة)
              </h4>
              <table className="w-full text-right text-[11px] border border-slate-300">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-1.5 border">#</th>
                    <th className="p-1.5 border">نوع الخدمة</th>
                    <th className="p-1.5 border">المبلغ</th>
                    <th className="p-1.5 border">الربح</th>
                    <th className="p-1.5 border">البيان</th>
                    <th className="p-1.5 border">الموظف</th>
                    <th className="p-1.5 border">الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.map((row, i) => (
                    <tr key={row.id}>
                      <td className="p-1 border text-center">{i + 1}</td>
                      <td className="p-1 border font-bold">
                        {row.displayType}{" "}
                        {row.isCustom ? "(خدمة مخصصة)" : ""}
                      </td>
                      <td className="p-1 border font-mono font-bold">
                        {row.amount.toLocaleString("ar-SA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-1 border font-mono">
                        {row.profit > 0 ? row.profit.toFixed(2) : "—"}
                      </td>
                      <td className="p-1 border">{row.note || "—"}</td>
                      <td className="p-1 border">{row.employeeName}</td>
                      <td className="p-1 border font-mono">{row.time}</td>
                    </tr>
                  ))}
                  {incomes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-2 text-center text-slate-500">
                        لا يوجد وارد مسجل اليوم
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 2) المنصرف */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 mb-1 border-b border-slate-300 pb-1">
                ثانياً: المنصرف والمصروفات ({expenses.length} حركة)
              </h4>
              <table className="w-full text-right text-[11px] border border-slate-300">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-1.5 border">#</th>
                    <th className="p-1.5 border">المستلم</th>
                    <th className="p-1.5 border">المبلغ</th>
                    <th className="p-1.5 border">طريقة الدفع</th>
                    <th className="p-1.5 border">البيان</th>
                    <th className="p-1.5 border">الموظف</th>
                    <th className="p-1.5 border">الوقت</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((row, i) => (
                    <tr key={row.id}>
                      <td className="p-1 border text-center">{i + 1}</td>
                      <td className="p-1 border font-bold">
                        {row.recipient_name}
                      </td>
                      <td className="p-1 border font-mono font-bold">
                        {row.amount.toLocaleString("ar-SA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-1 border">
                        {row.method === "cash" ? "كاش" : "شبكة"}
                      </td>
                      <td className="p-1 border">{row.note || "—"}</td>
                      <td className="p-1 border">{row.employeeName}</td>
                      <td className="p-1 border font-mono">{row.time}</td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-2 text-center text-slate-500">
                        لا توجد مصروفات مسجلة اليوم
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 3) الديون وسداد الديون */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 mb-1 border-b border-slate-300 pb-1">
                  ثالثاً: الديون الجديدة ({debts.length})
                </h4>
                <table className="w-full text-right text-[10px] border border-slate-300">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-1 border">المديون</th>
                      <th className="p-1 border">المبلغ</th>
                      <th className="p-1 border">البيان</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debts.map((row) => (
                      <tr key={row.id}>
                        <td className="p-1 border font-bold">
                          {row.debtor_name}
                        </td>
                        <td className="p-1 border font-mono font-bold">
                          {row.amount.toFixed(2)}
                        </td>
                        <td className="p-1 border">{row.note || "—"}</td>
                      </tr>
                    ))}
                    {debts.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-1.5 text-center text-slate-400">
                          لا توجد ديون جديدة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-900 mb-1 border-b border-slate-300 pb-1">
                  رابعاً: سداد الديون المحصل ({debtPayments.length})
                </h4>
                <table className="w-full text-right text-[10px] border border-slate-300">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-1 border">المسدد</th>
                      <th className="p-1 border">المبلغ المحصل</th>
                      <th className="p-1 border">الموظف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtPayments.map((row) => (
                      <tr key={row.id}>
                        <td className="p-1 border font-bold">
                          {row.debtor_name}
                        </td>
                        <td className="p-1 border font-mono font-bold text-teal-800">
                          {row.amount.toFixed(2)}
                        </td>
                        <td className="p-1 border">{row.employeeName}</td>
                      </tr>
                    ))}
                    {debtPayments.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-1.5 text-center text-slate-400">
                          لا يوجد سداد ديون
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* خانات التوقيع والاعتماد الرسمي */}
        <div className="mt-8 border-t-2 border-dashed border-slate-400 pt-6">
          <div className="grid grid-cols-3 gap-6 text-center text-xs text-slate-800">
            <div>
              <p className="font-bold">الموظف المسؤول</p>
              <div className="mt-10 border-b border-slate-400 w-32 mx-auto" />
              <p className="mt-1 text-[10px] text-slate-400">التوقيع</p>
            </div>

            <div>
              <p className="font-bold">المحاسب المعتمد</p>
              <div className="mt-10 border-b border-slate-400 w-32 mx-auto" />
              <p className="mt-1 text-[10px] text-slate-400">التوقيع والتدقيق</p>
            </div>

            <div>
              <p className="font-bold">ختم المكتب / الإدارة</p>
              <div className="mt-10 border-b border-slate-400 w-32 mx-auto" />
              <p className="mt-1 text-[10px] text-slate-400">الختم الرسمي</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
