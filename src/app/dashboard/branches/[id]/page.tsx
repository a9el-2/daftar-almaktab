import { notFound, redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { displayName, requireProfile, ROLE_LABEL } from "@/lib/auth";
import { getThemeVariables } from "@/lib/colors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import BranchDetailView, {
  type BranchDayClosing,
  type BranchDebtRow,
  type BranchExpenseRow,
  type BranchIncomeRow,
  type BranchPaymentRow,
  type BranchTransferRow,
  type MonthDaySummary,
} from "./BranchDetailView";

export const metadata = { title: "سجلات وتقارير الفرع | دفتر الصندوق" };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; month?: string; view?: string }>;
};

export default async function BranchDetailPage({
  params,
  searchParams,
}: PageProps) {
  const session = await requireProfile(["accountant", "super_admin"]);
  const orgId = session.profile.org_id;

  if (!orgId) {
    redirect("/dashboard");
  }

  const { id: branchId } = await params;
  const { date: rawDate, month: rawMonth } = await searchParams;

  const admin = createSupabaseAdminClient();

  // 1) جلب بيانات المكتب الحالية
  const { data: orgData } = await admin
    .from("organizations")
    .select("id, name, logo_url, primary_color, secondary_color")
    .eq("id", orgId)
    .single();

  const org = {
    name: orgData?.name || "المكتب",
    logo_url: orgData?.logo_url || null,
    primary_color: orgData?.primary_color || "#0f766e",
    secondary_color: orgData?.secondary_color || null,
  };

  // 2) جلب جميع فروع المكتب (للتبديل السريع بين الفرع الأول والثاني...)
  const { data: branchesData } = await admin
    .from("branches")
    .select("id, name, active")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  const allBranches = (branchesData || []).map((b) => ({
    id: b.id,
    name: b.name,
  }));

  const currentBranch = branchesData?.find((b) => b.id === branchId);
  if (!currentBranch) {
    notFound();
  }

  // 3) تواريخ العرض (توقيت الرياض)
  const now = new Date();
  const todayDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const selectedDate =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayDateStr;

  const selectedMonth =
    rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)
      ? rawMonth
      : selectedDate.substring(0, 7);

  // تنسيق تاريخ اليوم بالعربية
  const dateObj = new Date(selectedDate + "T12:00:00Z");
  const formattedDate = new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(dateObj);

  // 4) جلب أسماء الموظفين للربط
  const { data: profilesData } = await admin
    .from("profiles")
    .select("user_id, full_name")
    .eq("org_id", orgId);

  const userMap = new Map<string, string>(
    (profilesData || []).map((p) => [p.user_id, p.full_name || "موظف"]),
  );

  // 5) جلب حركات اليوم المحدد للفرع
  const [
    { data: incomeRows },
    { data: expenseRows },
    { data: debtRows },
    { data: paymentRows },
    { data: transferRows },
    { data: closingRow },
  ] = await Promise.all([
    admin
      .from("income_entries")
      .select("id, amount, profit, note, created_by, created_at, income_types(name)")
      .eq("branch_id", branchId)
      .eq("date", selectedDate)
      .order("created_at", { ascending: true }),
    admin
      .from("expenses")
      .select("id, amount, recipient_name, method, note, created_by, created_at")
      .eq("branch_id", branchId)
      .eq("date", selectedDate)
      .order("created_at", { ascending: true }),
    admin
      .from("debts")
      .select("id, amount, note, created_by, created_at, debtors(name)")
      .eq("branch_id", branchId)
      .eq("date", selectedDate)
      .order("created_at", { ascending: true }),
    admin
      .from("debt_payments")
      .select("id, amount, created_by, created_at, debtors(name)")
      .eq("branch_id", branchId)
      .eq("date", selectedDate)
      .order("created_at", { ascending: true }),
    admin
      .from("bank_transfers")
      .select("id, amount, statement, created_by, created_at")
      .eq("branch_id", branchId)
      .eq("date", selectedDate)
      .order("created_at", { ascending: true }),
    admin
      .from("day_closings")
      .select("opening_balance, actual_cash_counted, book_balance, difference, closed_at, locked")
      .eq("branch_id", branchId)
      .eq("date", selectedDate)
      .maybeSingle(),
  ]);

  // معالجة الوارد ودعم الخدمات المخصصة
  const incomes: BranchIncomeRow[] = (incomeRows || []).map((r) => {
    const rawType =
      (r.income_types as unknown as { name?: string } | null)?.name || "وارد";
    let displayType = rawType;
    let isCustom = false;
    let cleanNote = r.note || null;

    if (r.note && r.note.includes("[مخصص:")) {
      const match = r.note.match(/\[مخصص:\s*([^\]]+)\]/);
      if (match && match[1]) {
        displayType = match[1].trim();
        isCustom = true;
        const remainder = r.note.replace(/\[مخصص:\s*[^\]]+\]/, "").trim();
        cleanNote = remainder.replace(/^[-–—:]\s*/, "") || null;
      }
    }

    return {
      id: r.id,
      amount: Number(r.amount || 0),
      profit: Number(r.profit || 0),
      displayType,
      isCustom,
      note: cleanNote,
      employeeName: userMap.get(r.created_by) || "الموظف",
      time: new Date(r.created_at).toLocaleTimeString("ar-SA", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });

  const expenses: BranchExpenseRow[] = (expenseRows || []).map((r) => ({
    id: r.id,
    amount: Number(r.amount || 0),
    recipient_name: r.recipient_name,
    method: r.method as "cash" | "bank",
    note: r.note,
    employeeName: userMap.get(r.created_by) || "الموظف",
    time: new Date(r.created_at).toLocaleTimeString("ar-SA", {
      timeZone: "Asia/Riyadh",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  const debts: BranchDebtRow[] = (debtRows || []).map((r) => ({
    id: r.id,
    amount: Number(r.amount || 0),
    debtor_name:
      (r.debtors as unknown as { name?: string } | null)?.name || "عميل",
    note: r.note,
    employeeName: userMap.get(r.created_by) || "الموظف",
    time: new Date(r.created_at).toLocaleTimeString("ar-SA", {
      timeZone: "Asia/Riyadh",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  const debtPayments: BranchPaymentRow[] = (paymentRows || []).map((r) => ({
    id: r.id,
    amount: Number(r.amount || 0),
    debtor_name:
      (r.debtors as unknown as { name?: string } | null)?.name || "عميل",
    employeeName: userMap.get(r.created_by) || "الموظف",
    time: new Date(r.created_at).toLocaleTimeString("ar-SA", {
      timeZone: "Asia/Riyadh",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  const transfers: BranchTransferRow[] = (transferRows || []).map((r) => ({
    id: r.id,
    amount: Number(r.amount || 0),
    statement: r.statement,
    employeeName: userMap.get(r.created_by) || "الموظف",
    time: new Date(r.created_at).toLocaleTimeString("ar-SA", {
      timeZone: "Asia/Riyadh",
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  const dayClosing: BranchDayClosing = closingRow
    ? {
        opening_balance: Number(closingRow.opening_balance || 0),
        actual_cash_counted:
          closingRow.actual_cash_counted !== null
            ? Number(closingRow.actual_cash_counted)
            : null,
        book_balance: Number(closingRow.book_balance || 0),
        difference:
          closingRow.difference !== null
            ? Number(closingRow.difference)
            : null,
        closed_at: closingRow.closed_at,
        locked: closingRow.locked,
      }
    : null;

  // إجماليات اليوم
  const totalIncome = incomes.reduce((acc, c) => acc + c.amount, 0);
  const totalExpense = expenses.reduce((acc, c) => acc + c.amount, 0);
  const totalPayment = debtPayments.reduce((acc, c) => acc + c.amount, 0);
  const totalDebt = debts.reduce((acc, c) => acc + c.amount, 0);
  const totalTransfer = transfers.reduce((acc, c) => acc + c.amount, 0);
  const netCashInDrawer = totalIncome + totalPayment - totalExpense;

  // 6) جلب بيانات الشهر لملخص نهاية الشهر (Monthly Summary)
  const monthStart = `${selectedMonth}-01`;
  const monthEnd = `${selectedMonth}-31`;

  const [
    { data: mIncomes },
    { data: mExpenses },
    { data: mPayments },
    { data: mDebts },
    { data: mClosings },
  ] = await Promise.all([
    admin
      .from("income_entries")
      .select("date, amount")
      .eq("branch_id", branchId)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    admin
      .from("expenses")
      .select("date, amount")
      .eq("branch_id", branchId)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    admin
      .from("debt_payments")
      .select("date, amount")
      .eq("branch_id", branchId)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    admin
      .from("debts")
      .select("date, amount")
      .eq("branch_id", branchId)
      .gte("date", monthStart)
      .lte("date", monthEnd),
    admin
      .from("day_closings")
      .select("date, locked")
      .eq("branch_id", branchId)
      .gte("date", monthStart)
      .lte("date", monthEnd),
  ]);

  // تجميع الأيام
  const dayDatesSet = new Set<string>();
  (mIncomes || []).forEach((r) => dayDatesSet.add(r.date));
  (mExpenses || []).forEach((r) => dayDatesSet.add(r.date));
  (mPayments || []).forEach((r) => dayDatesSet.add(r.date));
  (mDebts || []).forEach((r) => dayDatesSet.add(r.date));
  (mClosings || []).forEach((r) => dayDatesSet.add(r.date));

  const sortedMonthDates = Array.from(dayDatesSet).sort((a, b) =>
    a.localeCompare(b),
  );

  const closedMap = new Map<string, boolean>(
    (mClosings || []).map((c) => [c.date, c.locked]),
  );

  const monthDays: MonthDaySummary[] = sortedMonthDates.map((d) => {
    const incSum = (mIncomes || [])
      .filter((r) => r.date === d)
      .reduce((a, b) => a + Number(b.amount || 0), 0);
    const expSum = (mExpenses || [])
      .filter((r) => r.date === d)
      .reduce((a, b) => a + Number(b.amount || 0), 0);
    const paySum = (mPayments || [])
      .filter((r) => r.date === d)
      .reduce((a, b) => a + Number(b.amount || 0), 0);
    const debtSum = (mDebts || [])
      .filter((r) => r.date === d)
      .reduce((a, b) => a + Number(b.amount || 0), 0);

    const dObj = new Date(d + "T12:00:00Z");
    const dName = new Intl.DateTimeFormat("ar-SA", {
      weekday: "short",
    }).format(dObj);
    const fDate = new Intl.DateTimeFormat("ar-SA", {
      day: "numeric",
      month: "short",
    }).format(dObj);

    return {
      date: d,
      formattedDate: `${dName} ${fDate}`,
      dayName: dName,
      income: incSum,
      expense: expSum,
      payment: paySum,
      debt: debtSum,
      netCash: incSum + paySum - expSum,
      isClosed: closedMap.get(d) ?? false,
    };
  });

  const monthTotalIncome = monthDays.reduce((a, b) => a + b.income, 0);
  const monthTotalExpense = monthDays.reduce((a, b) => a + b.expense, 0);
  const monthTotalPayment = monthDays.reduce((a, b) => a + b.payment, 0);
  const monthTotalDebt = monthDays.reduce((a, b) => a + b.debt, 0);
  const monthNetCash = monthTotalIncome + monthTotalPayment - monthTotalExpense;

  const themeVars = getThemeVariables(org.primary_color, org.secondary_color);

  return (
    <div
      style={themeVars as React.CSSProperties}
      className="min-h-dvh bg-slate-50/60 pb-16"
    >
      <div className="no-print">
        <AppHeader
          title={org.name}
          subtitle={`سجلات فرع ${currentBranch.name}`}
          roleLabel={ROLE_LABEL[session.profile.role]}
          userName={displayName(session)}
          logoUrl={org.logo_url}
          primaryColor={org.primary_color}
          secondaryColor={org.secondary_color}
        />
      </div>

      <BranchDetailView
        org={org}
        branch={{
          id: currentBranch.id,
          name: currentBranch.name,
          active: currentBranch.active,
        }}
        allBranches={allBranches}
        selectedDate={selectedDate}
        formattedDate={formattedDate}
        todayDateStr={todayDateStr}
        dayClosing={dayClosing}
        incomes={incomes}
        expenses={expenses}
        debts={debts}
        debtPayments={debtPayments}
        transfers={transfers}
        totals={{
          income: totalIncome,
          expense: totalExpense,
          payment: totalPayment,
          debt: totalDebt,
          transfer: totalTransfer,
          netCash: netCashInDrawer,
        }}
        selectedMonth={selectedMonth}
        monthSummary={{
          days: monthDays,
          totalIncome: monthTotalIncome,
          totalExpense: monthTotalExpense,
          totalPayment: monthTotalPayment,
          totalDebt: monthTotalDebt,
          netCash: monthNetCash,
        }}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
