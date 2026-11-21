import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * عميل Supabase للاستخدام داخل المكوّنات والـ Server Actions.
 * يقرأ الجلسة من الكوكيز حتى يبقى المستخدم مسجلاً للدخول.
 */
export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "إعدادات Supabase غير موجودة. أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في ملف .env.local",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // يتم تجاهل الخطأ عند استدعاء العميل من Server Component للقراءة فقط.
          // تحديث الجلسة يتم في middleware.ts
        }
      },
    },
  });
}
