"use server";

import { revalidatePath } from "next/cache";
import { assertAuthorizedAction } from "@/lib/auth";
import { generateSecurePassword } from "@/lib/password";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DashboardActionResult = {
  success?: boolean;
  error?: string;
  credentials?: {
    employeeName: string;
    email: string;
    tempPassword: string;
    branchName: string;
    officeName: string;
    slug: string | null;
  };
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 1) إنشاء فرع جديد للمكتب
 */
export async function createBranchAction(
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const orgId = session.profile.org_id;
  if (!orgId) {
    return { error: "الحساب غير مرتبط بمكتب." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 60) {
    return { error: "اسم الفرع يجب أن يكون بين حرفين و60 حرفاً." };
  }

  const admin = createSupabaseAdminClient();

  // فحص عدم تكرار الاسم في نفس المكتب
  const { data: existing } = await admin
    .from("branches")
    .select("id")
    .eq("org_id", orgId)
    .ilike("name", name)
    .maybeSingle();

  if (existing) {
    return { error: "يوجد فرع بنفس الاسم في هذا المكتب مسبقاً." };
  }

  const { error } = await admin.from("branches").insert({
    org_id: orgId,
    name,
    active: true,
  });

  if (error) {
    console.error("Create branch error:", error);
    return { error: "تعذر إنشاء الفرع. يرجى المحاولة لاحقاً." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * 2) تبديل حالة الفرع (نشط / موقوف)
 */
export async function toggleBranchStatusAction(
  branchId: string,
  currentActive: boolean,
): Promise<{ success?: boolean; error?: string }> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const orgId = session.profile.org_id;
  if (!orgId || !branchId) return { error: "بيانات غير مكتملة." };

  const admin = createSupabaseAdminClient();

  // التحقق من أن الفرع يتبع نفس المكتب
  const { data: branch } = await admin
    .from("branches")
    .select("id, org_id")
    .eq("id", branchId)
    .maybeSingle();

  if (!branch || branch.org_id !== orgId) {
    return { error: "الفرع غير موجود أو لا يتبع مكتبك." };
  }

  const { error } = await admin
    .from("branches")
    .update({ active: !currentActive })
    .eq("id", branchId);

  if (error) {
    return { error: "تعذر تحديث حالة الفرع." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * 3) إنشاء موظف جديد لفرع معين
 */
export async function createEmployeeAction(
  formData: FormData,
): Promise<DashboardActionResult> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const orgId = session.profile.org_id;
  if (!orgId) return { error: "الحساب غير مرتبط بمكتب." };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const branchId = String(formData.get("branchId") ?? "").trim();
  let tempPassword = String(formData.get("tempPassword") ?? "").trim();

  if (fullName.length < 2 || fullName.length > 80) {
    return { error: "اسم الموظف يجب أن يكون بين حرفين و80 حرفاً." };
  }

  if (!email || !emailPattern.test(email)) {
    return { error: "البريد الإلكتروني غير صالح." };
  }

  if (!branchId) {
    return { error: "يرجى اختيار الفرع التابع له الموظف." };
  }

  const admin = createSupabaseAdminClient();

  // التحقق من صحة الفرع وتبعيته للمكتب
  const { data: branch } = await admin
    .from("branches")
    .select("id, name, org_id")
    .eq("id", branchId)
    .maybeSingle();

  if (!branch || branch.org_id !== orgId) {
    return { error: "الفرع المحدد غير صالح أو لا يتبع هذا المكتب." };
  }

  // توليد كلمة سر مؤقتة إن لم يتم إدخالها
  if (!tempPassword) {
    tempPassword = generateSecurePassword(12);
  } else if (tempPassword.length < 8) {
    return { error: "كلمة المرور المؤقتة يجب ألا تقل عن 8 خانات." };
  }

  // 1. إنشاء المستخدم في Supabase Auth
  const { data: authData, error: createAuthErr } =
    await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "employee",
        org_id: orgId,
      },
    });

  if (createAuthErr || !authData.user) {
    if (createAuthErr?.message?.includes("already registered")) {
      return { error: "هذا البريد الإلكتروني مسجل بالفعل لمستخدم آخر." };
    }
    console.error("Create employee auth error:", createAuthErr);
    return { error: "تعذر إنشاء حساب الموظف في نظام المصادقة." };
  }

  const newUserId = authData.user.id;

  // 2. ربط الملف الشخصي بالموظف والفرع وإجبار تغيير كلمة السر
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      user_id: newUserId,
      org_id: orgId,
      branch_id: branchId,
      role: "employee",
      full_name: fullName,
      active: true,
      must_change_password: true,
    },
    { onConflict: "user_id" },
  );

  if (profileErr) {
    console.error("Create employee profile error:", profileErr);
    // تراجع وحذف المستخدم إن فشل إنشاء الملف
    await admin.auth.admin.deleteUser(newUserId);
    return { error: "تعذر ربط بيانات الموظف بالفرع." };
  }

  // جلب اسم المكتب والـ slug لبطاقة الدخول
  const { data: orgData } = await admin
    .from("organizations")
    .select("name, slug")
    .eq("id", orgId)
    .maybeSingle();

  revalidatePath("/dashboard");

  return {
    success: true,
    credentials: {
      employeeName: fullName,
      email,
      tempPassword,
      branchName: branch.name,
      officeName: orgData?.name ?? "المكتب",
      slug: orgData?.slug ?? null,
    },
  };
}

