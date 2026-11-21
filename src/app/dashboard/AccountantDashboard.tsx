"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertIcon,
  BuildingIcon,
  CashIcon,
  CheckIcon,
  CopyIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  PlusIcon,
  PrinterIcon,
  RefreshIcon,
  Spinner,
  TrashIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
  WhatsAppIcon,
} from "@/components/Icons";
import { generateSecurePassword } from "@/lib/password";
import {
  createBranchAction,
  createEmployeeAction,
  createIncomeTypeAction,
  deleteIncomeTypeAction,
  reopenDayAction,
  resetEmployeePasswordAction,
  toggleBranchStatusAction,
  toggleEmployeeStatusAction,
  toggleIncomeTypeAction,
  updateIncomeTypeAction,
  type DashboardActionResult,
} from "./actions";

export type DashboardBranch = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  employeeCount: number;
  todayIncome: number;
  todayExpenses: number;
  todayNetCash: number;
  todayTransactionCount: number;
  isClosed: boolean;
  dayClosing?: {
    opening_balance: number;
    actual_cash_counted: number | null;
    book_balance: number;
    difference: number | null;
    closed_at: string;
    locked: boolean;
  } | null;
};

export type DashboardEmployee = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  branch_id: string | null;
  branch_name: string;
  active: boolean;
  must_change_password: boolean;
  created_at: string;
};

export type DashboardTransaction = {
  id: string;
  kind: "income" | "expense" | "debt_payment" | "debt" | "bank_transfer";
  branchName: string;
  amount: number;
  description: string;
  time: string;
};

export type DashboardOrg = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

export type DashboardIncomeType = {
  id: string;
  name: string;
  amount_optional: boolean;
  active: boolean;
  created_at: string;
};

type Props = {
  org: DashboardOrg;
  todayDateStr: string;
  todayFormatted: string;
  branches: DashboardBranch[];
  employees: DashboardEmployee[];
  transactions: DashboardTransaction[];
  totalIncome: number;
  totalExpenses: number;
  netCashInDrawer: number;
  totalDebtPayments: number;
  incomeTypes?: DashboardIncomeType[];
};

