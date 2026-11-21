"use server";

import { revalidatePath } from "next/cache";
import { assertAuthorizedAction } from "@/lib/auth";
import { isValidHexColor } from "@/lib/colors";
import { generateSecurePassword } from "@/lib/password";
import {
  type ImageValidationResult,
  MAX_LOGO_SIZE_BYTES,
  validateImageBuffer,
} from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminActionResult = {
  success?: boolean;
  error?: string;
  credentials?: {
    officeName: string;
    slug: string;
    accountantName: string;
    email: string;
    tempPassword: string;
  };
};

const RESERVED_SLUGS = new Set([
  "admin",
  "login",
  "api",
  "setup",
  "dashboard",
  "employee",
  "change-password",
  "demo",
  "pending",
  "auth",
  "public",
  "static",
  "user",
  "users",
  "account",
  "organizations",
  "branch",
  "branches",
  "o",
]);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * 1) إنشاء مكتب جديد مع حسابه المحاسب الافتراضي وهويته البصرية
 */
export async function createOrganizationAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const session = await assertAuthorizedAction();
  if (session.profile.role !== "super_admin") {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const plan = String(formData.get("plan") ?? "monthly").trim();
  const subscriptionEnd = String(formData.get("subscriptionEnd") ?? "").trim();
  const accountantName = String(formData.get("accountantName") ?? "").trim();
  const accountantEmail = String(formData.get("accountantEmail") ?? "")
    .trim()
    .toLowerCase();
  let tempPassword = String(formData.get("tempPassword") ?? "").trim();

  const primaryColorInput = String(formData.get("primaryColor") ?? "").trim();
  const secondaryColorInput = String(formData.get("secondaryColor") ?? "").trim();
  const logoFile = formData.get("logoFile") as File | null;

  // التحقق من المدخلات الأساسية
  if (name.length < 2 || name.length > 80) {
    return { error: "اسم المكتب يجب أن يكون بين حرفين و80 حرفاً." };
  }

  if (!rawSlug || !slugPattern.test(rawSlug)) {
    return {
      error:
        "رابط المكتب (slug) يجب أن يتكون من أحرف إنجليزية صغيرة وأرقام وشرطات فقط، بدون مسافات أو رموز خاصة.",
    };
  }

  if (rawSlug.length < 2 || rawSlug.length > 40) {
    return { error: "رابط المكتب يجب أن يكون بين حرفين و40 حرفاً." };
  }

  if (RESERVED_SLUGS.has(rawSlug)) {
    return { error: `الرابط "${rawSlug}" محجوز للنظام. يرجى اختيار رابط آخر.` };
  }

  if (plan !== "monthly" && plan !== "lifetime") {
    return { error: "نوع الخطة غير صالح." };
  }

  if (plan === "monthly" && !subscriptionEnd) {
    return { error: "يرجى تحديد تاريخ انتهاء الاشتراك للخطة الشهرية." };
  }

  if (accountantName.length < 2 || accountantName.length > 80) {
    return { error: "اسم المحاسب يجب أن يكون بين حرفين و80 حرفاً." };
  }

  if (!emailPattern.test(accountantEmail)) {
    return { error: "صيغة البريد الإلكتروني غير صحيحة." };
  }

  if (!tempPassword) {
    tempPassword = generateSecurePassword(12);
  } else if (tempPassword.length < 8) {
    return { error: "كلمة المرور المؤقتة يجب أن تكون 8 أحرف على الأقل." };
  }

  // التحقق الصارم من الألوان بصيغة #RRGGBB
  let primaryColor = "#0f766e";
  if (primaryColorInput) {
    if (!isValidHexColor(primaryColorInput)) {
      return {
        error:
          "اللون الأساسي غير صالح. يجب أن يكون بصيغة الرمز السداسي عشر #RRGGBB.",
      };
    }
    primaryColor = primaryColorInput.toLowerCase();
  }

  let secondaryColor: string | null = null;
  if (secondaryColorInput) {
    if (!isValidHexColor(secondaryColorInput)) {
      return {
        error:
          "اللون الثانوي غير صالح. يجب أن يكون بصيغة الرمز السداسي عشر #RRGGBB.",
      };
    }
    secondaryColor = secondaryColorInput.toLowerCase();
  }

  // فحص الشعار في حال تم إرفاقه (فحص الحجم والنوع الحقيقي بالسيرفر قبل أي عملية)
  let logoBuffer: Buffer | null = null;
  let logoValidation: ImageValidationResult | null = null;
  if (logoFile && logoFile.size > 0) {
    if (logoFile.size > MAX_LOGO_SIZE_BYTES) {
      return {
        error: "حجم الشعار يتجاوز الحد الأقصى المسموح (1 ميجابايت).",
      };
    }
    const arrayBuffer = await logoFile.arrayBuffer();
    logoBuffer = Buffer.from(arrayBuffer);
    logoValidation = validateImageBuffer(logoBuffer);
    if (!logoValidation.valid) {
      return { error: logoValidation.error };
    }
  }

  const admin = createSupabaseAdminClient();

  // التحقق من عدم تكرار الرابط
  const { data: existingSlug } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", rawSlug)
    .maybeSingle();

  if (existingSlug) {
    return { error: "هذا الرابط مستخدم بالفعل لمكتب آخر. اختر رابطاً مختلفاً." };
  }

  // 1) إنشاء المستخدم في Supabase Auth أولاً
  const { data: createdAuth, error: authErr } =
    await admin.auth.admin.createUser({
      email: accountantEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: accountantName },
    });

  if (authErr || !createdAuth?.user) {
    if (authErr?.message.toLowerCase().includes("already")) {
      return { error: "هذا البريد الإلكتروني مسجل مسبقاً في النظام." };
    }
    return { error: "تعذر إنشاء حساب المحاسب. تحقق من صحة البريد." };
  }

  const userId = createdAuth.user.id;
  let createdOrgId: string | null = null;

  try {
    // 2) إنشاء المكتب
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({
        name,
        slug: rawSlug,
        plan,
        subscription_end: plan === "monthly" ? subscriptionEnd : null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        active: true,
        debt_profit_timing: "on_payment",
      })
      .select("id")
      .single();

    if (orgErr || !org) {
      throw new Error(orgErr?.message || "تعذر إنشاء المكتب.");
    }
    createdOrgId = org.id;

    // رفع الشعار لوحدة التخزين إن وُجد
    if (logoBuffer && logoValidation && logoValidation.valid) {
      const randomName = crypto.randomUUID();
      const filePath = `${createdOrgId}/${randomName}.${logoValidation.extension}`;

      const { error: uploadError } = await admin.storage
        .from("office-assets")
        .upload(filePath, logoBuffer, {
          contentType: logoValidation.mimeType,
          cacheControl: "31536000",
          upsert: false,
        });

      if (!uploadError) {
        const { data: publicUrlData } = admin.storage
          .from("office-assets")
          .getPublicUrl(filePath);

        await admin
          .from("organizations")
          .update({ logo_url: publicUrlData.publicUrl })
          .eq("id", createdOrgId);
      }
    }

    // 3) إنشاء الفرع الرئيسي الافتراضي
    const { error: branchErr } = await admin.from("branches").insert({
      org_id: createdOrgId,
      name: "الفرع الرئيسي",
      active: true,
    });
    if (branchErr) throw branchErr;

    // 4) إنشاء أنواع الوارد الافتراضية
    await admin.from("income_types").insert([
      { org_id: createdOrgId, name: "سداد", amount_optional: false, active: true },
      { org_id: createdOrgId, name: "شغل", amount_optional: false, active: true },
    ]);

    // 5) إنشاء ملف المحاسب في جدول profiles مع فرض تغيير كلمة السر
    const { error: profileErr } = await admin.from("profiles").insert({
      user_id: userId,
      org_id: createdOrgId,
      branch_id: null,
      role: "accountant",
      full_name: accountantName,
      active: true,
      must_change_password: true,
    });
    if (profileErr) throw profileErr;

    revalidatePath("/admin");

    return {
      success: true,
      credentials: {
        officeName: name,
        slug: rawSlug,
        accountantName,
        email: accountantEmail,
        tempPassword,
      },
    };
  } catch (err) {
    console.error("Rollback office creation error:", err);

    // تراجع أمني: حذف الحساب المنشأ حتى لا تبقى حسابات يتيمة
    await admin.auth.admin.deleteUser(userId);

    // حذف المكتب إن كان قد أُنشئ
    if (createdOrgId) {
      await admin.from("organizations").delete().eq("id", createdOrgId);
    }

    return {
      error:
        "حدث خطأ أثناء حفظ بيانات المكتب. تم التراجع وحذف الحساب لمنع بقاء بيانات يتيمة.",
    };
  }
}

