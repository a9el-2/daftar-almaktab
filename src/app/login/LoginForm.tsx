"use client";

import { useActionState, useId, useState } from "react";
import {
  AlertIcon,
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  Spinner,
} from "@/components/Icons";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);
  const passwordId = useId();

  return (
    <form action={formAction} className="space-y-4" noValidate>
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
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          البريد الإلكتروني
        </label>
        <div className="relative">
          <MailIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto h-5 w-5 text-slate-400" />
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            required
            defaultValue={state.email ?? ""}
            placeholder="name@office.com"
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pe-3 ps-11 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={passwordId}
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          كلمة المرور
        </label>
        <div className="relative">
          <LockIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto h-5 w-5 text-slate-400" />
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            dir="ltr"
            required
            placeholder="••••••••"
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pe-12 ps-11 text-right text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            className="absolute inset-y-0 end-2 my-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            {showPassword ? (
              <EyeOffIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        style={{
          backgroundColor: "var(--brand-primary, rgb(13 148 136))",
          color: "var(--brand-primary-text, #ffffff)",
        }}
        className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold shadow-lg transition hover:brightness-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/30 disabled:cursor-not-allowed disabled:opacity-75"
      >
        {pending ? (
          <>
            <Spinner className="h-5 w-5" />
            جارٍ الدخول…
          </>
        ) : (
          <>
            تسجيل الدخول
            <ArrowLeftIcon className="h-5 w-5" />
          </>
        )}
      </button>
    </form>
  );
}
