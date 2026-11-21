"use client";

import { useActionState, useState } from "react";
import { AlertIcon, EyeIcon, EyeOffIcon, LockIcon, Spinner } from "@/components/Icons";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = {};

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialState,
  );

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-6 text-red-700"
        >
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div>
        <label
          htmlFor="currentPassword"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          كلمة المرور الحالية (المؤقتة)
        </label>
        <div className="relative">
          <input
            id="currentPassword"
            name="currentPassword"
            type={showCurrent ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="أدخل كلمة المرور الحالية"
            dir="ltr"
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pe-11 ps-3 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            aria-label={showCurrent ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            className="absolute end-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:text-slate-600"
          >
            {showCurrent ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="newPassword"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          كلمة المرور الجديدة
        </label>
        <div className="relative">
          <input
            id="newPassword"
            name="newPassword"
            type={showNew ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="8 أحرف أو أكثر (مختلفة عن القديمة)"
            dir="ltr"
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pe-11 ps-3 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            aria-label={showNew ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            className="absolute end-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:text-slate-600"
          >
            {showNew ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          اختر كلمة مرور قوية تحتوي على 8 أحرف على الأقل.
        </p>
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          تأكيد كلمة المرور الجديدة
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="أعد كتابة كلمة المرور الجديدة"
            dir="ltr"
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pe-11 ps-3 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            className="absolute end-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition hover:text-slate-600"
          >
            {showConfirm ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-[15px] font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700 disabled:opacity-60"
      >
        {pending ? (
          <>
            <Spinner className="h-5 w-5" />
            <span>جارٍ التحديث...</span>
          </>
        ) : (
          <>
            <LockIcon className="h-5 w-5" />
            <span>حفظ كلمة المرور والدخول</span>
          </>
        )}
      </button>
    </form>
  );
}
