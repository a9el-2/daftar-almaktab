"use server";

import { revalidatePath } from "next/cache";
import { assertAuthorizedAction } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EmployeeActionResult = {
  success?: boolean;
  error?: string;
};

/**
 * دالة مساعدة لجلب تاريخ اليوم بتوقيت الرياض بصيغة YYYY-MM-DD
 */
function getTodayRiyadh(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * 1) تسجيل وارد جديد
 */
export async function recordIncomeAction(
  formData: FormData,
): Promise<EmployeeActionResult> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "employee" &&
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتسجيل الحركات." };
  }

  const orgId = session.profile.org_id;
  const branchId = session.profile.branch_id;

  if (!orgId || !branchId) {
    return { error: "حسابك غير مرتبط بفرع صالح." };
  }

  const typeId = String(formData.get("typeId") ?? "").trim();
  const customName = String(formData.get("customName") ?? "").trim();
  const rawAmount = String(formData.get("amount") ?? "").trim();
  const rawProfit = String(formData.get("profit") ?? "0").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!typeId) {
    return { error: "يرجى تحديد نوع الوارد / الخدمة." };
  }

  let finalTypeId = typeId;
  let finalNote = note;

  if (typeId === "custom") {
    if (!customName) {
      return { error: "يرجى كتابة اسم الخدمة المخصصة." };
    }
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdminClient();
    let { data: customType } = await admin
      .from("income_types")
      .select("id")
      .eq("org_id", orgId)
      .eq("name", "مخصص")
      .maybeSingle();

    if (!customType) {
      const { data: created, error: createErr } = await admin
        .from("income_types")
        .insert({
          org_id: orgId,
          name: "مخصص",
          amount_optional: false,
          active: true,
        })
        .select("id")
        .single();
      if (createErr || !created) {
        console.error("Create custom income type error:", createErr);
        return { error: "تعذر تسجيل الخدمة المخصصة." };
      }
      customType = created;
    }

    finalTypeId = customType.id;
    finalNote = note ? `[مخصص: ${customName}] ${note}` : `[مخصص: ${customName}]`;
  }

  const amount = rawAmount ? parseFloat(rawAmount) : null;
  const profit = rawProfit ? parseFloat(rawProfit) : 0;

  if (amount !== null && (isNaN(amount) || amount < 0)) {
    return { error: "المبلغ المدخل غير صحيح." };
  }
  if (isNaN(profit) || profit < 0) {
    return { error: "قيمة الربح غير صحيحة." };
  }

  const supabase = await createSupabaseServerClient();
  const todayStr = getTodayRiyadh();

  // فحص ما إذا كان اليوم مغلقاً للفرع
  const { data: closing } = await supabase
    .from("day_closings")
    .select("id, locked")
    .eq("branch_id", branchId)
    .eq("date", todayStr)
    .maybeSingle();

  if (closing?.locked) {
    return {
      error: "اليوم مُقفل لهذا الفرع ولا يمكن تسجيل حركات جديدة. تواصل مع المحاسب.",
    };
  }

  const { error } = await supabase.from("income_entries").insert({
    org_id: orgId,
    branch_id: branchId,
    date: todayStr,
    type_id: finalTypeId,
    amount,
    profit,
    note: finalNote || null,
  });

  if (error) {
    console.error("Record income error:", error);
    return { error: error.message || "تعذر حفظ الوارد." };
  }

  revalidatePath("/employee");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * 2) تسجيل منصرف جديد
 */
export async function recordExpenseAction(
  formData: FormData,
): Promise<EmployeeActionResult> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "employee" &&
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتسجيل الحركات." };
  }

  const orgId = session.profile.org_id;
  const branchId = session.profile.branch_id;

  if (!orgId || !branchId) {
    return { error: "حسابك غير مرتبط بفرع صالح." };
  }

  const rawAmount = String(formData.get("amount") ?? "").trim();
  const recipientName = String(formData.get("recipientName") ?? "").trim();
  const method = String(formData.get("method") ?? "cash").trim();
  const note = String(formData.get("note") ?? "").trim();

  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) {
    return { error: "يرجى إدخال مبلغ منصرف صحيح أكبر من صفر." };
  }

  if (recipientName.length < 2) {
    return { error: "يرجى كتابة اسم المستلم / الجهة." };
  }

  if (!["cash", "network", "transfer"].includes(method)) {
    return { error: "طريقة الدفع غير صالحة." };
  }

  const supabase = await createSupabaseServerClient();
  const todayStr = getTodayRiyadh();

  // فحص ما إذا كان اليوم مغلقاً للفرع
  const { data: closing } = await supabase
    .from("day_closings")
    .select("id, locked")
    .eq("branch_id", branchId)
    .eq("date", todayStr)
    .maybeSingle();

  if (closing?.locked) {
    return {
      error: "اليوم مُقفل لهذا الفرع ولا يمكن تسجيل حركات جديدة.",
    };
  }

  const { error } = await supabase.from("expenses").insert({
    org_id: orgId,
    branch_id: branchId,
    date: todayStr,
    amount,
    recipient_name: recipientName,
    method: method as "cash" | "network" | "transfer",
    note: note || null,
  });

  if (error) {
    console.error("Record expense error:", error);
    return { error: error.message || "تعذر حفظ المنصرف." };
  }

  revalidatePath("/employee");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * 3) تسجيل دين جديد على عميل
 */
