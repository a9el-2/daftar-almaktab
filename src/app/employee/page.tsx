import AppHeader from "@/components/AppHeader";
import EmployeeHome, {
  type DayClosingInfo,
  type DebtorWithDebt,
  type EmployeeTransaction,
  type IncomeType,
} from "@/components/screens/EmployeeHome";
import { displayName, requireProfile, ROLE_LABEL } from "@/lib/auth";
import { getThemeVariables } from "@/lib/colors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "شاشة الموظف | دفتر الصندوق" };

export default async function EmployeePage() {
  const session = await requireProfile(["employee", "accountant", "super_admin"]);
  const orgId = session.profile.org_id;

  if (!orgId) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <p className="font-bold text-slate-800">الحساب غير مرتبط بمكتب</p>
          <p className="mt-1 text-xs text-slate-500">
            يرجى مراجعة المحاسب أو مدير النظام لربط حسابك بالمكتب والفرع.
          </p>
        </div>
      </div>
    );
  }

  const admin = createSupabaseAdminClient();

  // جلب الفرع
  let branchId = session.profile.branch_id;
  let branchName = session.profile.branch?.name;

  if (!branchId) {
    // لو كان محاسب أو مدير نظام يجرب شاشة الموظف، نختار أول فرع متاح
    const { data: firstBranch } = await admin
      .from("branches")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (firstBranch) {
      branchId = firstBranch.id;
      branchName = firstBranch.name;
    }
  }

  if (!branchId) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <p className="font-bold text-slate-800">لا يوجد فرع متاح</p>
          <p className="mt-1 text-xs text-slate-500">
            يرجى إنشاء فرع أولاً من لوحة المحاسب وتعيين الموظف عليه.
          </p>
        </div>
      </div>
    );
  }

  // 1) تاريخ اليوم بتوقيت الرياض
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const todayFormatted = new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  // 2) جلب أنواع الوارد (مع إضافة الافتراضيات إذا لم تكن موجودة)
  let { data: incomeTypesData } = await admin
    .from("income_types")
    .select("id, name, amount_optional")
    .eq("org_id", orgId)
    .eq("active", true)
    .order("name");

  if (!incomeTypesData || incomeTypesData.length === 0) {
    const { data: seeded } = await admin
      .from("income_types")
      .insert([
        { org_id: orgId, name: "خدمات مكتبية", amount_optional: false, active: true },
        { org_id: orgId, name: "سداد", amount_optional: false, active: true },
        { org_id: orgId, name: "شغل", amount_optional: false, active: true },
      ])
      .select("id, name, amount_optional");
    incomeTypesData = seeded || [];
  }

  const incomeTypes: IncomeType[] = (incomeTypesData || []).map((t) => ({
    id: t.id,
    name: t.name,
    amount_optional: t.amount_optional,
  }));

  // 3) جلب الديون غير المسددة
  const { data: debtsData } = await admin
    .from("debts")
    .select(`
      id,
      debtor_id,
      amount,
      date,
      debtors (
        name
      ),
      debt_payments (
        amount
      )
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const unpaidDebts: DebtorWithDebt[] = [];
  for (const d of debtsData || []) {
    const rawPayments = d.debt_payments as unknown as Array<{ amount: number }> | null;
    const paidSum = (rawPayments || []).reduce(
      (acc, p) => acc + Number(p.amount || 0),
      0,
    );
    const remaining = Number(d.amount) - paidSum;
    if (remaining > 0) {
      const debtorObj = d.debtors as unknown as { name?: string } | null;
      unpaidDebts.push({
        debtId: d.id,
        debtorId: d.debtor_id,
        debtorName: debtorObj?.name || "عميل",
        remainingAmount: remaining,
        originalAmount: Number(d.amount),
        date: d.date,
      });
    }
  }

  // 4) جلب إغلاق اليوم لهذا الفرع إن وجد
  const { data: closingData } = await admin
    .from("day_closings")
    .select("id, locked, actual_cash_counted, book_balance, difference, closed_at")
    .eq("branch_id", branchId)
    .eq("date", todayStr)
    .maybeSingle();

  const dayClosing: DayClosingInfo = closingData
    ? {
        locked: closingData.locked,
        actual_cash_counted:
          closingData.actual_cash_counted !== null
            ? Number(closingData.actual_cash_counted)
            : null,
        book_balance: Number(closingData.book_balance),
        difference:
          closingData.difference !== null
            ? Number(closingData.difference)
            : null,
        closed_at: closingData.closed_at,
      }
    : null;

  // 5) جلب حركات اليوم لهذا الفرع
  const [
    { data: incomes },
    { data: expenses },
    { data: payments },
    { data: debts },
    { data: transfers },
  ] = await Promise.all([
    admin
      .from("income_entries")
      .select("id, amount, profit, note, created_at, income_types(name)")
      .eq("branch_id", branchId)
      .eq("date", todayStr)
      .order("created_at", { ascending: false }),
    admin
      .from("expenses")
      .select("id, amount, recipient_name, method, note, created_at")
      .eq("branch_id", branchId)
      .eq("date", todayStr)
      .order("created_at", { ascending: false }),
    admin
      .from("debt_payments")
      .select("id, amount, created_at, debtors(name)")
      .eq("branch_id", branchId)
      .eq("date", todayStr)
      .order("created_at", { ascending: false }),
    admin
      .from("debts")
      .select("id, amount, note, created_at, debtors(name)")
      .eq("branch_id", branchId)
      .eq("date", todayStr)
      .order("created_at", { ascending: false }),
    admin
      .from("bank_transfers")
      .select("id, amount, fee, type, statement, created_at")
      .eq("branch_id", branchId)
      .eq("date", todayStr)
      .order("created_at", { ascending: false }),
  ]);

  // الحسابات المالية
  const totalIncome = (incomes || []).reduce(
    (acc, curr) => acc + Number(curr.amount || 0),
    0,
  );
  const totalExpenses = (expenses || []).reduce(
    (acc, curr) => acc + Number(curr.amount || 0),
    0,
  );
  const totalCashExpenses = (expenses || [])
    .filter((e) => e.method === "cash")
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalPayments = (payments || []).reduce(
    (acc, curr) => acc + Number(curr.amount || 0),
    0,
  );

  // الرصيد النقدي في الدرج
  const cashInDrawer = totalIncome + totalPayments - totalCashExpenses;

  // الحركات المسجلة
  const feed: EmployeeTransaction[] = [];

  for (const inc of incomes || []) {
    const typeObj = inc.income_types as unknown as { name?: string } | null;
    let label = typeObj?.name || "وارد";
    let desc = inc.note || "";
    if (inc.note && inc.note.includes("[مخصص:")) {
      const match = inc.note.match(/\[مخصص:\s*([^\]]+)\]/);
      if (match && match[1]) {
        label = match[1].trim();
        desc = inc.note.replace(/\[مخصص:\s*[^\]]+\]/, "").trim();
      }
    }
    feed.push({
      id: inc.id,
      kind: "income",
      amount: Number(inc.amount || 0),
      description: desc ? `${label}: ${desc}` : label,
      time: new Date(inc.created_at).toLocaleTimeString("ar-SA", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  for (const exp of expenses || []) {
    feed.push({
      id: exp.id,
      kind: "expense",
      amount: Number(exp.amount || 0),
      description: exp.note
        ? `${exp.recipient_name} (${exp.note})`
        : exp.recipient_name,
      time: new Date(exp.created_at).toLocaleTimeString("ar-SA", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  for (const pay of payments || []) {
    const debtorObj = pay.debtors as unknown as { name?: string } | null;
    feed.push({
      id: pay.id,
      kind: "debt_payment",
      amount: Number(pay.amount || 0),
      description: `سداد دين: ${debtorObj?.name || "عميل"}`,
      time: new Date(pay.created_at).toLocaleTimeString("ar-SA", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  for (const d of debts || []) {
    const debtorObj = d.debtors as unknown as { name?: string } | null;
    feed.push({
      id: d.id,
      kind: "debt",
      amount: Number(d.amount || 0),
      description: `تسجيل دين على: ${debtorObj?.name || "عميل"}`,
      time: new Date(d.created_at).toLocaleTimeString("ar-SA", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  for (const tr of transfers || []) {
    feed.push({
      id: tr.id,
      kind: "bank_transfer",
      amount: Number(tr.amount || 0),
      description: `حوالة ${tr.type === "incoming" ? "واردة" : "صادرة"}: ${tr.statement}`,
      time: new Date(tr.created_at).toLocaleTimeString("ar-SA", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  feed.sort((a, b) => b.time.localeCompare(a.time));

  const orgName = session.profile.organization?.name ?? "المكتب";
  const primaryColor = session.profile.organization?.primary_color;
  const secondaryColor = session.profile.organization?.secondary_color;
  const themeVars = getThemeVariables(primaryColor, secondaryColor);

  return (
    <div
      style={themeVars as React.CSSProperties}
      className="min-h-dvh bg-slate-50/60"
    >
      <AppHeader
        title={orgName}
        subtitle={branchName ?? "الفرع"}
        roleLabel={ROLE_LABEL[session.profile.role]}
        userName={displayName(session)}
        logoUrl={session.profile.organization?.logo_url}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
      />

      <EmployeeHome
        userName={displayName(session)}
        branchName={branchName ?? "الفرع"}
        officeName={orgName}
        primaryColor={primaryColor}
        todayDateFormatted={todayFormatted}
        incomeTypes={incomeTypes}
        unpaidDebts={unpaidDebts}
        transactions={feed}
        todayIncome={totalIncome}
        todayExpenses={totalExpenses}
        cashInDrawer={cashInDrawer}
        dayClosing={dayClosing}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
