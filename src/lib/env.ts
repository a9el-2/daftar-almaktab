/**
 * إعدادات الاتصال بقاعدة البيانات.
 * القيم تُقرأ من ملف .env.local (لا ترفع هذا الملف إلى GitHub).
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** هل تم لصق مفاتيح Supabase في ملف .env.local؟ */
export const isSupabaseConfigured = Boolean(
  supabaseUrl.startsWith("https://") &&
    supabaseAnonKey.length > 20 &&
    !supabaseUrl.includes("YOUR-PROJECT"),
);

/**
 * وضع المعاينة (بيانات تجريبية بدون قاعدة بيانات):
 * - يعمل فقط أثناء التطوير المحلي (npm run dev).
 * - مستحيل تماماً في النسخة المنشورة (NODE_ENV = production حتى لو نقصت المفاتيح).
 * - ويتعطل أيضاً بمجرد ربط قاعدة البيانات.
 */
export const isPreviewEnabled =
  process.env.NODE_ENV !== "production" && !isSupabaseConfigured;

