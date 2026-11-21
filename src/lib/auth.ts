import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPreviewEnabled, isSupabaseConfigured } from "@/lib/env";

export type Role = "super_admin" | "accountant" | "employee";

export type Profile = {
  user_id: string;
  org_id: string | null;
  branch_id: string | null;
  role: Role;
  full_name: string | null;
  active: boolean;
  must_change_password: boolean;
  organization: {
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    slug: string | null;
    active: boolean;
  } | null;
  branch: { name: string } | null;
};

export type Session = {
  user: User;
  profile: Profile | null;
};

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "مدير النظام",
  accountant: "المحاسب",
  employee: "موظف",
};

/** الصفحة الرئيسية لكل دور بعد تسجيل الدخول */
export const homeForRole = (role: Role): string => {
  switch (role) {
    case "super_admin":
      return "/admin";
    case "accountant":
      return "/dashboard";
    case "employee":
      return "/employee";
  }
};

const PROFILE_SELECT =
  "user_id, org_id, branch_id, role, full_name, active, must_change_password, organization:organizations(name, logo_url, active, primary_color, secondary_color, slug), branch:branches(name)";

/**
 * يقرأ المستخدم الحالي مع ملفه الشخصي (الدور والمكتب والفرع).
 * مُخزَّن مؤقتاً لكل طلب حتى لا تتكرر الاستعلامات.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    user,
    profile: (profile as unknown as Profile | null) ?? null,
  };
});

/**
 * يستخدمه كل صفحة محمية:
 * - غير مسجل → صفحة الدخول
 * - بلا ملف شخصي أو حساب موقوف → صفحة الانتظار
 * - يجب تغيير كلمة السر → صفحة تغيير كلمة السر (/change-password)
 * - دور غير مسموح → صفحته الرئيسية
 */
export async function requireProfile(roles?: Role[]): Promise<
  Session & { profile: Profile }
> {
  // بدون قاعدة بيانات: معاينة أثناء التطوير فقط، وإلا صفحة الإعداد.
  if (!isSupabaseConfigured) {
    redirect(isPreviewEnabled ? "/demo" : "/login");
  }

  const session = await getSession();

  if (!session) redirect("/login");
  if (!session.profile || !session.profile.active) redirect("/pending");

  if (session.profile.organization && !session.profile.organization.active) {
    redirect("/pending?reason=org");
  }

  // إجبار تغيير كلمة السر: لا يمكن تصفح أي صفحة قبل التغيير
  if (session.profile.must_change_password) {
    redirect("/change-password");
  }

  if (roles && !roles.includes(session.profile.role)) {
    redirect(homeForRole(session.profile.role));
  }

  return session as Session & { profile: Profile };
}

/**
 * خاص بصفحة تغيير كلمة المرور (/change-password):
 * - غير مسجل → صفحة الدخول
 * - حساب موقوف → صفحة الانتظار
 * - أتم تغيير كلمة المرور بالفعل → صفحته الرئيسية
 */
export async function requirePasswordChangeSession(): Promise<
  Session & { profile: Profile }
> {
  if (!isSupabaseConfigured) {
    redirect(isPreviewEnabled ? "/demo" : "/login");
  }

  const session = await getSession();

  if (!session) redirect("/login");
  if (!session.profile || !session.profile.active) redirect("/pending");

  if (session.profile.organization && !session.profile.organization.active) {
    redirect("/pending?reason=org");
  }

  // إذا كان الحساب قد غير كلمة السر بالفعل، يُعاد لصفحته الرئيسية فوراً
  if (!session.profile.must_change_password) {
    redirect(homeForRole(session.profile.role));
  }

  return session as Session & { profile: Profile };
}

/**
 * فحص صارم لأي Server Action أو API:
 * يمنع تنفيذ أي عملية إن كان الحساب موقوفاً أو مطالباً بتغيير كلمة المرور.
 */
export async function assertAuthorizedAction(): Promise<
  Session & { profile: Profile }
> {
  const session = await getSession();

  if (!session || !session.profile || !session.profile.active) {
    throw new Error("غير مصرح: يجب تسجيل الدخول بحساب نشط.");
  }

  if (session.profile.organization && !session.profile.organization.active) {
    throw new Error("اشتراك المكتب موقوف حالياً.");
  }

  if (session.profile.must_change_password) {
    throw new Error("يجب تغيير كلمة المرور أولاً قبل تنفيذ أي عملية.");
  }

  return session as Session & { profile: Profile };
}


/** الاسم المعروض للمستخدم */
export function displayName(session: Session): string {
  return session.profile?.full_name?.trim() || session.user.email || "مستخدم";
}
