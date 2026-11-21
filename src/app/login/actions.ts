"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { homeForRole, type Role } from "@/lib/auth";

export type LoginState = { error?: string; email?: string };

const NETWORK_ERROR = "تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.";

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { email, error: "أدخل البريد الإلكتروني وكلمة المرور." };
  }

  let signInError: { message: string } | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    signInError = error;

    if (signInError) {
      const message = signInError.message.toLowerCase();
      if (message.includes("invalid login")) {
        return { email, error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
      }
      if (message.includes("email not confirmed")) {
        return {
          email,
          error: "لم يتم تأكيد البريد الإلكتروني. تواصل مع مدير النظام.",
        };
      }
      if (
        message.includes("fetch") ||
        message.includes("network") ||
        message.includes("timeout")
      ) {
        return { email, error: NETWORK_ERROR };
      }
      return {
        email,
        error: "تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.",
      };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { email, error: "تعذر إنشاء الجلسة. حاول مرة أخرى." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, active, must_change_password, organization:organizations(active)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      await supabase.auth.signOut();
      return {
        email,
        error: "هذا الحساب غير مرتبط بأي مكتب. تواصل مع مدير النظام.",
      };
    }

    if (!profile.active) {
      await supabase.auth.signOut();
      return { email, error: "حسابك موقوف حالياً. تواصل مع مدير المكتب." };
    }

    const organization = profile.organization as unknown as {
      active: boolean;
    } | null;

    if (
      profile.role !== "super_admin" &&
      (!organization || !organization.active)
    ) {
      await supabase.auth.signOut();
      return { email, error: "المكتب موقوف حالياً. تواصل مع مدير النظام." };
    }

    if (profile.must_change_password) {
      redirect("/change-password");
    }

    redirect(homeForRole(profile.role as Role));
  } catch (error) {
    // نتحقق من خطأ redirect الخاص بـ Next.js ونعيد إلقاءه كما هو.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    console.error("login failed", error);
    return { email, error: NETWORK_ERROR };
  }
}
