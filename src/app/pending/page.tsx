import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertIcon, BrandMark } from "@/components/Icons";
import { logoutAction } from "@/lib/actions/logout";
import { getSession, homeForRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { isPreviewEnabled } from "@/lib/env";

export const metadata = { title: "حالة الحساب | دفتر الصندوق" };

export default async function PendingPage() {
  if (!isSupabaseConfigured) {
    redirect(isPreviewEnabled ? "/demo" : "/login");
  }

  const session = await getSession();
  if (!session) redirect("/login");

  const profile = session.profile;

  if (profile && profile.active) {
    const orgBlocked =
      profile.role !== "super_admin" &&
      (!profile.organization || !profile.organization.active);

    if (!orgBlocked) redirect(homeForRole(profile.role));
  }

  let title = "حسابك قيد التجهيز";
  let message =
    "تم إنشاء حسابك، لكنه لم يُربط بأي مكتب بعد. تواصل مع مدير النظام لربطه.";

  if (profile && !profile.active) {
    title = "الحساب موقوف";
    message = "تم إيقاف حسابك مؤقتاً. تواصل مع مدير المكتب لإعادة تفعيله.";
  } else if (profile && profile.role !== "super_admin") {
    title = "المكتب موقوف";
    message =
      "تم إيقاف اشتراك المكتب مؤقتاً، لذلك لا يمكن الدخول إلى بياناته. تواصل مع مدير النظام.";
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-sm sm:p-8">
        <BrandMark className="mx-auto h-12 w-12 text-slate-400" />
        <h1 className="mt-4 text-lg font-bold text-slate-900">{title}</h1>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-start text-sm leading-6 text-amber-800">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{message}</span>
        </div>

        <p className="mt-4 text-xs text-slate-400" dir="ltr">
          {session.user.email}
        </p>

        <form action={logoutAction} className="mt-5">
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            تسجيل الخروج
          </button>
        </form>

        <Link
          href="/login"
          className="mt-4 inline-block text-xs font-medium text-slate-500 underline-offset-4 hover:text-teal-700 hover:underline"
        >
          العودة لتسجيل الدخول
        </Link>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