export default function AccountantDashboard({
  org,
  todayDateStr,
  todayFormatted,
  branches: initialBranches,
  employees: initialEmployees,
  transactions,
  totalIncome,
  totalExpenses,
  netCashInDrawer,
  totalDebtPayments,
  incomeTypes: initialIncomeTypes = [],
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "live" | "branches" | "employees" | "services" | "report"
  >("live");

  const [branches, setBranches] = useState(initialBranches);
  const [employees, setEmployees] = useState(initialEmployees);
  const [incomeTypes, setIncomeTypes] = useState(initialIncomeTypes);

  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals & alerts
  const [isCreateBranchOpen, setIsCreateBranchOpen] = useState(false);
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false);
  const [isCreateServiceOpen, setIsCreateServiceOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [editingService, setEditingService] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editServiceName, setEditServiceName] = useState("");
  const [credentialsModal, setCredentialsModal] = useState<
    DashboardActionResult["credentials"] | null
  >(null);

  // Forms state
  const [newBranchName, setNewBranchName] = useState("");
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [newEmployeeBranchId, setNewEmployeeBranchId] = useState(
    branches[0]?.id ?? "",
  );
  const [newEmployeePassword, setNewEmployeePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const primaryColor = org.primary_color || "#0f766e";

  const handleRefresh = () => {
    setIsRefreshing(true);
    startTransition(() => {
      router.refresh();
      setTimeout(() => setIsRefreshing(false), 500);
    });
  };

  const openCreateEmployeeModal = () => {
    setNewEmployeeName("");
    setNewEmployeeEmail("");
    setNewEmployeeBranchId(branches[0]?.id ?? "");
    setNewEmployeePassword(generateSecurePassword(12));
    setActionError(null);
    setIsCreateEmployeeOpen(true);
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    const formData = new FormData();
    formData.append("name", newBranchName);

    startTransition(async () => {
      const res = await createBranchAction(formData);
      if (res?.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(`تم إنشاء فرع "${newBranchName}" بنجاح.`);
        setNewBranchName("");
        setIsCreateBranchOpen(false);
        router.refresh();
      }
    });
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    const formData = new FormData();
    formData.append("fullName", newEmployeeName);
    formData.append("email", newEmployeeEmail);
    formData.append("branchId", newEmployeeBranchId);
    formData.append("tempPassword", newEmployeePassword);

    startTransition(async () => {
      const res = await createEmployeeAction(formData);
      if (res?.error) {
        setActionError(res.error);
      } else if (res?.credentials) {
        setIsCreateEmployeeOpen(false);
        setCredentialsModal(res.credentials);
        router.refresh();
      }
    });
  };

  const handleToggleBranch = (branchId: string, currentActive: boolean) => {
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const res = await toggleBranchStatusAction(branchId, currentActive);
      if (res?.error) {
        setActionError(res.error);
      } else {
        setBranches((prev) =>
          prev.map((b) =>
            b.id === branchId ? { ...b, active: !currentActive } : b,
          ),
        );
        setActionSuccess(
          `تم ${currentActive ? "إيقاف" : "تفعيل"} الفرع بنجاح.`,
        );
      }
    });
  };

  const handleToggleEmployee = (userId: string, currentActive: boolean) => {
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const res = await toggleEmployeeStatusAction(userId, currentActive);
      if (res?.error) {
        setActionError(res.error);
      } else {
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.user_id === userId ? { ...emp, active: !currentActive } : emp,
          ),
        );
        setActionSuccess(
          `تم ${currentActive ? "إيقاف" : "تفعيل"} حساب الموظف بنجاح.`,
        );
      }
    });
  };

  const handleResetPassword = (userId: string) => {
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const res = await resetEmployeePasswordAction(userId);
      if (res?.error) {
        setActionError(res.error);
      } else if (res?.credentials) {
        setCredentialsModal(res.credentials);
      }
    });
  };

  const handleReopenDay = (branchId: string, branchName: string) => {
    if (
      !confirm(
        `هل أنت متأكد من إعادة فتح اليوم لفرع "${branchName}"؟ سيتمكن موظف الفرع من تسجيل حركات إضافية.`,
      )
    ) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const res = await reopenDayAction(branchId, todayDateStr);
      if (res?.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(`تمت إعادة فتح اليوم لفرع "${branchName}" بنجاح.`);
        router.refresh();
      }
    });
  };

  const handleCopyCredentials = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    setActiveTab("report");
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    const fd = new FormData();
    fd.append("name", newServiceName);
    startTransition(async () => {
      const res = await createIncomeTypeAction(fd);
      if (res?.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(`تم إضافة نوع الخدمة "${newServiceName}" بنجاح.`);
        setNewServiceName("");
        setIsCreateServiceOpen(false);
        router.refresh();
      }
    });
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const res = await updateIncomeTypeAction(editingService.id, editServiceName);
      if (res?.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(`تم تعديل مسمى الخدمة إلى "${editServiceName}" بنجاح.`);
        setIncomeTypes((prev) =>
          prev.map((s) => (s.id === editingService.id ? { ...s, name: editServiceName } : s))
        );
        setEditingService(null);
        router.refresh();
      }
    });
  };

  const handleToggleService = (typeId: string, currentActive: boolean) => {
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const res = await toggleIncomeTypeAction(typeId, currentActive);
      if (res?.error) {
        setActionError(res.error);
      } else {
        setIncomeTypes((prev) =>
          prev.map((s) => (s.id === typeId ? { ...s, active: !currentActive } : s))
        );
        setActionSuccess(`تم ${currentActive ? "تعطيل" : "تفعيل"} الخدمة بنجاح.`);
        router.refresh();
      }
    });
  };

  const handleDeleteService = (typeId: string, serviceName: string) => {
    if (!confirm(`هل أنت متأكد من حذف أو تعطيل خدمة "${serviceName}"؟`)) return;
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const res = await deleteIncomeTypeAction(typeId);
      if (res?.error) {
        setActionError(res.error);
      } else {
        setActionSuccess(res?.message || "تمت العملية بنجاح.");
        router.refresh();
      }
    });
  };

  const closedCount = branches.filter((b) => b.isClosed).length;
  const openCount = branches.length - closedCount;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      {/* 1) بطاقة الترحيب وهوية المكتب العلوية (تختفي عند الطباعة) */}
      <section className="no-print rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logo_url}
                alt={org.name}
                className="h-12 w-12 rounded-2xl border border-slate-200 object-contain p-1"
              />
            ) : (
              <span
                style={{
                  backgroundColor: `${primaryColor}18`,
                  color: primaryColor,
                }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-bold"
              >
                <BuildingIcon className="h-6 w-6" />
              </span>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{org.name}</h1>
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  مباشر
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                اليوم: <span className="font-semibold text-slate-700">{todayFormatted}</span>
                {org.slug && (
                  <>
                    <span className="mx-2 text-slate-300">•</span>
                    <span>رابط الموظفين: </span>
                    <a
                      href={`/o/${org.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline hover:text-slate-800"
                    >
                      /o/{org.slug}
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleRefresh}
              disabled={isPending || isRefreshing}
              title="تحديث البيانات اللحظية"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshIcon
                className={`h-4 w-4 ${isRefreshing ? "animate-spin text-teal-600" : ""}`}
              />
              <span>تحديث</span>
            </button>

            <button
              onClick={handlePrint}
              title="طباعة التقرير اليومي أو حفظ كـ PDF"
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              <PrinterIcon className="h-4 w-4" />
              <span>طباعة / PDF</span>
            </button>
          </div>
        </div>
      </section>

      {/* التنبيهات العامة */}
      {actionSuccess && (
        <div className="no-print mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="no-print mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
          <AlertIcon className="h-4 w-4 shrink-0 text-red-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* 2) شريط التبويبات (تختفي عند الطباعة) */}
      <div className="no-print mt-5 flex border-b border-slate-200/90 text-sm font-semibold text-slate-500">
        <button
          onClick={() => setActiveTab("live")}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
            activeTab === "live"
              ? "border-[var(--brand-primary)] text-[var(--brand-primary)] font-bold"
              : "border-transparent hover:text-slate-800"
          }`}
          style={{
            borderColor: activeTab === "live" ? primaryColor : "transparent",
            color: activeTab === "live" ? primaryColor : undefined,
          }}
        >
          <CashIcon className="h-4 w-4" />
          <span>المراقبة الحية اليوم</span>
        </button>

        <button
          onClick={() => setActiveTab("branches")}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
            activeTab === "branches"
              ? "border-[var(--brand-primary)] text-[var(--brand-primary)] font-bold"
              : "border-transparent hover:text-slate-800"
          }`}
          style={{
            borderColor: activeTab === "branches" ? primaryColor : "transparent",
            color: activeTab === "branches" ? primaryColor : undefined,
          }}
        >
          <BuildingIcon className="h-4 w-4" />
          <span>الفروع ({branches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("employees")}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
            activeTab === "employees"
              ? "border-[var(--brand-primary)] text-[var(--brand-primary)] font-bold"
              : "border-transparent hover:text-slate-800"
          }`}
          style={{
            borderColor: activeTab === "employees" ? primaryColor : "transparent",
            color: activeTab === "employees" ? primaryColor : undefined,
          }}
        >
          <UsersIcon className="h-4 w-4" />
          <span>الموظفون ({employees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("services")}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
            activeTab === "services"
              ? "border-[var(--brand-primary)] text-[var(--brand-primary)] font-bold"
              : "border-transparent hover:text-slate-800"
          }`}
          style={{
            borderColor: activeTab === "services" ? primaryColor : "transparent",
            color: activeTab === "services" ? primaryColor : undefined,
          }}
        >
          <EditIcon className="h-4 w-4" />
          <span>خدمات الوارد ({incomeTypes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("report")}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
            activeTab === "report"
              ? "border-[var(--brand-primary)] text-[var(--brand-primary)] font-bold"
              : "border-transparent hover:text-slate-800"
          }`}
          style={{
            borderColor: activeTab === "report" ? primaryColor : "transparent",
            color: activeTab === "report" ? primaryColor : undefined,
          }}
        >
          <PrinterIcon className="h-4 w-4" />
          <span>تقرير اليوم الرسمي</span>
        </button>
      </div>

      {/* 3) محتوى تبويب: المراقبة الحية (Live Monitoring) */}
      {activeTab === "live" && (
        <div className="mt-5 space-y-6">
          {/* كروت المؤشرات المالية الحية */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  وارد اليوم
                </span>
                <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                  <TrendingUpIcon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-lg font-black text-emerald-700 sm:text-xl">
                {totalIncome.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                <span className="text-xs font-normal">ريال</span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  منصرف اليوم
                </span>
                <span className="rounded-xl bg-rose-50 p-2 text-rose-600">
                  <TrendingDownIcon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-lg font-black text-rose-700 sm:text-xl">
                {totalExpenses.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                <span className="text-xs font-normal">ريال</span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  نقدية الصندوق (الدرج)
                </span>
                <span
                  style={{
                    backgroundColor: `${primaryColor}15`,
                    color: primaryColor,
                  }}
                  className="rounded-xl p-2"
                >
                  <CashIcon className="h-4 w-4" />
                </span>
              </div>
              <p
                style={{ color: primaryColor }}
                className="mt-2 text-lg font-black sm:text-xl"
              >
                {netCashInDrawer.toLocaleString("ar-SA", {
                  minimumFractionDigits: 2,
                })}{" "}
                <span className="text-xs font-normal">ريال</span>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  حالة الفروع اليوم
                </span>
                <span className="rounded-xl bg-amber-50 p-2 text-amber-700">
                  <BuildingIcon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-800">
                <span className="text-emerald-600">{openCount} مفتوح</span>
                <span className="mx-1 text-slate-300">/</span>
                <span className="text-slate-500">{closedCount} مغلق</span>
              </p>
            </div>
          </div>

          {/* كروت متابعة الفروع اللحظية */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900">
                متابعة الفروع اللحظية ({branches.length} فرع)
              </h2>
              <button
                onClick={() => setIsCreateBranchOpen(true)}
                className="flex items-center gap-1 text-xs font-bold transition hover:opacity-80"
                style={{ color: primaryColor }}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span>إضافة فرع</span>
              </button>
            </div>

            {branches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <BuildingIcon className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  لا توجد فروع مسجلة حتى الآن
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  ابدأ بإنشاء أول فرع للمكتب لتمكين الموظفين من تسجيل الحركات.
                </p>
                <button
                  onClick={() => setIsCreateBranchOpen(true)}
                  style={{ backgroundColor: primaryColor }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>إنشاء فرع جديد</span>
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {branches.map((b) => (
                  <div
                    key={b.id}
                    className="relative rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          style={{
                            backgroundColor: `${primaryColor}12`,
                            color: primaryColor,
                          }}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold"
                        >
                          <BuildingIcon className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/branches/${b.id}`}
                              className="font-bold text-slate-900 text-sm hover:underline"
                            >
                              {b.name}
                            </Link>
                            {!b.active && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                معطل
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {b.employeeCount} موظف مسجل
                          </p>
                        </div>
                      </div>

                      {/* بادج حالة الإغلاق اليوم */}
                      {b.isClosed ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                            🔒 مغلق لليوم
                          </span>
                          <button
                            onClick={() => handleReopenDay(b.id, b.name)}
                            disabled={isPending}
                            className="text-[10px] font-semibold text-teal-700 underline hover:text-teal-900"
                          >
                            إعادة فتح اليوم
                          </button>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          اليوم مفتوح
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                      <div className="rounded-xl bg-slate-50 p-2">
                        <span className="text-[10px] font-semibold text-slate-500">
                          وارد اليوم
                        </span>
                        <p className="mt-0.5 font-bold text-xs text-emerald-700">
                          {b.todayIncome.toLocaleString("ar-SA", {
                            minimumFractionDigits: 1,
                          })}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2">
                        <span className="text-[10px] font-semibold text-slate-500">
                          منصرف اليوم
                        </span>
                        <p className="mt-0.5 font-bold text-xs text-rose-700">
                          {b.todayExpenses.toLocaleString("ar-SA", {
                            minimumFractionDigits: 1,
                          })}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2">
                        <span className="text-[10px] font-semibold text-slate-500">
                          نقدية الدرج
                        </span>
                        <p
                          style={{ color: primaryColor }}
                          className="mt-0.5 font-bold text-xs"
                        >
                          {b.todayNetCash.toLocaleString("ar-SA", {
                            minimumFractionDigits: 1,
                          })}
                        </p>
                      </div>
                    </div>

                    {b.dayClosing && (
                      <div className="mt-2.5 rounded-xl bg-amber-50/70 p-2.5 text-[11px] text-amber-900">
                        <div className="flex justify-between">
                          <span>الرصيد الدفتري: {b.dayClosing.book_balance} ريال</span>
                          <span>الفعلي المعدود: {b.dayClosing.actual_cash_counted ?? "—"} ريال</span>
                        </div>
                        {b.dayClosing.difference !== null && b.dayClosing.difference !== 0 && (
                          <p className="mt-1 font-bold text-red-700">
                            فارق المطابقة: {b.dayClosing.difference > 0 ? `+${b.dayClosing.difference} فائض` : `${b.dayClosing.difference} عجز`} ريال
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-[11px] text-slate-400 font-mono">
                        {b.todayTransactionCount} حركة مسجلة اليوم
                      </span>
                      <Link
                        href={`/dashboard/branches/${b.id}`}
                        style={{ color: primaryColor }}
                        className="flex items-center gap-1 text-xs font-bold hover:underline"
                      >
                        <span>دخول سجلات وأيام الفرع ↗</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* الحركات الأخيرة لليوم (Live Feed) */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-3">
              سجل حركات اليوم المباشر ({transactions.length} حركة)
            </h2>

            {transactions.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">
                لم يتم تسجيل أي حركات وارد أو منصرف اليوم حتى الآن.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="text-slate-400 font-medium">
                      <th className="pb-2.5 font-semibold">الوقت</th>
                      <th className="pb-2.5 font-semibold">الفرع</th>
                      <th className="pb-2.5 font-semibold">نوع الحركة</th>
                      <th className="pb-2.5 font-semibold">البيان</th>
                      <th className="pb-2.5 text-left font-semibold">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                          {t.time}
                        </td>
                        <td className="py-2.5 font-semibold text-slate-700">
                          {t.branchName}
                        </td>
                        <td className="py-2.5">
                          {t.kind === "income" && (
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              وارد
                            </span>
                          )}
                          {t.kind === "expense" && (
                            <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                              منصرف
                            </span>
                          )}
                          {t.kind === "debt_payment" && (
                            <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                              سداد دين
                            </span>
                          )}
                          {t.kind === "debt" && (
                            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              دين جديد
                            </span>
                          )}
                          {t.kind === "bank_transfer" && (
                            <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                              حوالة
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-slate-600 max-w-xs truncate">
                          {t.description || "—"}
                        </td>
                        <td
                          className={`py-2.5 text-left font-bold font-mono text-sm ${
                            t.kind === "expense" ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          {t.kind === "expense" ? "-" : "+"}
                          {t.amount.toLocaleString("ar-SA", {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4) محتوى تبويب: الفروع (Branches) */}
      {activeTab === "branches" && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                إدارة فروع المكتب
              </h2>
              <p className="text-xs text-slate-500">
                يمكنك إنشاء وتعديل الفروع وتعيين الموظفين عليها.
              </p>
            </div>
            <button
              onClick={() => setIsCreateBranchOpen(true)}
              style={{ backgroundColor: primaryColor }}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:opacity-95"
            >
              <PlusIcon className="h-4 w-4" />
              <span>إنشاء فرع جديد</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {branches.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/dashboard/branches/${b.id}`}
                      style={{
                        backgroundColor: `${primaryColor}12`,
                        color: primaryColor,
                      }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-bold transition hover:opacity-80"
                      title="دخول سجلات الفرع"
                    >
                      <BuildingIcon className="h-5 w-5" />
                    </Link>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/branches/${b.id}`}
                          className="font-bold text-slate-900 text-sm hover:underline"
                        >
                          {b.name}
                        </Link>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            b.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {b.active ? "نشط" : "معطل"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {b.employeeCount} موظف مسجل بهذا الفرع
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Link
                      href={`/dashboard/branches/${b.id}`}
                      style={{ backgroundColor: primaryColor }}
                      className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:opacity-90"
                    >
                      <span>دخول سجلات الفرع والأرشيف 📑</span>
                    </Link>
                    <button
                      onClick={() => handleToggleBranch(b.id, b.active)}
                      disabled={isPending}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        b.active
                          ? "border-red-200 text-red-600 hover:bg-red-50"
                          : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      {b.active ? "إيقاف الفرع" : "تفعيل الفرع"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5) محتوى تبويب: الموظفون (Employees) */}
      {activeTab === "employees" && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                إدارة موظفي الصندوق
              </h2>
              <p className="text-xs text-slate-500">
                إضافة حسابات الموظفين وتعيينهم على الفروع وإعادة تعيين كلمات المرور.
              </p>
            </div>
            <button
              onClick={openCreateEmployeeModal}
              disabled={branches.length === 0}
              style={{ backgroundColor: primaryColor }}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
              <span>إنشاء موظف جديد</span>
            </button>
          </div>

          {branches.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              يرجى إنشاء فرع أولاً قبل إنشاء حسابات الموظفين، لكي تتمكن من تعيين الموظف للفرع المناسب.
            </div>
          ) : employees.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <UsersIcon className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                لا يوجد موظفون مسجلون حالياً
              </p>
              <p className="mt-1 text-xs text-slate-500">
                أضف أول موظف لتسليمه بيانات الدخول لشاشة الصندوق.
              </p>
              <button
                onClick={openCreateEmployeeModal}
                style={{ backgroundColor: primaryColor }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm"
              >
                <PlusIcon className="h-4 w-4" />
                <span>إضافة موظف الآن</span>
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
              <div className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <div
                    key={emp.user_id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 font-bold">
                        <UserIcon className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm">
                            {emp.full_name || "موظف بدون اسم"}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              emp.active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {emp.active ? "نشط" : "موقوف"}
                          </span>
                          {emp.must_change_password && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              يجب تغيير كلمة السر
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">
                            {emp.branch_name}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span>{emp.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => handleResetPassword(emp.user_id)}
                        disabled={isPending}
                        title="توليد كلمة مرور مؤقتة جديدة للموظف"
                        className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <KeyIcon className="h-3.5 w-3.5 text-amber-600" />
                        <span>إعادة تعيين كلمة السر</span>
                      </button>

                      <button
                        onClick={() =>
                          handleToggleEmployee(emp.user_id, emp.active)
                        }
                        disabled={isPending}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          emp.active
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {emp.active ? "إيقاف" : "تفعيل"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5) محتوى تبويب: إدارة خدمات الوارد (Services) */}
      {activeTab === "services" && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                إدارة خدمات الوارد والمبيعات
              </h2>
              <p className="text-xs text-slate-500">
                حدد الخدمات المتاحة للموظفين لاختيارها عند تسجيل الوارد، مع إمكانية التعديل والإيقاف في أي وقت.
              </p>
            </div>
            <button
              onClick={() => {
                setNewServiceName("");
                setIsCreateServiceOpen(true);
              }}
              style={{ backgroundColor: primaryColor }}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:opacity-95 self-start sm:self-auto"
            >
              <PlusIcon className="h-4 w-4" />
              <span>إضافة خدمة جديدة</span>
            </button>
          </div>

          {/* تنبيه ذكي حول خيار مخصص للموظف */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 text-xs text-teal-900">
            <p className="font-bold flex items-center gap-1.5 text-sm">
              <span>✨</span>
              <span>ميزة الخدمة المخصصة (مفعلة تلقائياً):</span>
            </p>
            <p className="mt-1 text-slate-700 leading-relaxed">
              يوجد دائماً خيار <strong>«خدمة مخصصة (كتابة يدوية)»</strong> متاح للموظف عند تسجيل الوارد، مما يمنحه الحرية لكتابة اسم أي خدمة غير موجودة في القائمة بكل مرونة وسرعة، وتُعرض بالاسم الذي كتبه في جميع الكشوفات وتقارير الـ PDF.
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
              <h3 className="text-xs font-bold text-slate-700">
                قائمة الخدمات المسجلة ({incomeTypes.length})
              </h3>
            </div>

            {incomeTypes.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">
                لا توجد خدمات مسجلة حالياً. يمكنك إضافة أول خدمة من الزر أعلاه.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {incomeTypes.map((service, idx) => (
                  <div
                    key={service.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-mono text-xs font-bold text-slate-600">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">
                            {service.name}
                          </h4>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              service.active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {service.active ? "نشطة" : "معطلة"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {service.amount_optional
                            ? "المبلغ اختياري (ربح فقط)"
                            : "يتطلب إدخال المبلغ"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => {
                          setEditingService({ id: service.id, name: service.name });
                          setEditServiceName(service.name);
                        }}
                        className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <EditIcon className="h-3.5 w-3.5 text-slate-500" />
                        <span>تعديل الاسم</span>
                      </button>

                      <button
                        onClick={() => handleToggleService(service.id, service.active)}
                        disabled={isPending}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          service.active
                            ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                            : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {service.active ? "تعطيل" : "تفعيل"}
                      </button>

                      <button
                        onClick={() => handleDeleteService(service.id, service.name)}
                        disabled={isPending}
                        className="rounded-xl border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        title="حذف أو تعطيل"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6) محتوى تبويب: تقرير اليوم الرسمي (جاهز للطباعة وتصدير PDF) */}
      {activeTab === "report" && (
        <div className="mt-5 space-y-6">
          <div className="no-print flex items-center justify-between rounded-2xl bg-slate-900 p-4 text-white">
            <div>
              <p className="text-sm font-bold">جاهز للطباعة أو الحفظ كـ PDF</p>
              <p className="text-xs text-slate-300">
                اضغط على الزر لحفظ كشف اليوم كملف PDF رسمي بشعار وهوية المكتب.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow hover:bg-slate-100"
            >
              <PrinterIcon className="h-4 w-4" />
              <span>طباعة / PDF الآن</span>
            </button>
          </div>

          {/* الورقة الرسمية للتقرير المطبوع */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            {/* رأس التقرير الرسمي */}
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-5">
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
                  <h1 className="text-xl font-black text-slate-900">
                    {org.name}
                  </h1>
                  <p className="text-xs text-slate-500">
                    نظام إدارة الصندوق اليومي الموحد
                  </p>
                </div>
              </div>

              <div className="text-left">
                <span className="inline-block rounded-lg bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-800">
                  كشف إغلاق الصندوق اليومي
                </span>
                <p className="mt-1 text-xs text-slate-600 font-semibold">
                  التاريخ: {todayFormatted}
                </p>
              </div>
            </div>

            {/* ملخص الأرقام المالي الإجمالي */}
            <div className="mt-6 grid grid-cols-4 gap-3 text-center">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs text-slate-500">إجمالي الوارد</span>
                <p className="mt-1 text-base font-bold text-emerald-700">
                  {totalIncome.toLocaleString("ar-SA", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  <span className="text-[10px]">ريال</span>
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs text-slate-500">إجمالي المنصرف</span>
                <p className="mt-1 text-base font-bold text-rose-700">
                  {totalExpenses.toLocaleString("ar-SA", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  <span className="text-[10px]">ريال</span>
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs text-slate-500">سداد الديون</span>
                <p className="mt-1 text-base font-bold text-teal-700">
                  {totalDebtPayments.toLocaleString("ar-SA", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  <span className="text-[10px]">ريال</span>
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-100 p-3">
                <span className="text-xs font-bold text-slate-700">
                  صافي نقدية الدرج
                </span>
                <p className="mt-1 text-base font-black text-slate-900">
                  {netCashInDrawer.toLocaleString("ar-SA", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  <span className="text-[10px]">ريال</span>
                </p>
              </div>
            </div>

            {/* جدول الفروع */}
            <div className="mt-6">
              <h3 className="font-bold text-slate-900 text-sm mb-2">
                بيان أرصدة وإغلاقات الفروع
              </h3>
              <table className="w-full text-right text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-2 border">الفرع</th>
                    <th className="p-2 border">وارد اليوم</th>
                    <th className="p-2 border">منصرف اليوم</th>
                    <th className="p-2 border">نقدية الدرج</th>
                    <th className="p-2 border">الحالة</th>
                    <th className="p-2 border">الفارق / المطابقة</th>
                    <th className="p-2 border no-print">الكشف التفصيلي</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.id} className="border-b">
                      <td className="p-2 border font-bold text-slate-800">
                        {b.name}
                      </td>
                      <td className="p-2 border font-mono text-emerald-700 font-semibold">
                        {b.todayIncome.toLocaleString("ar-SA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-2 border font-mono text-rose-700 font-semibold">
                        {b.todayExpenses.toLocaleString("ar-SA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-2 border font-mono font-bold text-slate-900">
                        {b.todayNetCash.toLocaleString("ar-SA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-2 border">
                        {b.isClosed ? "🔒 تم الإغلاق" : "🟢 مفتوح"}
                      </td>
                      <td className="p-2 border text-slate-600">
                        {b.dayClosing?.difference !== null && b.dayClosing?.difference !== undefined
                          ? b.dayClosing.difference === 0
                            ? "مطابق تماماً"
                            : `${b.dayClosing.difference} ريال`
                          : "لم يكتمل الجرد"}
                      </td>
                      <td className="p-2 border no-print text-center">
                        <Link
                          href={`/dashboard/branches/${b.id}`}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-teal-700 hover:bg-teal-50"
                        >
                          عرض تفاصيل الفرع ↗
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-400 bg-slate-100 font-bold text-slate-900">
                  <tr>
                    <td className="p-2 border">المجموع العام</td>
                    <td className="p-2 border font-mono text-emerald-800">
                      {totalIncome.toLocaleString("ar-SA", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-2 border font-mono text-rose-800">
                      {totalExpenses.toLocaleString("ar-SA", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-2 border font-mono text-slate-950 font-black">
                      {netCashInDrawer.toLocaleString("ar-SA", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td colSpan={3} className="p-2 border" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* توقيع المحاسب والإدارة */}
            <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs text-slate-700 pt-8 border-t border-dashed border-slate-300">
              <div>
                <p className="font-bold">المحاسب المسؤول</p>
                <div className="mt-8 border-b border-slate-400 w-40 mx-auto" />
                <p className="mt-2 text-[10px] text-slate-400">التوقيع / الختم</p>
              </div>

              <div>
                <p className="font-bold">اعتماد الإدارة</p>
                <div className="mt-8 border-b border-slate-400 w-40 mx-auto" />
                <p className="mt-2 text-[10px] text-slate-400">التوقيع / الختم</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة خدمة جديدة */}
      {isCreateServiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">
              إضافة نوع خدمة جديد
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              أدخل مسمى الخدمة لتظهر للموظف في قائمة تسجيل الوارد (مثال: خدمات حكومية، استشارات، طباعة وتصوير).
            </p>

            <form onSubmit={handleCreateService} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم الخدمة *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تصوير وطباعة"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateServiceOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{ backgroundColor: primaryColor }}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                >
                  {isPending && <Spinner className="h-3.5 w-3.5" />}
                  <span>حفظ الخدمة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تعديل اسم الخدمة */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">
              تعديل مسمى الخدمة
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              أدخل المسمى الجديد للخدمة وسينعكس تلقائياً في السجلات.
            </p>

            <form onSubmit={handleUpdateService} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم الخدمة الجديد *
                </label>
                <input
                  type="text"
                  required
                  value={editServiceName}
                  onChange={(e) => setEditServiceName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{ backgroundColor: primaryColor }}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                >
                  {isPending && <Spinner className="h-3.5 w-3.5" />}
                  <span>حفظ التعديل</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة إنشاء فرع جديد */}
      {isCreateBranchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">
              إضافة فرع جديد للمكتب
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              أدخل اسم الفرع (مثال: فرع العليا، فرع الروضة، الفرع الرئيسي).
            </p>

            <form onSubmit={handleCreateBranch} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم الفرع *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: الفرع الشمالي"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateBranchOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{ backgroundColor: primaryColor }}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                >
                  {isPending && <Spinner className="h-3.5 w-3.5" />}
                  <span>حفظ الفرع</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة إنشاء موظف جديد */}
      {isCreateEmployeeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">
              إنشاء حساب موظف جديد
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              سيتم إنشاء حساب للموظف وتعيينه على الفرع المختار مع إجباره على تغيير كلمة المرور عند أول دخول.
            </p>

            <form onSubmit={handleCreateEmployee} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم الموظف الكامل *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد عبد الله"
                  value={newEmployeeName}
                  onChange={(e) => setNewEmployeeName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  البريد الإلكتروني للدخول *
                </label>
                <input
                  type="email"
                  required
                  placeholder="employee@example.com"
                  value={newEmployeeEmail}
                  onChange={(e) => setNewEmployeeEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none text-left font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الفرع التابع له *
                </label>
                <select
                  required
                  value={newEmployeeBranchId}
                  onChange={(e) => setNewEmployeeBranchId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none bg-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {!b.active ? "(معطل)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    كلمة المرور المؤقتة *
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setNewEmployeePassword(generateSecurePassword(12))
                    }
                    className="text-[11px] font-semibold text-teal-700 hover:underline"
                  >
                    توليد كلمة سر جديدة
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newEmployeePassword}
                    onChange={(e) => setNewEmployeePassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono focus:border-teal-600 focus:outline-none"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 end-0 flex items-center pe-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateEmployeeOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{ backgroundColor: primaryColor }}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                >
                  {isPending && <Spinner className="h-3.5 w-3.5" />}
                  <span>إنشاء الحساب وتوليد البطاقة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة بطاقة الدخول (Credentials Modal) */}
      {credentialsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <CheckIcon className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  تم إنشاء بيانات الدخول بنجاح!
                </h3>
                <p className="text-xs text-slate-500">
                  انسخ البطاقة أو أرسلها للموظف فوراً عبر الواتساب.
                </p>
              </div>
            </div>

            {/* نص البطاقة الجاهز */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-mono text-slate-800 space-y-2 leading-relaxed">
              <p className="font-bold font-sans text-slate-900 border-b pb-1.5">
                🏛️ {credentialsModal.officeName} — {credentialsModal.branchName}
              </p>
              <p>👤 الموظف: {credentialsModal.employeeName}</p>
              <p>📧 البريد: {credentialsModal.email}</p>
              <p className="font-bold text-teal-800">
                🔑 كلمة المرور المؤقتة: {credentialsModal.tempPassword}
              </p>
              {credentialsModal.slug && (
                <p>
                  🌐 رابط الدخول:{" "}
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/o/${credentialsModal.slug}`
                    : `/o/${credentialsModal.slug}`}
                </p>
              )}
              <p className="text-[11px] font-sans text-amber-700 pt-1">
                ⚠️ سيُطلب من الموظف تعيين كلمة مرور جديدة خاصة به فور تسجيل دخوله الأول.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {/* زر نسخ البطاقة */}
              <button
                type="button"
                onClick={() => {
                  const url = credentialsModal.slug
                    ? `${typeof window !== "undefined" ? window.location.origin : ""}/o/${credentialsModal.slug}`
                    : "";
                  const text = `أهلاً ${credentialsModal.employeeName}، إليك بيانات حسابك في دفتر الصندوق:\nالمكتب: ${credentialsModal.officeName} (${credentialsModal.branchName})\nالبريد: ${credentialsModal.email}\nكلمة المرور المؤقتة: ${credentialsModal.tempPassword}\nرابط الدخول: ${url}\n(سيطلب منك تعيين كلمة مرور خاصة عند الدخول).`;
                  handleCopyCredentials(text);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-4 w-4 text-emerald-400" />
                    <span>تم النسخ بنجاح!</span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="h-4 w-4" />
                    <span>نسخ نص بطاقة الدخول</span>
                  </>
                )}
              </button>

              {/* زر واتساب */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `أهلاً ${credentialsModal.employeeName}، إليك بيانات حسابك في دفتر الصندوق:\nالمكتب: ${credentialsModal.officeName} (${credentialsModal.branchName})\nالبريد: ${credentialsModal.email}\nكلمة المرور المؤقتة: ${credentialsModal.tempPassword}\nرابط الدخول: ${typeof window !== "undefined" ? window.location.origin : ""}/o/${credentialsModal.slug || ""}\n(سيطلب منك تعيين كلمة مرور خاصة عند الدخول).`,
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <WhatsAppIcon className="h-4 w-4" />
                <span>إرسال عبر واتساب</span>
              </a>

              <button
                type="button"
                onClick={() => setCredentialsModal(null)}
                className="w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 mt-1"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
