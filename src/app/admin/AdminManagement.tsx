"use client";

import { useState, useTransition } from "react";
import {
  AlertIcon,
  CheckIcon,
  CopyIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  PlusIcon,
  Spinner,
} from "@/components/Icons";
import OfficeBrandingFields from "@/components/OfficeBrandingFields";
import { generateSecurePassword } from "@/lib/password";
import {
  createOrganizationAction,
  resetAccountantPasswordAction,
  toggleOrganizationStatusAction,
  updateOrganizationBrandingAction,
  updateOrganizationPlanAction,
  type AdminActionResult,
} from "./actions";

export type OfficeItem = {
  id: string;
  name: string;
  slug: string | null;
  plan: "monthly" | "lifetime";
  subscription_end: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  active: boolean;
  created_at: string;
  accountant: {
    user_id: string;
    full_name: string | null;
    email: string | null;
    active: boolean;
    must_change_password: boolean;
  } | null;
};

type Props = {
  initialOffices: OfficeItem[];
};

export default function AdminManagement({ initialOffices }: Props) {
  const [offices, setOffices] = useState<OfficeItem[]>(initialOffices);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  // النوافذ المنبثقة
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<OfficeItem | null>(null);
  const [credentialsModal, setCredentialsModal] = useState<
    AdminActionResult["credentials"] | null
  >(null);

  // نموذج إنشاء مكتب
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState<"monthly" | "lifetime">("monthly");
  const [subscriptionEnd, setSubscriptionEnd] = useState("");
  const [accountantName, setAccountantName] = useState("");
  const [accountantEmail, setAccountantEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // رسائل التنبيه والنسخ
  const [copied, setCopied] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // توليد كلمة مرور أولية عند فتح نافذة الإنشاء
  const handleOpenCreate = () => {
    setName("");
    setSlug("");
    setPlan("monthly");
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setSubscriptionEnd(nextMonth.toISOString().split("T")[0]);
    setAccountantName("");
    setAccountantEmail("");
    setTempPassword(generateSecurePassword(12));
    setFormError(null);
    setIsCreateOpen(true);
  };

  // توليد slug تلقائي مقترح عند كتابة الاسم
  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug) {
      // اقتراح slug إنجليزي بسيط إذا كتب شيئاً
      const clean = val
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (clean) setSlug(clean);
    }
  };

  // تقديم نموذج إنشاء مكتب
  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setActionError(null);

    const formEl = e.currentTarget;
    const formData = new FormData(formEl);

    startTransition(async () => {
      const res = await createOrganizationAction(formData);

      if (res.error) {
        setFormError(res.error);
        return;
      }

      if (res.credentials) {
        setIsCreateOpen(false);
        setCredentialsModal(res.credentials);
        setActionSuccess(`تم إنشاء مكتب "${res.credentials.officeName}" بنجاح.`);

        // تحديث القائمة
        window.location.reload();
      }
    });
  };

  // تقديم نموذج تعديل بيانات وهوية المكتب
  const handleUpdateOfficeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editOrg) return;

    setActionError(null);
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);

    startTransition(async () => {
      // 1) تحديث الهوية البصرية والاسم
      const resBranding = await updateOrganizationBrandingAction(formData);
      if (resBranding.error) {
        setActionError(resBranding.error);
        return;
      }

      // 2) تحديث الخطة وتاريخ الانتهاء
      const resPlan = await updateOrganizationPlanAction(formData);
      if (resPlan.error) {
        setActionError(resPlan.error);
        return;
      }

      setEditOrg(null);
      setActionSuccess("تم تحديث بيانات وهوية المكتب بنجاح.");
      window.location.reload();
    });
  };

  // تفعيل / إيقاف المكتب
  const handleToggleStatus = (org: OfficeItem) => {
    const confirmMsg = org.active
      ? `هل أنت متأكد من إيقاف مكتب "${org.name}"؟ لن يتمكن أي من مستخدميه من تسجيل الدخول.`
      : `هل أنت متأكد من إعادة تفعيل مكتب "${org.name}"؟`;

    if (!window.confirm(confirmMsg)) return;

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await toggleOrganizationStatusAction(org.id, org.active);
      if (res.error) {
        setActionError(res.error);
        return;
      }

      setOffices((prev) =>
        prev.map((o) => (o.id === org.id ? { ...o, active: !org.active } : o)),
      );
      setActionSuccess(
        `تم ${org.active ? "إيقاف" : "تفعيل"} مكتب "${org.name}" بنجاح.`,
      );
    });
  };

  // إعادة تعيين كلمة مرور المحاسب
  const handleResetPassword = (org: OfficeItem) => {
    if (!org.accountant) return;

    if (
      !window.confirm(
        `هل تريد إعادة تعيين كلمة مرور المحاسب (${org.accountant.full_name || org.accountant.email})؟`,
      )
    ) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await resetAccountantPasswordAction(
        org.accountant!.user_id,
        org.name,
        org.slug || "",
      );

      if (res.error) {
        setActionError(res.error);
        return;
      }

      if (res.credentials) {
        setCredentialsModal(res.credentials);
        setActionSuccess("تمت إعادة تعيين كلمة المرور بنجاح.");
      }
    });
  };

  // نسخ رسالة معلومات الدخول
  const copyCredentialsText = () => {
    if (!credentialsModal) return;

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const loginUrl = credentialsModal.slug
      ? `${origin}/o/${credentialsModal.slug}`
      : `${origin}/login`;

    const text = `بيانات الدخول لمكتب: ${credentialsModal.officeName}
رابط الدخول المباشر للمكتب: ${loginUrl}
البريد الإلكتروني: ${credentialsModal.email}
كلمة المرور المؤقتة: ${credentialsModal.tempPassword}

ملاحظة: سيُطلب منك تعيين كلمة مرور جديدة خاصة بك فور تسجيل الدخول.`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // تصفية المكاتب بالبحث
  const filteredOffices = offices.filter((o) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      o.name.toLowerCase().includes(q) ||
      (o.slug && o.slug.toLowerCase().includes(q)) ||
      (o.accountant?.full_name &&
        o.accountant.full_name.toLowerCase().includes(q)) ||
      (o.accountant?.email && o.accountant.email.toLowerCase().includes(q))
    );
  });

  const activeCount = offices.filter((o) => o.active).length;
  const suspendedCount = offices.length - activeCount;
  const monthlyCount = offices.filter((o) => o.plan === "monthly").length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* رأس الصفحة والإحصائيات */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            إدارة المكاتب والمشتركين
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            إنشاء المكاتب، ضبط الهوية البصرية، إدارة الاشتراكات وحسابات
            المحاسبين.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/30"
        >
          <PlusIcon className="h-5 w-5" />
          <span>إضافة مكتب جديد</span>
        </button>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">إجمالي المكاتب</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {offices.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">مكاتب نشطة</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {activeCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">مكاتب موقوفة</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {suspendedCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">اشتراكات شهرية</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{monthlyCount}</p>
        </div>
      </div>

      {/* رسائل التنبيه العلوية */}
      {actionSuccess ? (
        <div
          role="status"
          className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <div className="flex items-center gap-2">
            <CheckIcon className="h-5 w-5 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            إغلاق
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="mt-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <div className="flex items-center gap-2">
            <AlertIcon className="h-5 w-5 text-red-600" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs font-semibold text-red-700 hover:underline"
          >
            إغلاق
          </button>
        </div>
      ) : null}

      {/* جدول المكاتب وشريط البحث */}
      <div className="mt-6 rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="relative w-full max-w-sm">
            <input
              type="text"
              placeholder="بحث باسم المكتب، الرابط، أو المحاسب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pe-3 ps-4 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10"
            />
          </div>
        </div>

        {filteredOffices.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            {search ? "لا توجد نتائج مطابقة لبحثك." : "لا توجد مكاتب مسجلة بعد."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">المكتب والهوية</th>
                  <th className="px-4 py-3.5">الخطة والاشتراك</th>
                  <th className="px-4 py-3.5">المحاسب المسؤول</th>
                  <th className="px-4 py-3.5">الحالة</th>
                  <th className="px-5 py-3.5 text-end">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOffices.map((org) => {
                  const isMonthly = org.plan === "monthly";
                  const isExpired =
                    isMonthly &&
                    org.subscription_end &&
                    new Date(org.subscription_end) < new Date();

                  return (
                    <tr
                      key={org.id}
                      className="transition hover:bg-slate-50/50"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {/* شعار المكتب أو الحرف الأول */}
                          {org.logo_url ? (
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/90 bg-white p-0.5 shadow-sm">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={org.logo_url}
                                alt={org.name}
                                className="h-full w-full object-contain"
                              />
                            </div>
                          ) : (
                            <span
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm"
                              style={{
                                backgroundColor: org.primary_color
                                  ? `${org.primary_color}18`
                                  : "#f0fdfa",
                                color: org.primary_color || "#0f766e",
                              }}
                            >
                              {org.name.slice(0, 1)}
                            </span>
                          )}

                          <div>
                            <p className="font-semibold text-slate-900">
                              {org.name}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              {/* عينة الألوان */}
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-slate-300 shadow-xs"
                                style={{
                                  backgroundColor:
                                    org.primary_color || "#0f766e",
                                }}
                                title={`اللون الأساسي: ${org.primary_color || "#0f766e"}`}
                              />
                              {org.secondary_color ? (
                                <span
                                  className="h-2.5 w-2.5 rounded-full border border-slate-300 shadow-xs"
                                  style={{
                                    backgroundColor: org.secondary_color,
                                  }}
                                  title={`اللون الثانوي: ${org.secondary_color}`}
                                />
                              ) : null}

                              {org.slug ? (
                                <a
                                  href={`/o/${org.slug}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  dir="ltr"
                                  className="text-[11px] font-mono text-teal-700 hover:underline"
                                  title="فتح صفحة الدخول المخصصة للمكتب"
                                >
                                  /o/{org.slug}
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                              isMonthly
                                ? "bg-sky-50 text-sky-700"
                                : "bg-purple-50 text-purple-700"
                            }`}
                          >
                            {isMonthly ? "اشتراك شهري" : "اشتراك دائم"}
                          </span>
                          {isMonthly ? (
                            <p
                              className={`text-xs ${
                                isExpired
                                  ? "font-semibold text-red-600"
                                  : "text-slate-500"
                              }`}
                            >
                              {org.subscription_end
                                ? `ينتهي: ${org.subscription_end}`
                                : "غير محدد"}
                              {isExpired ? " (منتهي)" : ""}
                            </p>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {org.accountant ? (
                          <div>
                            <p className="font-medium text-slate-800">
                              {org.accountant.full_name || "محاسب المكتب"}
                            </p>
                            <p
                              dir="ltr"
                              className="text-[11px] text-slate-500 text-end"
                            >
                              {org.accountant.email}
                            </p>
                            {org.accountant.must_change_password ? (
                              <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 font-medium">
                                يجب تغيير كلمة السر
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            لا يوجد محاسب
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            org.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              org.active ? "bg-emerald-600" : "bg-red-600"
                            }`}
                          />
                          <span>{org.active ? "نشط" : "موقوف"}</span>
                        </span>
                      </td>

                      <td className="px-5 py-4 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* زر إيقاف / تفعيل */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(org)}
                            disabled={isPending}
                            title={
                              org.active
                                ? "إيقاف المكتب ومستخدميه"
                                : "إعادة تفعيل المكتب"
                            }
                            className={`flex h-8 items-center rounded-lg px-2.5 text-xs font-medium transition ${
                              org.active
                                ? "border border-amber-200 bg-amber-50/60 text-amber-800 hover:bg-amber-100"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            }`}
                          >
                            {org.active ? "إيقاف" : "تفعيل"}
                          </button>

                          {/* زر تعديل المكتب والهوية */}
                          <button
                            type="button"
                            onClick={() => setEditOrg(org)}
                            disabled={isPending}
                            title="تعديل بيانات وهوية المكتب واشتراكه"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            <EditIcon className="h-4 w-4" />
                          </button>

                          {/* زر إعادة تعيين كلمة المرور للمحاسب */}
                          {org.accountant ? (
                            <button
                              type="button"
                              onClick={() => handleResetPassword(org)}
                              disabled={isPending}
                              title="إعادة تعيين كلمة مرور المحاسب"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-teal-700"
                            >
                              <KeyIcon className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 1) نافذة إنشاء مكتب جديد مع الهوية البصرية                     */}
      {/* ============================================================ */}
      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  إنشاء مكتب جديد
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  سيتم إنشاء المكتب وهوية الألوان والفرع وحساب المحاسب دفعة واحدة
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {formError ? (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700"
              >
                <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{formError}</span>
              </div>
            ) : null}

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              {/* بيانات المكتب */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  اسم المكتب <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="مثال: مكتب الفرسان للخدمات"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  رابط المكتب الفريد (slug){" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="slug"
                  required
                  dir="ltr"
                  pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
                  placeholder="alfursan"
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value.toLowerCase().trim())
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  حروف إنجليزية وأرقام وشرطات (صفحة الدخول: /o/{slug || "slug"}).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    خطة الاشتراك
                  </label>
                  <select
                    name="plan"
                    value={plan}
                    onChange={(e) =>
                      setPlan(e.target.value as "monthly" | "lifetime")
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10"
                  >
                    <option value="monthly">شهري</option>
                    <option value="lifetime">دائم (مدى الحياة)</option>
                  </select>
                </div>

                {plan === "monthly" ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      تاريخ الانتهاء
                    </label>
                    <input
                      type="date"
                      name="subscriptionEnd"
                      required
                      value={subscriptionEnd}
                      onChange={(e) => setSubscriptionEnd(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10"
                    />
                  </div>
                ) : null}
              </div>

              {/* الهوية البصرية */}
              <div>
                <p className="mb-2 text-xs font-bold text-slate-900">
                  الهوية البصرية والألوان
                </p>
                <OfficeBrandingFields
                  initialPrimaryColor="#0f766e"
                  disabled={isPending}
                />
              </div>

              <hr className="my-2 border-slate-100" />

              {/* بيانات المحاسب */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  اسم المحاسب المسؤول <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="accountantName"
                  required
                  placeholder="مثال: صالح القرني"
                  value={accountantName}
                  onChange={(e) => setAccountantName(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  البريد الإلكتروني للمحاسب{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="accountantEmail"
                  required
                  dir="ltr"
                  placeholder="accountant@office.com"
                  value={accountantEmail}
                  onChange={(e) => setAccountantEmail(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    كلمة المرور المؤقتة
                  </label>
                  <button
                    type="button"
                    onClick={() => setTempPassword(generateSecurePassword(12))}
                    className="text-[11px] font-semibold text-teal-700 hover:underline"
                  >
                    توليد كلمة جديدة
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="tempPassword"
                    required
                    dir="ltr"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pe-10 ps-3 font-mono text-sm text-slate-900 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 end-2 my-auto flex h-8 w-8 items-center justify-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  ستُعرض مرة واحدة فقط وتُنسخ برسالة جاهزة، ويُجبر على تغييرها
                  عند الدخول.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="h-10 rounded-xl px-4 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      <span>جارٍ الإنشاء...</span>
                    </>
                  ) : (
                    <span>إنشاء المكتب والمحاسب</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ============================================================ */}
      {/* 2) نافذة تعديل بيانات وهوية واشتراك المكتب                    */}
      {/* ============================================================ */}
      {editOrg ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">
                  تعديل مكتب: {editOrg.name}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  تحديث الاسم، الهوية البصرية، والخطة
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditOrg(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateOfficeSubmit} className="mt-4 space-y-4">
              <input type="hidden" name="orgId" value={editOrg.id} />

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  اسم المكتب
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editOrg.name}
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 outline-none focus:border-teal-500"
                />
              </div>

              {/* قسم الهوية البصرية */}
              <div>
                <p className="mb-2 text-xs font-bold text-slate-900">
                  الهوية البصرية
                </p>
                <OfficeBrandingFields
                  initialLogoUrl={editOrg.logo_url}
                  initialPrimaryColor={editOrg.primary_color || "#0f766e"}
                  initialSecondaryColor={editOrg.secondary_color}
                  disabled={isPending}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    خطة الاشتراك
                  </label>
                  <select
                    name="plan"
                    defaultValue={editOrg.plan}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 outline-none focus:border-teal-500"
                  >
                    <option value="monthly">شهري</option>
                    <option value="lifetime">دائم (مدى الحياة)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    تاريخ الانتهاء
                  </label>
                  <input
                    type="date"
                    name="subscriptionEnd"
                    defaultValue={editOrg.subscription_end || ""}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-900 outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOrg(null)}
                  className="h-10 rounded-xl px-4 text-xs text-slate-600 hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-5 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  {isPending ? <Spinner className="h-4 w-4" /> : null}
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ============================================================ */}
      {/* 3) نافذة "نسخ معلومات الدخول" (تظهر مرة واحدة فقط)            */}
      {/* ============================================================ */}
      {credentialsModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <CheckIcon className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  معلومات الدخول للمحاسب
                </h3>
                <p className="text-xs text-slate-500">
                  انسخ البيانات الآن وأرسلها للمحاسب.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs leading-6">
              <div className="flex justify-between">
                <span className="text-slate-500">المكتب:</span>
                <span className="font-semibold text-slate-800">
                  {credentialsModal.officeName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">رابط الدخول المباشر:</span>
                <span dir="ltr" className="font-mono text-teal-700 font-semibold">
                  /o/{credentialsModal.slug}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">المحاسب:</span>
                <span className="font-semibold text-slate-800">
                  {credentialsModal.accountantName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">البريد الإلكتروني:</span>
                <span dir="ltr" className="font-semibold text-slate-800">
                  {credentialsModal.email}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                <span className="text-slate-500">كلمة المرور المؤقتة:</span>
                <span
                  dir="ltr"
                  className="rounded bg-teal-50 px-2 py-0.5 font-mono text-sm font-bold text-teal-800"
                >
                  {credentialsModal.tempPassword}
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[11px] leading-5 text-amber-800">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                تنبيه: كلمة المرور المؤقتة لن تظهر مرة أخرى بعد إغلاق هذه
                النافذة، ولن تُخزّن في السجلات حمايةً لخصوصية الحساب.
              </span>
            </div>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={copyCredentialsText}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-xs font-semibold text-white shadow transition hover:bg-slate-800"
              >
                {copied ? (
                  <>
                    <CheckIcon className="h-4 w-4 text-emerald-400" />
                    <span>تم النسخ بنجاح!</span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="h-4 w-4" />
                    <span>نسخ رسالة الدخول الجاهزة</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCredentialsModal(null)}
                className="h-10 w-full rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
