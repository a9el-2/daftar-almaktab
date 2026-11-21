import AppHeader from "@/components/AppHeader";
import { displayName, requireProfile, ROLE_LABEL } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import AdminManagement, { type OfficeItem } from "./AdminManagement";

export const metadata = { title: "لوحة مدير النظام | دفتر الصندوق" };

export default async function AdminPage() {
  const session = await requireProfile(["super_admin"]);
  const admin = createSupabaseAdminClient();

  // جلب قائمة المكاتب مع ملفات المحاسبين
  const { data: orgs } = await admin
    .from("organizations")
    .select(`
      id,
      name,
      slug,
      plan,
      subscription_end,
      logo_url,
      primary_color,
      secondary_color,
      active,
      created_at,
      profiles (
        user_id,
        full_name,
        role,
        active,
        must_change_password
      )
    `)
    .order("created_at", { ascending: false });

  // جلب قائمة الإيميلات من Supabase Auth
  const { data: authData } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const emailMap = new Map<string, string>(
    authData?.users?.map((u) => [u.id, u.email || ""]) ?? [],
  );

  const offices: OfficeItem[] = (orgs || []).map((org) => {
    const rawProfiles = (org.profiles as unknown as Array<{
      user_id: string;
      full_name: string | null;
      role: string;
      active: boolean;
      must_change_password: boolean;
    }>) || [];

    const accountant = rawProfiles.find((p) => p.role === "accountant");

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: (org.plan as "monthly" | "lifetime") || "monthly",
      subscription_end: org.subscription_end,
      logo_url: org.logo_url,
      primary_color: org.primary_color,
      secondary_color: org.secondary_color,
      active: org.active,
      created_at: org.created_at,
      accountant: accountant
        ? {
            user_id: accountant.user_id,
            full_name: accountant.full_name,
            email: emailMap.get(accountant.user_id) || null,
            active: accountant.active,
            must_change_password: accountant.must_change_password,
          }
        : null,
    };
  });

  return (
    <div className="min-h-dvh bg-slate-50">
      <AppHeader
        title="دفتر الصندوق اليومي"
        subtitle="لوحة مدير النظام"
        roleLabel={ROLE_LABEL[session.profile.role]}
        userName={displayName(session)}
      />
      <AdminManagement initialOffices={offices} />
    </div>
  );
}

export const dynamic = "force-dynamic";
