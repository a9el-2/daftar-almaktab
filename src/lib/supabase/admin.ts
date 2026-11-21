import "server-only";

import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

/**
 * عميل بصلاحيات كاملة (service_role) — يُستخدم فقط في السيرفر
 * لإنشاء المستخدمين وإدارة المكاتب. لا يُستورد أبداً في مكوّن يعمل في المتصفح.
 * قراءة المفتاح محصورة في هذا الملف السيرفري فقط لمنع تسريبه.
 */
export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === "PENDING") {
    throw new Error(
      "مفتاح service_role غير صالح أو غير موجود في ملف .env.local (SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

