import { notFound, redirect } from "next/navigation";
import { BrandMark } from "@/components/Icons";
import LoginForm from "@/app/login/LoginForm";
import { getSession, homeForRole } from "@/lib/auth";
import { getThemeVariables, isValidHexColor } from "@/lib/colors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const admin = createSupabaseAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("name, active")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();

  if (!org || !org.active) {
    return { title: "المكتب غير موجود | دفتر الصندوق" };
  }

  return {
    title: `${org.name} | تسجيل الدخول`,
    description: `بوابة تسجيل الدخول الخاصة بـ ${org.name}`,
  };
}

export default async function OfficeLoginPage({ params }: Props) {
  const { slug } = await params;
  const cleanSlug = slug.toLowerCase().trim();

  const admin = createSupabaseAdminClient();
  const { data: org, error } = await admin
    .from("organizations")
    .select("id, name, slug, logo_url, primary_color, secondary_color, active")
    .eq("slug", cleanSlug)
    .maybeSingle();

  // إن كان الرابط غير موجود أو المكتب موقوفاً يُعاد 404 فوراً دون تسريب أي بيانات
  if (error || !org || !org.active) {
    notFound();
  }

  // إذا كان المستخدم مسجلاً بالفعل دخول سارٍ يُوجّه لصفحته الرئيسية
  const session = await getSession();
  if (session?.profile && session.profile.active) {
    redirect(homeForRole(session.profile.role));
  }

  const themeVars = getThemeVariables(org.primary_color, org.secondary_color);
  const hasCustomColor = isValidHexColor(org.primary_color);

  return (
    <main
      style={themeVars as React.CSSProperties}
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-50 px-4 py-10"
    >
      {/* خلفية جمالية تعكس اللون الأساسي للمكتب */}
      <div
        style={{
          backgroundColor: hasCustomColor ? org.primary_color! : "#0f766e",
          opacity: 0.12,
        }}
        className="pointer-events-none absolute -start-24 -top-24 h-80 w-80 rounded-full blur-3xl"
      />
      <div
        style={{
          backgroundColor: org.secondary_color
            ? org.secondary_color
            : hasCustomColor
              ? org.primary_color!
              : "#0284c7",
          opacity: 0.08,
        }}
        className="pointer-events-none absolute -bottom-32 -end-20 h-80 w-80 rounded-full blur-3xl"
      />

      <div className="relative w-full max-w-[430px]">
        {/* ترويسة المكتب: الشعار والاسم */}
        <div className="mb-7 flex flex-col items-center text-center">
          {org.logo_url ? (
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-2 shadow-lg shadow-slate-200/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={org.logo_url}
                alt={org.name}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-sm border border-slate-200">
              <BrandMark
                className="h-12 w-12"
                style={{
                  color: hasCustomColor
                    ? "var(--brand-primary)"
                    : "rgb(13 148 136)",
                }}
              />
            </div>
          )}

          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            {org.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            بوابة تسجيل الدخول لموظفي ومحاسبي المكتب
          </p>
        </div>

        {/* بطاقة الدخول */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.18)] sm:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">
              تسجيل الدخول
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              أدخل بيانات حسابك المعتمد لهذا المكتب.
            </p>
          </div>

          <LoginForm />
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs leading-6 text-slate-400">
            دفتر الصندوق اليومي • نظام آمن لإدارة دفاتر الحسابات
          </p>
        </div>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";
