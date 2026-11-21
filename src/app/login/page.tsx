import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertIcon, BrandMark } from "@/components/Icons";
import SetupNotice from "@/components/SetupNotice";
import { getSession, homeForRole } from "@/lib/auth";
import { isPreviewEnabled, isSupabaseConfigured } from "@/lib/env";
import LoginForm from "./LoginForm";

export const metadata = { title: "تسجيل الدخول | دفتر الصندوق" };

export default async function LoginPage() {
  const configured = isSupabaseConfigured;

  // في النسخة المنشورة بلا قاعدة بيانات: صفحة إشعار واضحة (لا معاينة).
  if (!configured && !isPreviewEnabled) return <SetupNotice />;

  if (configured) {
    const session = await getSession();
    if (session?.profile && session.profile.active) {
      redirect(homeForRole(session.profile.role));
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">
      <div className="pointer-events-none absolute -start-24 -top-24 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -end-20 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <BrandMark className="h-14 w-14 text-teal-600" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            دفتر الصندوق اليومي
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            متابعة الوارد والمنصرف والديون لكل فرع
          </p>
        </div>

        {isPreviewEnabled ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-6 text-amber-900">
            <div className="flex items-start gap-2">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">وضع المعاينة</p>
                <p className="text-amber-800">
                  قاعدة البيانات غير مربوطة بعد، لذلك تسجيل الدخول لن يعمل. الشاشة
                  معروضة لعرض التصميم فقط.
                </p>
                <div className="mt-2">
                  <Link
                    href="/demo"
                    className="font-semibold text-teal-700 underline underline-offset-4"
                  >
                    عرض شاشات الأدوار
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">
              تسجيل الدخول
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              أدخل بيانات الحساب التي أعطاك إياها مدير المكتب.
            </p>
          </div>

          <LoginForm />
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs leading-6 text-slate-400">
            الحسابات تُنشأ من قبل مدير المكتب، ولا يمكن التسجيل الذاتي.
          </p>
        </div>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";

