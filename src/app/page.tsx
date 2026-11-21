import { redirect } from "next/navigation";
import { getSession, homeForRole } from "@/lib/auth";
import { isPreviewEnabled, isSupabaseConfigured } from "@/lib/env";

export default async function RootPage() {
  if (isPreviewEnabled) redirect("/demo");
  if (!isSupabaseConfigured) redirect("/login");

  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.profile || !session.profile.active) redirect("/pending");
  if (session.profile.must_change_password) redirect("/change-password");

  redirect(homeForRole(session.profile.role));
}

export const dynamic = "force-dynamic";