export async function recordDebtAction(
  formData: FormData,
): Promise<EmployeeActionResult> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "employee" &&
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتسجيل الديون." };
  }

  const orgId = session.profile.org_id;
  const branchId = session.profile.branch_id;

  if (!orgId || !branchId) return { error: "حسابك غير مرتبط بفرع صالح." };

  let debtorId = String(formData.get("debtorId") ?? "").trim();
  const newDebtorName = String(formData.get("newDebtorName") ?? "").trim();
  const debtorPhone = String(formData.get("debtorPhone") ?? "").trim();
  const rawAmount = String(formData.get("amount") ?? "").trim();
  const rawProfit = String(formData.get("profit") ?? "0").trim();
  const note = String(formData.get("note") ?? "").trim();

  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) {
    return { error: "يرجى إدخال مبلغ دين صالح أكبر من صفر." };
  }

  const profit = rawProfit ? parseFloat(rawProfit) : 0;

  const supabase = await createSupabaseServerClient();
  const todayStr = getTodayRiyadh();

  // فحص ما إذا كان اليوم مغلقاً للفرع
  const { data: closing } = await supabase
    .from("day_closings")
    .select("id, locked")
    .eq("branch_id", branchId)
    .eq("date", todayStr)
    .maybeSingle();

  if (closing?.locked) {
    return { error: "اليوم مُقفل لهذا الفرع." };
  }

  // إذا تم إدخال اسم عميل جديد، نقوم بإنشائه أولاً
  if (!debtorId && newDebtorName) {
    if (newDebtorName.length < 2) {
      return { error: "اسم العميل يجب أن يكون حرفين على الأقل." };
    }

    const { data: newDebtor, error: debtorErr } = await supabase
      .from("debtors")
      .insert({
        org_id: orgId,
        name: newDebtorName,
        phone: debtorPhone || null,
      })
      .select("id")
      .single();

    if (debtorErr || !newDebtor) {
      console.error("Create debtor error:", debtorErr);
      return { error: "تعذر إضافة العميل الجديد." };
    }

    debtorId = newDebtor.id;
  }

  if (!debtorId) {
    return { error: "يرجى اختيار العميل أو إدخال اسم عميل جديد." };
  }

  const { error } = await supabase.from("debts").insert({
    org_id: orgId,
    debtor_id: debtorId,
    branch_id: branchId,
    date: todayStr,
    amount,
    profit,
    note: note || null,
  });

  if (error) {
    console.error("Record debt error:", error);
    return { error: error.message || "تعذر حفظ الدين." };
  }

  revalidatePath("/employee");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * 4) تسجيل سداد دين (استلام نقدي من عميل)
 */
export async function recordDebtPaymentAction(
  formData: FormData,
): Promise<EmployeeActionResult> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "employee" &&
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتسجيل سداد الديون." };
  }

  const orgId = session.profile.org_id;
  const branchId = session.profile.branch_id;

  if (!orgId || !branchId) return { error: "حسابك غير مرتبط بفرع صالح." };

  const debtId = String(formData.get("debtId") ?? "").trim();
  const rawAmount = String(formData.get("amount") ?? "").trim();

  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) {
    return { error: "يرجى إدخال مبلغ سداد صحيح أكبر من صفر." };
  }

  if (!debtId) {
    return { error: "يرجى اختيار الدين المراد سداده." };
  }

  const supabase = await createSupabaseServerClient();
  const todayStr = getTodayRiyadh();

  // فحص ما إذا كان اليوم مغلقاً للفرع
  const { data: closing } = await supabase
    .from("day_closings")
    .select("id, locked")
    .eq("branch_id", branchId)
    .eq("date", todayStr)
    .maybeSingle();

  if (closing?.locked) {
    return { error: "اليوم مُقفل لهذا الفرع." };
  }

  // إدخال سداد الدين (التريجر prepare_debt_payment سيعبئ org_id, branch_id, debtor_id ويتحقق من عدم تجاوز المتبقي)
  const { error } = await supabase.from("debt_payments").insert({
    org_id: orgId,
    debt_id: debtId,
    branch_id: branchId,
    date: todayStr,
    amount,
  });

  if (error) {
    console.error("Record debt payment error:", error);
    return { error: error.message || "تعذر تسجيل السداد." };
  }

  revalidatePath("/employee");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * 5) تسجيل حوالة بنكية
 */
