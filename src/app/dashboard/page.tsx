import AppHeader from "@/components/AppHeader";
import { displayName, requireProfile, ROLE_LABEL } from "@/lib/auth";
import { getThemeVariables } from "@/lib/colors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import AccountantDashboard, {
  type DashboardBranch,
  type DashboardEmployee,
  type DashboardOrg,
  type DashboardTransaction,
} from "./AccountantDashboard";

export const metadata = { title: "لوحة المحاسب | دفتر الصندوق" };

export default async function DashboardPage() {
  const session = await requireProfile(["accountant", "super_admin"]);
  const orgId = session.profile.org_id;

  if (!orgId) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <p className="font-bold text-slate-800">الحساب غير مرتبط بمكتب</p>
          <p className="mt-1 text-xs text-slate-500">
            يرجى مراجعة مدير النظام لربط حسابك بالمكتب الصحيح.
          </p>
        </div>
      </div>
    );
  }

  const admin = createSupabaseAdminClient();

  // 1) جلب بيانات المكتب الحالية
  const { data: orgData } = await admin
    .from("organizations")
    .select("id, name, slug, logo_url, primary_color, secondary_color")
    .eq("id", orgId)
    .single();

  const org: DashboardOrg = {
    id: orgData?.id || orgId,
    name: orgData?.name || "المكتب",
    slug: orgData?.slug || null,
    logo_url: orgData?.logo_url || null,
    primary_color: orgData?.primary_color || "#0f766e",
    secondary_color: orgData?.secondary_color || null,
  };

  // 2) تاريخ اليوم بتوقيت الرياض
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

  // 3) جلب الفروع والموظفين
  const { data: branchesData } = await admin
    .from("branches")
    .select("id, name, active, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  const { data: profilesData } = await admin
    .from("profiles")
    .select(
      "user_id, full_name, role, branch_id, active, must_change_password, created_at, branches(name)",
    )
    .eq("org_id", orgId)
    .eq("role", "employee")
    .order("created_at", { ascending: false });

  // جلب إيميلات الموظفين من Supabase Auth
  const { data: authData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const emailMap = new Map<string, string>(
    authData?.users?.map((u) => [u.id, u.email || ""]) ?? [],
  );

  const branchMap = new Map<string, string>(
    (branchesData || []).map((b) => [b.id, b.name]),
  );

  const employees: DashboardEmployee[] = (profilesData || []).map((p) => {
    const branchName =
      (p.branches as unknown as { name?: string } | null)?.name ||
      (p.branch_id ? branchMap.get(p.branch_id) : "") ||
      "غير محدد";

    return {
      user_id: p.user_id,
      full_name: p.full_name,
      email: emailMap.get(p.user_id) || "—",
      branch_id: p.branch_id,
      branch_name: branchName,
      active: p.active,
      must_change_password: p.must_change_password,
      created_at: p.created_at,
    };
  });

  // 4) جلب حركات اليوم لكل الفروع وأنواع الخدمات
  const [
    { data: incomeRows },
    { data: expenseRows },
    { data: paymentRows },
    { data: debtRows },
    { data: transferRows },
    { data: closingRows },
    { data: incomeTypesData },
  ] = await Promise.all([
    admin
      .from("income_entries")
      .select("id, branch_id, amount, profit, note, created_at, income_types(name)")
      .eq("org_id", orgId)
      .eq("date", todayStr)
      .order("created_at", { ascending: false }),
    admin
      .from("expenses")
      .select("id, branch_id, amount, recipient_name, method, note, created_at")
      .eq("org_id", orgId)
      .eq("date", todayStr)
      .order("created_at", { ascending: false }),
    admin
      .from("debt_payments")
      .select("id, branch_id, amount, created_at, debtors(name)")
      .eq("org_id", orgId)
      .eq("date", todayStr)
      .order("created_at", { ascending: false }),
    admin
      .from("debts")
      .select("id, branch_id, amount, note, created_at, debtors(name)")
      .eq("org_id", orgId)
      .eq("date", todayStr)
      .order("created_at", { ascending: false }),
    admin
      .from("bank_transfers")
      .select("id, branch_id, amount, statement, created_at")
      .eq("org_id", orgId)
      .eq("date", todayStr)
      .order("created_at", { ascending: false }),
    admin
      .from("day_closings")
      .select(
        "id, branch_id, date, opening_balance, actual_cash_counted, book_balance, difference, closed_at, locked",
      )
      .eq("org_id", orgId)
      .eq("date", todayStr),
    admin
      .from("income_types")
      .select("id, name, amount_optional, active, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true }),
  ]);

  // تجهيز إحصائيات كل فرع
  const branchEmployeeCount = new Map<string, number>();
  for (const emp of employees) {
    if (emp.branch_id) {
      branchEmployeeCount.set(
        emp.branch_id,
        (branchEmployeeCount.get(emp.branch_id) || 0) + 1,
      );
    }
  }

  type ClosingRow = {
    id: string;
    branch_id: string;
    date: string;
    opening_balance: number | string;
    actual_cash_counted: number | string | null;
    book_balance: number | string;
    difference: number | string | null;
    closed_at: string;
    locked: boolean;
  };

  const closingMap = new Map<string, ClosingRow>();
  for (const c of (closingRows || []) as ClosingRow[]) {
    closingMap.set(c.branch_id, c);
  }

  const branches: DashboardBranch[] = (branchesData || []).map((b) => {
    const branchIncomes = (incomeRows || []).filter((r) => r.branch_id === b.id);
    const branchExpenses = (expenseRows || []).filter((r) => r.branch_id === b.id);
    const branchPayments = (paymentRows || []).filter((r) => r.branch_id === b.id);

    const incTotal = branchIncomes.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const expTotal = branchExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const payTotal = branchPayments.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    const netCash = incTotal + payTotal - expTotal;

    const closing = closingMap.get(b.id);
    const isClosed = closing ? closing.locked : false;

    return {
      id: b.id,
      name: b.name,
      active: b.active,
      created_at: b.created_at,
      employeeCount: branchEmployeeCount.get(b.id) || 0,
      todayIncome: incTotal,
      todayExpenses: expTotal,
      todayNetCash: netCash,
      todayTransactionCount:
        branchIncomes.length + branchExpenses.length + branchPayments.length,
      isClosed,
      dayClosing: closing
        ? {
            opening_balance: Number(closing.opening_balance),
            actual_cash_counted:
              closing.actual_cash_counted !== null
                ? Number(closing.actual_cash_counted)
                : null,
            book_balance: Number(closing.book_balance),
            difference:
              closing.difference !== null ? Number(closing.difference) : null,
            closed_at: closing.closed_at,
            locked: closing.locked,
          }
        : null,
    };
  });

  // الإجماليات العامة للمكتب ككل اليوم
  const totalIncome = (incomeRows || []).reduce(
    (acc, curr) => acc + Number(curr.amount || 0),
    0,
  );
  const totalExpenses = (expenseRows || []).reduce(
    (acc, curr) => acc + Number(curr.amount || 0),
    0,
  );
  const totalDebtPayments = (paymentRows || []).reduce(
    (acc, curr) => acc + Number(curr.amount || 0),
    0,
  );
  const netCashInDrawer = totalIncome + totalDebtPayments - totalExpenses;

  // تجهيز شريط الحركات المباشرة (Feed) مجمعة ومرتبة تنازلياً حسب الوقت
  const feed: DashboardTransaction[] = [];

  for (const inc of incomeRows || []) {
    let typeName =
      (inc.income_types as unknown as { name?: string } | null)?.name ||
      "وارد";
    let desc = inc.note || "";
    if (inc.note && inc.note.includes("[مخصص:")) {
      const match = inc.note.match(/\[مخصص:\s*([^\]]+)\]/);
      if (match && match[1]) {
        typeName = match[1].trim();
        desc = inc.note.replace(/\[مخصص:\s*[^\]]+\]/, "").trim();
      }
    }
    feed.push({
      id: inc.id,
      kind: "income",
      branchName: branchMap.get(inc.branch_id) || "فرع",
      amount: Number(inc.amount || 0),
      description: desc ? `${typeName}: ${desc}` : typeName,
      time: new Date(inc.created_at).toLocaleTimeString("ar-SA", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  for (const exp of expenseRows || []) {
    feed.push({
      id: exp.id,
      kind: "expense",
      branchName: branchMap.get(exp.branch_id) || "فرع",
      amount: Number(exp.amount || 0),
      description: exp.note
        ? `${exp.recipient_name} - ${exp.note}`
        : exp.recipient_name,
      time: new Date(exp.created_at).toLocaleTimeString("ar-SA", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  for (const pay of paymentRows || []) {
    const debtorName =
      (pay.debtors as unknown as { name?: string } | null)?.name || "عميل";
    feed.push({
      id: pay.id,
      kind: "debt_payment",
      branchName: branchMap.get(pay.branch_id) || "فرع",
      amount: Number(pay.amount || 0),
      description: `سداد دين من: ${debtorName}`,
      time: new Date(pay.created_at).toLocaleTimeString("ar-SA", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  for (const d of debtRows || []) {
    const debtorName =
      (d.debtors as unknown as { name?: string } | null)?.name || "عميل";
    feed.push({
      id: d.id,
      kind: "debt",
      branchName: branchMap.get(d.branch_id) || "فرع",
      amount: Number(d.amount || 0),
      description: `دين جديد على: ${debtorName} ${d.note ? `(${d.note})` : ""}`,
      time: new Date(d.created_at).toLocaleTimeString("ar-SA", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  for (const tr of transferRows || []) {
    feed.push({
      id: tr.id,
      kind: "bank_transfer",
      branchName: branchMap.get(tr.branch_id) || "فرع",
      amount: Number(tr.amount || 0),
      description: `حوالة بنكية: ${tr.statement}`,
      time: new Date(tr.created_at).toLocaleTimeString("ar-SA", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  }

  // ترتيب الحركات تنازلياً
  feed.sort((a, b) => b.time.localeCompare(a.time));

  const themeVars = getThemeVariables(org.primary_color, org.secondary_color);

  return (
    <div
      style={themeVars as React.CSSProperties}
      className="min-h-dvh bg-slate-50/60 pb-12"
    >
      <AppHeader
        title={org.name}
        subtitle="لوحة المحاسب"
        roleLabel={ROLE_LABEL[session.profile.role]}
        userName={displayName(session)}
        logoUrl={org.logo_url}
        primaryColor={org.primary_color}
        secondaryColor={org.secondary_color}
      />

      <AccountantDashboard
        org={org}
        todayDateStr={todayStr}
        todayFormatted={todayFormatted}
        branches={branches}
        employees={employees}
        transactions={feed}
        totalIncome={totalIncome}
        totalExpenses={totalExpenses}
        netCashInDrawer={netCashInDrawer}
        totalDebtPayments={totalDebtPayments}
        incomeTypes={incomeTypesData || []}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";