/**
 * 4) تبديل حالة الموظف (نشط / موقوف)
 */
export async function toggleEmployeeStatusAction(
  userId: string,
  currentActive: boolean,
): Promise<{ success?: boolean; error?: string }> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const orgId = session.profile.org_id;
  if (!orgId || !userId) return { error: "بيانات غير مكتملة." };

  const admin = createSupabaseAdminClient();

  // التحقق من أن الموظف يتبع نفس المكتب
  const { data: profile } = await admin
    .from("profiles")
    .select("user_id, org_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile || profile.org_id !== orgId || profile.role !== "employee") {
    return { error: "الموظف غير موجود أو ليس لديك صلاحية تعديله." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ active: !currentActive })
    .eq("user_id", userId);

  if (error) {
    return { error: "تعذر تحديث حالة الموظف." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * 5) إعادة تعيين كلمة مرور الموظف
 */
export async function resetEmployeePasswordAction(
  userId: string,
): Promise<DashboardActionResult> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const orgId = session.profile.org_id;
  if (!orgId || !userId) return { error: "بيانات غير مكتملة." };

  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select(`
      user_id,
      org_id,
      role,
      full_name,
      branches (
        name
      ),
      organizations (
        name,
        slug
      )
    `)
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile || profile.org_id !== orgId || profile.role !== "employee") {
    return { error: "الموظف غير موجود أو ليس لديك صلاحية تعديله." };
  }

  const newTempPassword = generateSecurePassword(12);

  // تحديث كلمة المرور في Auth
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    password: newTempPassword,
  });

  if (authErr) {
    return { error: "تعذر تحديث كلمة المرور في نظام المصادقة." };
  }

  // إجبار الموظف على تغيير كلمة المرور عند الدخول
  await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("user_id", userId);

  // جلب بريد المستخدم
  const { data: authUser } = await admin.auth.admin.getUserById(userId);

  const orgObj = profile.organizations as unknown as { name?: string; slug?: string } | null;
  const branchObj = profile.branches as unknown as { name?: string } | null;

  revalidatePath("/dashboard");

  return {
    success: true,
    credentials: {
      employeeName: profile.full_name || "الموظف",
      email: authUser?.user?.email || "",
      tempPassword: newTempPassword,
      branchName: branchObj?.name || "الفرع",
      officeName: orgObj?.name || "المكتب",
      slug: orgObj?.slug || null,
    },
  };
}

/**
 * 6) إعادة فتح اليوم (المحاسب فقط)
 */