export async function recordBankTransferAction(
  formData: FormData,
): Promise<EmployeeActionResult> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "employee" &&
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بتسجيل الحوالات." };
  }

  const orgId = session.profile.org_id;
  const branchId = session.profile.branch_id;

  if (!orgId || !branchId) return { error: "حسابك غير مرتبط بفرع صالح." };

  const type = String(formData.get("type") ?? "incoming").trim();
  const rawAmount = String(formData.get("amount") ?? "").trim();
  const rawFee = String(formData.get("fee") ?? "0").trim();
  const statement = String(formData.get("statement") ?? "").trim();

  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) {
    return { error: "يرجى إدخال مبلغ حوالة صالح." };
  }

  const fee = rawFee ? parseFloat(rawFee) : 0;
  if (statement.length < 2) {
    return { error: "يرجى كتابة بيان الحوالة أو اسم البنك/العميل." };
  }

  const supabase = await createSupabaseServerClient();
  const todayStr = getTodayRiyadh();

  // فحص ما إذا كان اليوم مغلقاً للفرع
  const { data: closing } = await supabase
    .from("day_closings")
    .select("id, locked")
    .eq("branch_id", branchId)
    .eq("date", todayStr)
    .maybeSingle();

  if (closing?.locked) {
    return { error: "اليوم مُقفل لهذا الفرع." };
  }

  const { error } = await supabase.from("bank_transfers").insert({
    org_id: orgId,
    branch_id: branchId,
    date: todayStr,
    type: type as "incoming" | "outgoing",
    amount,
    fee,
    statement,
  });

  if (error) {
    console.error("Record bank transfer error:", error);
    return { error: error.message || "تعذر حفظ الحوالة." };
  }

  revalidatePath("/employee");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * 6) إغلاق اليوم (Daily Close) للفرع
 */
export async function closeDayAction(
  formData: FormData,
): Promise<EmployeeActionResult> {
  const session = await assertAuthorizedAction();
  if (
    session.profile.role !== "employee" &&
    session.profile.role !== "accountant" &&
    session.profile.role !== "super_admin"
  ) {
    return { error: "غير مصرح لك بإغلاق اليوم." };
  }

  const orgId = session.profile.org_id;
  const branchId = session.profile.branch_id;

  if (!orgId || !branchId) return { error: "حسابك غير مرتبط بفرع صالح." };

  const rawActualCash = String(formData.get("actualCash") ?? "").trim();
  if (!rawActualCash) {
    return { error: "يرجى إدخال مبلغ النقدية الفعلي في الدرج." };
  }

  const actualCash = parseFloat(rawActualCash);
  if (isNaN(actualCash) || actualCash < 0) {
    return { error: "المبلغ الفعلي المدخل غير صالح." };
  }

  const supabase = await createSupabaseServerClient();
  const todayStr = getTodayRiyadh();

  // فحص ما إذا كان مغلقاً مسبقاً
  const { data: existingClosing } = await supabase
    .from("day_closings")
    .select("id, locked")
    .eq("branch_id", branchId)
    .eq("date", todayStr)
    .maybeSingle();

  if (existingClosing?.locked) {
    return { error: "اليوم مغلق بالفعل لهذا الفرع." };
  }

  // حساب الرصيد الدفتري لليوم (الوارد النقدي + سداد الديون - المنصرف النقدي)
  const [{ data: incomes }, { data: expenses }, { data: payments }] =
    await Promise.all([
      supabase
        .from("income_entries")
        .select("amount")
        .eq("branch_id", branchId)
        .eq("date", todayStr),
      supabase
        .from("expenses")
        .select("amount, method")
        .eq("branch_id", branchId)
        .eq("date", todayStr),
      supabase
        .from("debt_payments")
        .select("amount")
        .eq("branch_id", branchId)
        .eq("date", todayStr),
    ]);

  const totalIncome = (incomes || []).reduce(
    (acc, curr) => acc + Number(curr.amount || 0),
    0,
  );
  // المنصرف النقدي فقط يؤثر على الدرج
  const totalCashExpenses = (expenses || [])
    .filter((e) => e.method === "cash")
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalPayments = (payments || []).reduce(
    (acc, curr) => acc + Number(curr.amount || 0),
    0,
  );

  const bookBalance = totalIncome + totalPayments - totalCashExpenses;
  const difference = actualCash - bookBalance;

  const { error } = await supabase.from("day_closings").upsert(
    {
      org_id: orgId,
      branch_id: branchId,
      date: todayStr,
      opening_balance: 0,
      book_balance: bookBalance,
      actual_cash_counted: actualCash,
      difference: difference,
      locked: true,
      closed_at: new Date().toISOString(),
    },
    { onConflict: "branch_id, date" },
  );

  if (error) {
    console.error("Close day error:", error);
    return { error: error.message || "تعذر إغلاق اليوم. يرجى المحاولة لاحقاً." };
  }

  revalidatePath("/employee");
  revalidatePath("/dashboard");
  return { success: true };
}
