"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertIcon,
  CashIcon,
  CheckIcon,
  PlusIcon,
  Spinner,
  TrendingDownIcon,
  TrendingUpIcon,
} from "@/components/Icons";
import {
  closeDayAction,
  recordBankTransferAction,
  recordDebtAction,
  recordDebtPaymentAction,
  recordExpenseAction,
  recordIncomeAction,
} from "@/app/employee/actions";

export type IncomeType = {
  id: string;
  name: string;
  amount_optional: boolean;
};

export type DebtorWithDebt = {
  debtId: string;
  debtorId: string;
  debtorName: string;
  remainingAmount: number;
  originalAmount: number;
  date: string;
};

export type EmployeeTransaction = {
  id: string;
  kind: "income" | "expense" | "debt_payment" | "debt" | "bank_transfer";
  amount: number;
  description: string;
  time: string;
};

export type DayClosingInfo = {
  locked: boolean;
  actual_cash_counted: number | null;
  book_balance: number;
  difference: number | null;
  closed_at: string;
} | null;

type Props = {
  userName: string;
  branchName: string;
  officeName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  todayDateFormatted: string;
  incomeTypes: IncomeType[];
  unpaidDebts: DebtorWithDebt[];
  transactions: EmployeeTransaction[];
  todayIncome: number;
  todayExpenses: number;
  cashInDrawer: number;
  dayClosing: DayClosingInfo;
};