/**
 * 2) تحديث الهوية البصرية للمكتب وبياناته
 */
export async function updateOrganizationBrandingAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "super_admin" &&
    session.profile.role !== "accountant"
  ) {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const orgId = String(formData.get("orgId") ?? "").trim();
  if (!orgId) return { error: "معرف المكتب غير محدد." };

  // فحص العزل الأمني: مستخدم المكتب لا يستطيع أبداً تعديل مكتب آخر
  if (
    session.profile.role !== "super_admin" &&
    session.profile.org_id !== orgId
  ) {
    return { error: "غير مصرح لك بتعديل بيانات أو شعار مكتب آخر." };
  }

  const primaryColorInput = String(formData.get("primaryColor") ?? "").trim();
  const secondaryColorInput = String(
    formData.get("secondaryColor") ?? "",
  ).trim();
  const removeLogo = formData.get("removeLogo") === "true";
  const logoFile = formData.get("logoFile") as File | null;
  const officeName = String(formData.get("name") ?? "").trim();

  let primaryColor = "#0f766e";
  if (primaryColorInput) {
    if (!isValidHexColor(primaryColorInput)) {
      return { error: "اللون الأساسي غير صالح. يجب أن يكون بصيغة #RRGGBB." };
    }
    primaryColor = primaryColorInput.toLowerCase();
  }

  let secondaryColor: string | null = null;
  if (secondaryColorInput) {
    if (!isValidHexColor(secondaryColorInput)) {
      return { error: "اللون الثانوي غير صالح. يجب أن يكون بصيغة #RRGGBB." };
    }
    secondaryColor = secondaryColorInput.toLowerCase();
  }

  // فحص الشعار في حال تم اختياره
  let logoBuffer: Buffer | null = null;
  let logoValidation: ImageValidationResult | null = null;
  if (logoFile && logoFile.size > 0) {
    if (logoFile.size > MAX_LOGO_SIZE_BYTES) {
      return { error: "حجم الشعار يتجاوز الحد الأقصى المسموح (1 ميجابايت)." };
    }
    const arrayBuffer = await logoFile.arrayBuffer();
    logoBuffer = Buffer.from(arrayBuffer);
    logoValidation = validateImageBuffer(logoBuffer);
    if (!logoValidation.valid) {
      return { error: logoValidation.error };
    }
  }

  const admin = createSupabaseAdminClient();

  // جلب المكتب الحالي
  const { data: existingOrg, error: findErr } = await admin
    .from("organizations")
    .select("id, name, logo_url")
    .eq("id", orgId)
    .maybeSingle();

  if (findErr || !existingOrg) {
    return { error: "المكتب المطلوب غير موجود." };
  }

  let newLogoUrl = existingOrg.logo_url;

  if (removeLogo) {
    newLogoUrl = null;
  }

  if (logoBuffer && logoValidation && logoValidation.valid) {
    const randomName = crypto.randomUUID();
    const filePath = `${orgId}/${randomName}.${logoValidation.extension}`;

    const { error: uploadError } = await admin.storage
      .from("office-assets")
      .upload(filePath, logoBuffer, {
        contentType: logoValidation.mimeType,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return { error: "تعذر رفع الشعار لوحدة التخزين." };
    }

    const { data: publicUrlData } = admin.storage
      .from("office-assets")
      .getPublicUrl(filePath);

    newLogoUrl = publicUrlData.publicUrl;
  }

  const updates: Record<string, string | null> = {
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    logo_url: newLogoUrl,
  };

  // لو كان مدير نظام وأرسل اسماً جديداً
  if (
    session.profile.role === "super_admin" &&
    officeName &&
    officeName.length >= 2 &&
    officeName.length <= 80
  ) {
    updates.name = officeName;
  }

  const { error: updateErr } = await admin
    .from("organizations")
    .update(updates)
    .eq("id", orgId);

  if (updateErr) {
    console.error("Update org error:", updateErr);
    return { error: "تعذر حفظ تعديلات الهوية البصرية." };
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/employee");

  return { success: true };
}

/**
 * 3) إعادة تعيين كلمة مرور المحاسب
 */
export async function resetAccountantPasswordAction(
  userId: string,
  officeName: string,
  slug: string,
): Promise<AdminActionResult> {
  const session = await assertAuthorizedAction();
  if (session.profile.role !== "super_admin") {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  if (!userId) return { error: "معرف المستخدم غير صحيح." };

  const admin = createSupabaseAdminClient();

  // التحقق من أن المستخدم محاسب
  const { data: targetProfile } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (!targetProfile || targetProfile.role !== "accountant") {
    return { error: "المستخدم المطلوب ليس محاسباً صالحاً." };
  }

  // توليد كلمة مرور جديدة قوية
  const newTempPassword = generateSecurePassword(12);

  // تحديث كلمة السر في Supabase Auth
  const { data: updatedUser, error: authErr } =
    await admin.auth.admin.updateUserById(userId, {
      password: newTempPassword,
    });

  if (authErr || !updatedUser?.user) {
    return { error: "تعذر تحديث كلمة المرور في نظام المصادقة." };
  }

  // إجبار تغيير كلمة السر في جدول profiles
  const { error: profileErr } = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("user_id", userId);

  if (profileErr) {
    return { error: "تعذر تفعيل شرط تغيير كلمة المرور للمستخدم." };
  }

  // جلب بريد المحاسب
  const { data: authUser } = await admin.auth.admin.getUserById(userId);

  revalidatePath("/admin");

  return {
    success: true,
    credentials: {
      officeName,
      slug,
      accountantName: targetProfile.full_name || "المحاسب",
      email: authUser?.user?.email || "",
      tempPassword: newTempPassword,
    },
  };
}

/**
 * 4) إيقاف المكتب أو إعادة تفعيله
 */
export async function toggleOrganizationStatusAction(
  orgId: string,
  currentActive: boolean,
): Promise<{ success?: boolean; error?: string }> {
  const session = await assertAuthorizedAction();
  if (session.profile.role !== "super_admin") {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const admin = createSupabaseAdminClient();
  const nextActive = !currentActive;

  const { error } = await admin
    .from("organizations")
    .update({ active: nextActive })
    .eq("id", orgId);

  if (error) {
    return { error: "تعذر تحديث حالة المكتب." };
  }

  revalidatePath("/admin");
  return { success: true };
}

/**
 * 5) تعديل خطة المكتب وتاريخ الانتهاء
 */
export async function updateOrganizationPlanAction(
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const session = await assertAuthorizedAction();
  if (session.profile.role !== "super_admin") {
    return { error: "غير مصرح لك بتنفيذ هذه العملية." };
  }

  const orgId = String(formData.get("orgId") ?? "").trim();
  const plan = String(formData.get("plan") ?? "monthly").trim();
  const subscriptionEnd = String(formData.get("subscriptionEnd") ?? "").trim();

  if (!orgId) return { error: "معرف المكتب مفقود." };
  if (plan !== "monthly" && plan !== "lifetime") {
    return { error: "نوع الخطة غير صالح." };
  }
  if (plan === "monthly" && !subscriptionEnd) {
    return { error: "يرجى تحديد تاريخ انتهاء الاشتراك." };
  }

  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("organizations")
    .update({
      plan,
      subscription_end: plan === "monthly" ? subscriptionEnd : null,
    })
    .eq("id", orgId);

  if (error) {
    return { error: "تعذر تحديث خطة الاشتراك." };
  }

  revalidatePath("/admin");
  return { success: true };
}