export async function reopenDayAction(
  branchId: string,
  date: string,
): Promise<{ success?: boolean; error?: string }> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const orgId = session.profile.org_id;
  if (!orgId || !branchId || !date) return { error: "بيانات غير مكتملة." };

  const admin = createSupabaseAdminClient();

  // فحص تبعية الفرع للمكتب
  const { data: branch } = await admin
    .from("branches")
    .select("org_id")
    .eq("id", branchId)
    .maybeSingle();

  if (!branch || branch.org_id !== orgId) {
    return { error: "الفرع غير تابع لهذا المكتب." };
  }

  // فك القفل عن اليوم
  const { error } = await admin
    .from("day_closings")
    .update({ locked: false })
    .eq("branch_id", branchId)
    .eq("date", date);

  if (error) {
    console.error("Reopen day error:", error);
    return { error: "تعذر إعادة فتح اليوم للفرع." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * 7) إنشاء نوع خدمة جديد (الوارد)
 */
export async function createIncomeTypeAction(
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const orgId = session.profile.org_id;
  if (!orgId) return { error: "الحساب غير مرتبط بمكتب." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 60) {
    return { error: "اسم الخدمة يجب أن يكون بين حرفين و60 حرفاً." };
  }

  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("income_types")
    .select("id")
    .eq("org_id", orgId)
    .ilike("name", name)
    .maybeSingle();

  if (existing) {
    return { error: "توجد خدمة بنفس هذا الاسم مسبقاً." };
  }

  const { error } = await admin.from("income_types").insert({
    org_id: orgId,
    name,
    amount_optional: false,
    active: true,
  });

  if (error) {
    console.error("Create income type error:", error);
    return { error: "تعذر إضافة نوع الخدمة. يرجى المحاولة لاحقاً." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/employee");
  return { success: true };
}

/**
 * 8) تعديل مسمى نوع خدمة
 */
export async function updateIncomeTypeAction(
  typeId: string,
  name: string,
): Promise<{ success?: boolean; error?: string }> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const orgId = session.profile.org_id;
  if (!orgId || !typeId) return { error: "بيانات غير مكتملة." };

  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 60) {
    return { error: "اسم الخدمة يجب أن يكون بين حرفين و60 حرفاً." };
  }

  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("income_types")
    .update({ name: cleanName })
    .eq("id", typeId)
    .eq("org_id", orgId);

  if (error) {
    console.error("Update income type error:", error);
    return { error: "تعذر تعديل اسم الخدمة." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/employee");
  return { success: true };
}

/**
 * 9) تبديل حالة تفعيل نوع خدمة (نشط / معطل)
 */
export async function toggleIncomeTypeAction(
  typeId: string,
  currentActive: boolean,
): Promise<{ success?: boolean; error?: string }> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const orgId = session.profile.org_id;
  if (!orgId || !typeId) return { error: "بيانات غير مكتملة." };

  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("income_types")
    .update({ active: !currentActive })
    .eq("id", typeId)
    .eq("org_id", orgId);

  if (error) {
    console.error("Toggle income type error:", error);
    return { error: "تعذر تغيير حالة الخدمة." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/employee");
  return { success: true };
}

/**
 * 10) حذف أو إيقاف نوع خدمة
 */
export async function deleteIncomeTypeAction(
  typeId: string,
): Promise<{ success?: boolean; message?: string; error?: string }> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const orgId = session.profile.org_id;
  if (!orgId || !typeId) return { error: "بيانات غير مكتملة." };

  const admin = createSupabaseAdminClient();

  // محاولة الحذف النهائي
  const { error } = await admin
    .from("income_types")
    .delete()
    .eq("id", typeId)
    .eq("org_id", orgId);

  if (error) {
    // إذا كان هناك سجلات مرتبطة، نقوم بتعطيله بدلاً من حذفه للحفاظ على البيانات
    const { error: deactivateErr } = await admin
      .from("income_types")
      .update({ active: false })
      .eq("id", typeId)
      .eq("org_id", orgId);

    if (deactivateErr) {
      return { error: "تعذر حذف أو تعطيل الخدمة." };
    }

    revalidatePath("/dashboard");
    revalidatePath("/employee");
    return {
      success: true,
      message:
        "تم تعطيل الخدمة بنجاح بدلاً من حذفها لوجود عمليات سابقة مسجلة بها للحفاظ على السجلات.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/employee");
  return { success: true, message: "تم حذف الخدمة بنجاح." };
}