export default function EmployeeHome({
  userName,
  branchName,
  officeName,
  primaryColor: rawPrimaryColor,
  todayDateFormatted,
  incomeTypes,
  unpaidDebts,
  transactions,
  todayIncome,
  todayExpenses,
  cashInDrawer,
  dayClosing,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Active Modals
  const [activeModal, setActiveModal] = useState<
    "income" | "expense" | "debt" | "payment" | "transfer" | "close_day" | null
  >(null);

  // Alerts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forms State
  // 1) Income Form
  const [incomeTypeId, setIncomeTypeId] = useState(incomeTypes[0]?.id ?? "");
  const [customServiceName, setCustomServiceName] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeProfit, setIncomeProfit] = useState("");
  const [incomeNote, setIncomeNote] = useState("");

  // 2) Expense Form
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseRecipient, setExpenseRecipient] = useState("");
  const [expenseMethod, setExpenseMethod] = useState<"cash" | "network" | "transfer">("cash");
  const [expenseNote, setExpenseNote] = useState("");

  // 3) Debt Form
  const [isNewDebtor, setIsNewDebtor] = useState(true); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [selectedDebtorId, setSelectedDebtorId] = useState(""); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [newDebtorName, setNewDebtorName] = useState("");
  const [debtorPhone, setDebtorPhone] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtProfit, setDebtProfit] = useState("");
  const [debtNote, setDebtNote] = useState("");

  // 4) Debt Payment Form
  const [paymentDebtId, setPaymentDebtId] = useState(unpaidDebts[0]?.debtId ?? "");
  const [paymentAmount, setPaymentAmount] = useState("");

  // 5) Bank Transfer Form
  const [transferType, setTransferType] = useState<"incoming" | "outgoing">("incoming");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferFee, setTransferFee] = useState("");
  const [transferStatement, setTransferStatement] = useState("");

  // 6) Close Day Form
  const [countedCash, setCountedCash] = useState("");

  const primaryColor = rawPrimaryColor || "#0f766e";
  const isClosed = dayClosing?.locked ?? false;

  const resetFormState = () => {
    setErrorMsg(null);
    setIncomeAmount("");
    setIncomeProfit("");
    setIncomeNote("");
    setCustomServiceName("");
    setExpenseAmount("");
    setExpenseRecipient("");
    setExpenseNote("");
    setDebtAmount("");
    setDebtProfit("");
    setDebtNote("");
    setNewDebtorName("");
    setDebtorPhone("");
    setPaymentAmount("");
    setTransferAmount("");
    setTransferFee("");
    setTransferStatement("");
    setCountedCash("");
  };

  const closeModal = () => {
    setActiveModal(null);
    resetFormState();
  };

  // Submission Handlers
  const handleIncomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData();
    fd.append("typeId", incomeTypeId);
    if (incomeTypeId === "custom") {
      fd.append("customName", customServiceName);
    }
    fd.append("amount", incomeAmount);
    fd.append("profit", incomeProfit || "0");
    fd.append("note", incomeNote);

    startTransition(async () => {
      const res = await recordIncomeAction(fd);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("تم تسجيل الوارد بنجاح.");
        closeModal();
        router.refresh();
      }
    });
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData();
    fd.append("amount", expenseAmount);
    fd.append("recipientName", expenseRecipient);
    fd.append("method", expenseMethod);
    fd.append("note", expenseNote);

    startTransition(async () => {
      const res = await recordExpenseAction(fd);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("تم تسجيل المنصرف بنجاح.");
        closeModal();
        router.refresh();
      }
    });
  };

  const handleDebtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData();
    if (isNewDebtor) {
      fd.append("newDebtorName", newDebtorName);
      fd.append("debtorPhone", debtorPhone);
    } else {
      fd.append("debtorId", selectedDebtorId);
    }
    fd.append("amount", debtAmount);
    fd.append("profit", debtProfit || "0");
    fd.append("note", debtNote);

    startTransition(async () => {
      const res = await recordDebtAction(fd);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("تم تسجيل الدين بنجاح.");
        closeModal();
        router.refresh();
      }
    });
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData();
    fd.append("debtId", paymentDebtId);
    fd.append("amount", paymentAmount);

    startTransition(async () => {
      const res = await recordDebtPaymentAction(fd);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("تم تسجيل سداد الدين واستلام المبلغ في الدرج.");
        closeModal();
        router.refresh();
      }
    });
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData();
    fd.append("type", transferType);
    fd.append("amount", transferAmount);
    fd.append("fee", transferFee || "0");
    fd.append("statement", transferStatement);

    startTransition(async () => {
      const res = await recordBankTransferAction(fd);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("تم تسجيل الحوالة البنكية بنجاح.");
        closeModal();
        router.refresh();
      }
    });
  };

  const handleCloseDaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData();
    fd.append("actualCash", countedCash);

    startTransition(async () => {
      const res = await closeDayAction(fd);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg("تم إغلاق اليوم ومطابقة الصندوق بنجاح.");
        closeModal();
        router.refresh();
      }
    });
  };

  const selectedDebt = unpaidDebts.find((d) => d.debtId === paymentDebtId);

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-5 pb-20">
      {/* 1) بطاقة الترحيب والفرع */}
      <section className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">
              {officeName} • {branchName}
            </span>
            <h1 className="mt-0.5 text-lg font-bold text-slate-900">
              أهلاً، {userName}
            </h1>
            <p className="mt-1 text-xs text-slate-400">{todayDateFormatted}</p>
          </div>

          <div>
            {isClosed ? (
              <span className="flex items-center gap-1.5 rounded-2xl bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
                🔒 اليوم مغلق
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-2xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                اليوم مفتوح
              </span>
            )}
          </div>
        </div>
      </section>

      {/* التنبيهات العامة */}
      {successMsg && (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
          <div className="flex items-center gap-2">
            <AlertIcon className="h-4 w-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {isClosed && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs leading-6 text-amber-900">
          <p className="font-bold">⚠️ تم إغلاق حركة اليوم وقفل الصندوق لهذا الفرع.</p>
          <p className="mt-0.5 text-[11px] text-amber-700">
            تم جرد النقدية وتأكيد الإغلاق. إذا تطلب الأمر تسجيل حركات إضافية، يرجى طلب إعادة فتح اليوم من المحاسب.
          </p>
        </div>
      )}

      {/* 2) شريط النقدية الحالية بالدرج ومؤشرات اليوم */}
      <section className="mt-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">
            النقدية الحالية بالدرج
          </span>
          <span
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
            className="rounded-xl p-2"
          >
            <CashIcon className="h-4 w-4" />
          </span>
        </div>
        <p
          style={{ color: primaryColor }}
          className="mt-1 text-2xl font-black font-mono"
        >
          {cashInDrawer.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}{" "}
          <span className="text-xs font-normal">ريال</span>
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          <div className="rounded-xl bg-slate-50 p-2.5">
            <span className="text-[11px] font-semibold text-slate-500">
              وارد اليوم
            </span>
            <p className="mt-0.5 text-sm font-bold text-emerald-700 font-mono">
              +{todayIncome.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2.5">
            <span className="text-[11px] font-semibold text-slate-500">
              منصرف اليوم
            </span>
            <p className="mt-0.5 text-sm font-bold text-rose-700 font-mono">
              -{todayExpenses.toLocaleString("ar-SA", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </section>

      {/* 3) أزرار الإدخال السريع (Quick Actions - Mobile-First Large Tap Targets) */}
      <section className="mt-4 grid grid-cols-2 gap-2.5">
        {/* زر تسجيل وارد */}
        <button
          onClick={() => {
            resetFormState();
            setActiveModal("income");
          }}
          disabled={isClosed}
          className="flex flex-col items-start justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-3.5 text-right transition hover:bg-emerald-100/60 active:scale-95 disabled:opacity-50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <TrendingUpIcon className="h-5 w-5" />
          </span>
          <div className="mt-3">
            <p className="text-sm font-bold text-emerald-950">تسجيل وارد</p>
            <p className="text-[11px] text-emerald-700">دخل خدمة أو معاملة</p>
          </div>
        </button>

        {/* زر تسجيل منصرف */}
        <button
          onClick={() => {
            resetFormState();
            setActiveModal("expense");
          }}
          disabled={isClosed}
          className="flex flex-col items-start justify-between rounded-2xl border border-rose-200/80 bg-rose-50/70 p-3.5 text-right transition hover:bg-rose-100/60 active:scale-95 disabled:opacity-50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
            <TrendingDownIcon className="h-5 w-5" />
          </span>
          <div className="mt-3">
            <p className="text-sm font-bold text-rose-950">تسجيل منصرف</p>
            <p className="text-[11px] text-rose-700">مصاريف، مشتريات، عهد</p>
          </div>
        </button>

        {/* زر دفتر الديون */}
        <button
          onClick={() => {
            resetFormState();
            setActiveModal("debt");
          }}
          disabled={isClosed}
          className="flex flex-col items-start justify-between rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-right transition hover:bg-amber-100/60 active:scale-95 disabled:opacity-50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm">
            <PlusIcon className="h-5 w-5" />
          </span>
          <div className="mt-3">
            <p className="text-sm font-bold text-amber-950">تسجيل دين</p>
            <p className="text-[11px] text-amber-700">دين جديد على عميل</p>
          </div>
        </button>

        {/* زر سداد دين */}
        <button
          onClick={() => {
            resetFormState();
            setActiveModal("payment");
          }}
          disabled={isClosed || unpaidDebts.length === 0}
          className="flex flex-col items-start justify-between rounded-2xl border border-teal-200/80 bg-teal-50/70 p-3.5 text-right transition hover:bg-teal-100/60 active:scale-95 disabled:opacity-50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
            <CashIcon className="h-5 w-5" />
          </span>
          <div className="mt-3">
            <p className="text-sm font-bold text-teal-950">سداد دين</p>
            <p className="text-[11px] text-teal-700">
              استلام دفعة ({unpaidDebts.length} دين)
            </p>
          </div>
        </button>
      </section>

      {/* زر الحوالة البنكية وزر إغلاق اليوم */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <button
          onClick={() => {
            resetFormState();
            setActiveModal("transfer");
          }}
          disabled={isClosed}
          className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <span>🏦 تسجيل حوالة</span>
        </button>

        <button
          onClick={() => {
            resetFormState();
            setCountedCash(cashInDrawer.toString());
            setActiveModal("close_day");
          }}
          disabled={isClosed}
          style={{ backgroundColor: primaryColor }}
          className="flex items-center justify-center gap-2 rounded-2xl py-3 px-4 text-xs font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
        >
          <span>🔒 إغلاق اليوم والجرد</span>
        </button>
      </div>

      {/* 4) سجل حركات اليوم المسجلة في هذا الفرع */}
      <section className="mt-6 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <h2 className="text-sm font-bold text-slate-900">
            حركات اليوم ({transactions.length})
          </h2>
          <span className="text-[11px] text-slate-400">
            تحديث فوري • عرض فقط
          </span>
        </div>

        {transactions.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">
            لم تسجل أي حركة اليوم في هذا الفرع بعد.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0 flex items-center gap-2.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                      t.kind === "income"
                        ? "bg-emerald-50 text-emerald-700"
                        : t.kind === "expense"
                        ? "bg-rose-50 text-rose-700"
                        : t.kind === "debt_payment"
                        ? "bg-teal-50 text-teal-700"
                        : t.kind === "debt"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-sky-50 text-sky-700"
                    }`}
                  >
                    {t.kind === "income" && "↓"}
                    {t.kind === "expense" && "↑"}
                    {t.kind === "debt_payment" && "✓"}
                    {t.kind === "debt" && "⏳"}
                    {t.kind === "bank_transfer" && "⇄"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {t.description}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {t.time}
                    </p>
                  </div>
                </div>

                <div className="text-left shrink-0 font-mono text-sm font-bold">
                  <span
                    className={
                      t.kind === "expense" ? "text-rose-600" : "text-emerald-700"
                    }
                  >
                    {t.kind === "expense" ? "-" : "+"}
                    {t.amount.toLocaleString("ar-SA", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* النوافذ المنبثقة للعمليات السريعة (Bottom Sheet / Modal Mobile Friendly) */}
      {/* ========================================================================= */}

      {/* نافذة تسجيل وارد */}
      {activeModal === "income" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">تسجيل وارد جديد</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleIncomeSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  المبلغ (ريال) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نوع الخدمة / الوارد *
                </label>
                <select
                  required
                  value={incomeTypeId}
                  onChange={(e) => setIncomeTypeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white focus:border-teal-600 focus:outline-none"
                >
                  {incomeTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  <option value="custom" className="font-bold text-teal-700">
                    ✨ خدمة مخصصة (كتابة يدوية...)
                  </option>
                </select>
              </div>

              {incomeTypeId === "custom" && (
                <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3">
                  <label className="block text-xs font-bold text-teal-900 mb-1">
                    اسم الخدمة / المعاملة المخصصة *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="اكتب اسم الخدمة هنا (مثال: تصوير، استشارة، معاملة خاصة...)"
                    value={customServiceName}
                    onChange={(e) => setCustomServiceName(e.target.value)}
                    className="w-full rounded-xl border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-teal-600 focus:outline-none"
                    autoFocus
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الربح (اختياري)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={incomeProfit}
                  onChange={(e) => setIncomeProfit(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  البيان / ملاحظات العميل
                </label>
                <input
                  type="text"
                  placeholder="مثال: تصوير مستندات، استخراج رخصة..."
                  value={incomeNote}
                  onChange={(e) => setIncomeNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-1/3 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-2/3 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isPending && <Spinner className="h-4 w-4" />}
                  <span>حفظ الوارد</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تسجيل منصرف */}
      {activeModal === "expense" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">تسجيل منصرف جديد</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  المبلغ (ريال) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم المستلم / الجهة *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: بقالة، كهربائي، مكتبة..."
                  value={expenseRecipient}
                  onChange={(e) => setExpenseRecipient(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  طريقة الدفع *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "cash", label: "نقداً (الدرج)" },
                    { id: "network", label: "شبكة / مدى" },
                    { id: "transfer", label: "تحويل بنكي" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setExpenseMethod(m.id as "cash" | "network" | "transfer")
                      }
                      className={`rounded-xl border py-2 text-xs font-semibold transition ${
                        expenseMethod === m.id
                          ? "border-rose-600 bg-rose-50 text-rose-700 font-bold"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  البيان / الغرض من الصرف
                </label>
                <input
                  type="text"
                  placeholder="مثال: شراء ورق تصوير A4، بنزين..."
                  value={expenseNote}
                  onChange={(e) => setExpenseNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-1/3 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-2/3 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isPending && <Spinner className="h-4 w-4" />}
                  <span>حفظ المنصرف</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تسجيل دين جديد */}
      {activeModal === "debt" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">تسجيل مديونية جديدة</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleDebtSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم العميل المدين *
                </label>
                <input
                  type="text"
                  required
                  placeholder="اسم الشخص أو المؤسسة"
                  value={newDebtorName}
                  onChange={(e) => setNewDebtorName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  رقم جوال العميل (اختياري)
                </label>
                <input
                  type="tel"
                  placeholder="05XXXXXXXX"
                  value={debtorPhone}
                  onChange={(e) => setDebtorPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  مبلغ الدين (ريال) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  البيان / ملاحظات
                </label>
                <input
                  type="text"
                  placeholder="مثال: باقي حساب معاملة رقم..."
                  value={debtNote}
                  onChange={(e) => setDebtNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-1/3 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-2/3 rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isPending && <Spinner className="h-4 w-4" />}
                  <span>حفظ الدين</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة سداد دين */}
      {activeModal === "payment" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">تسجيل سداد دين</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اختر الدين / العميل *
                </label>
                <select
                  required
                  value={paymentDebtId}
                  onChange={(e) => {
                    setPaymentDebtId(e.target.value);
                    const debt = unpaidDebts.find((d) => d.debtId === e.target.value);
                    if (debt) setPaymentAmount(debt.remainingAmount.toString());
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white focus:border-teal-600 focus:outline-none"
                >
                  {unpaidDebts.map((d) => (
                    <option key={d.debtId} value={d.debtId}>
                      {d.debtorName} — المتبقي: {d.remainingAmount} ريال
                    </option>
                  ))}
                </select>
              </div>

              {selectedDebt && (
                <div className="rounded-xl bg-teal-50/70 p-3 text-xs text-teal-900">
                  <div className="flex justify-between">
                    <span>العميل: {selectedDebt.debtorName}</span>
                    <span className="font-bold">المتبقي: {selectedDebt.remainingAmount} ريال</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  المبلغ المسدد نقداً (ريال) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-1/3 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-2/3 rounded-xl bg-teal-600 py-2.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isPending && <Spinner className="h-4 w-4" />}
                  <span>تأكيد السداد واستلام النقدية</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تسجيل حوالة بنكية */}
      {activeModal === "transfer" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">تسجيل حوالة بنكية</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نوع الحوالة *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferType("incoming")}
                    className={`rounded-xl border py-2 text-xs font-semibold transition ${
                      transferType === "incoming"
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-bold"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    حوالة واردة (استلام)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferType("outgoing")}
                    className={`rounded-xl border py-2 text-xs font-semibold transition ${
                      transferType === "outgoing"
                        ? "border-sky-600 bg-sky-50 text-sky-700 font-bold"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    حوالة صادرة (إرسال)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  المبلغ (ريال) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base font-bold text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الرسوم البنكية (إن وجدت)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={transferFee}
                  onChange={(e) => setTransferFee(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  البيان / البنك أو اسم العميل *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تحويل الراجحي من مؤسسة الأمل..."
                  value={transferStatement}
                  onChange={(e) => setTransferStatement(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-1/3 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-2/3 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isPending && <Spinner className="h-4 w-4" />}
                  <span>حفظ الحوالة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة إغلاق اليوم ومطابقة الصندوق */}
      {activeModal === "close_day" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">إغلاق الصندوق لليوم</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCloseDaySubmit} className="mt-4 space-y-3.5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">الرصيد الدفتري المسجل:</span>
                  <span className="font-bold font-mono text-slate-900">
                    {cashInDrawer.toLocaleString("ar-SA", { minimumFractionDigits: 2 })} ريال
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  النقدية الفعلية المعدودة في الدرج (ريال) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-lg font-black text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              {countedCash && !isNaN(parseFloat(countedCash)) && (
                <div
                  className={`rounded-xl p-3 text-xs font-semibold ${
                    parseFloat(countedCash) === cashInDrawer
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  {parseFloat(countedCash) === cashInDrawer ? (
                    <p>✓ المبلغ الفعلي مطابق للرصيد الدفتري تماماً.</p>
                  ) : (
                    <p>
                      ⚠️ فارق في النقدية:{" "}
                      {parseFloat(countedCash) - cashInDrawer > 0
                        ? `+${(parseFloat(countedCash) - cashInDrawer).toFixed(2)} فائض بالدرج`
                        : `${(parseFloat(countedCash) - cashInDrawer).toFixed(2)} عجز بالدرج`}
                    </p>
                  )}
                </div>
              )}

              <p className="text-[11px] text-amber-700">
                تنبيه: بعد تأكيد الإغلاق، سيتم قفل اليوم ولن تتمكن من تسجيل أو تعديل أي حركة لهذا اليوم إلا بإذن المحاسب.
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="w-1/3 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{ backgroundColor: primaryColor }}
                  className="w-2/3 rounded-xl py-2.5 text-xs font-bold text-white hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isPending && <Spinner className="h-4 w-4" />}
                  <span>تأكيد وقفل اليوم</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
