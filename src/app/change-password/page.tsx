import { Metadata } from "next";
import { LockIcon } from "@/components/Icons";
import { displayName, requirePasswordChangeSession } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/logout";
import ChangePasswordForm from "./ChangePasswordForm";

export const metadata: Metadata = {
  title: "تعيين كلمة المرور | دفتر الصندوق",
};

export default async function ChangePasswordPage() {
  const session = await requirePasswordChangeSession();
  const name = displayName(session);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">
      <div className="pointer-events-none absolute -start-24 -top-24 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -end-20 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />

      <div className="relative w-full max-w-[440px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <LockIcon className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            تعيين كلمة مرور جديدة
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            أهلاً {name}، لحماية حسابك يجب تغيير كلمة المرور المؤقتة قبل المتابعة.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] sm:p-7">
          <ChangePasswordForm />

          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs font-medium text-slate-500 transition hover:text-red-600 hover:underline"
              >
                تسجيل الخروج والعودة لاحقاً
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          لن تتمكن من فتح أي صفحة أو وظيفة في النظام قبل إتمام هذه الخطوة.
        </p>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
