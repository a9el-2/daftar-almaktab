"use server";

import { redirect } from "next/navigation";
import { getSession, homeForRole, type Role } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ChangePasswordState = {
  error?: string;
  success?: boolean;
};

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await getSession();

  if (!session || !session.profile) {
    return { error: "انتهت صلاحية الجلسة. سجّل الدخول مجدداً." };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) {
    return { error: "أدخل كلمة المرور الحالية." };
  }
  if (!newPassword) {
    return { error: "أدخل كلمة المرور الجديدة." };
  }
  if (newPassword.length < 8) {
    return { error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "كلمة المرور الجديدة وتأكيدها غير متطابقين." };
  }
  if (newPassword === currentPassword) {
    return { error: "كلمة المرور الجديدة يجب ألا تكون مطابقة لكلمة المرور القديمة." };
  }

  const supabase = await createSupabaseServerClient();

  // 1) التحقق من صحة كلمة المرور الحالية
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: session.user.email!,
    password: currentPassword,
  });

  if (signInError) {
    return { error: "كلمة المرور الحالية غير صحيحة." };
  }

  // 2) تحديث كلمة المرور في Supabase Auth
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: "تعذر تحديث كلمة المرور. حاول مرة أخرى." };
  }

  // 3) إلغاء إجبار التغيير في جدول profiles
  const { error: rpcError } = await supabase.rpc("complete_password_change");

  if (rpcError) {
    // محاولة بديلة عبر عميل الإدارة في حال لم يتم تشغيل دالة RPC بعد في قاعدة البيانات
    try {
      const admin = createSupabaseAdminClient();
      await admin
        .from("profiles")
        .update({ must_change_password: false })
        .eq("user_id", session.user.id);
    } catch (adminErr) {
      console.error("Failed to update must_change_password via admin:", adminErr);
      return {
        error:
          "تم تغيير كلمة السر، ولكن تعذر تحديث حالة الحساب في قاعدة البيانات. تواصل مع الدعم.",
      };
    }
  }

  // 4) التحويل للصفحة الرئيسية بحسب دور المستخدم
  redirect(homeForRole(session.profile.role as Role));
}
