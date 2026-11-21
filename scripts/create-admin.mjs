import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ خطأ: ملف .env.local غير موجود!");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx !== -1) {
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    env[k] = v;
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.includes("PENDING")) {
  console.error("❌ خطأ: مفتاح SUPABASE_SERVICE_ROLE_KEY غير موجود في ملف .env.local");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log("\n==============================================");
  console.log("   أداة إنشاء حساب مدير النظام (Super Admin)");
  console.log("==============================================\n");

  const name = (await ask("1) اسمك (مثال: عبدالله العتيبي): ")).trim() || "مدير النظام";
  const email = (await ask("2) البريد الإلكتروني: ")).trim().toLowerCase();
  const password = (await ask("3) كلمة المرور (8 أحرف على الأقل): ")).trim();

  if (!email || !email.includes("@")) {
    console.error("\n❌ صيغة البريد الإلكتروني غير صحيحة.");
    rl.close();
    return;
  }

  if (password.length < 8) {
    console.error("\n❌ كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
    rl.close();
    return;
  }

  console.log("\n⏳ جارٍ إنشاء الحساب في Supabase...");

  let userId = null;

  // 1) إنشاء المستخدم أو تحديثه في Supabase Auth
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (authErr) {
    const msg = authErr.message.toLowerCase();
    if (msg.includes("already") || authErr.code === "email_exists") {
      console.log("ℹ️ هذا البريد مسجل مسبقاً في Authentication، سنقوم بتحديثه وتعيينه كمدير نظام...");
      const { data: listData } = await admin.auth.admin.listUsers();
      const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email);
      if (!existing) {
        console.error("❌ تعذر العثور على الحساب:", authErr.message);
        rl.close();
        return;
      }
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
    } else {
      console.error("❌ تعذر إنشاء الحساب في Supabase Auth:", authErr.message);
      rl.close();
      return;
    }
  } else {
    userId = created.user.id;
  }

  // 2) إدخال أو تحديث الملف الشخصي كـ super_admin
  console.log("⏳ جارٍ ضبط صلاحية مدير النظام في جدول profiles...");

  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      user_id: userId,
      role: "super_admin",
      full_name: name,
      active: true,
      must_change_password: false,
    },
    { onConflict: "user_id" }
  );

  if (profileErr) {
    console.error("❌ تعذر تسجيل الدور في جدول profiles:", profileErr.message);
    console.error("👉 تأكد من تشغيل ملف supabase/schema.sql أولاً في لوحة Supabase.");
    rl.close();
    return;
  }

  console.log("\n==============================================");
  console.log("✅ تم إنشاء حساب مدير النظام بنجاح!");
  console.log(`   البريد: ${email}`);
  console.log("   الصلاحية: مدير النظام (super_admin)");
  console.log("   الحالة: مفعل (ولا يحتاج لتغيير كلمة السر)");
  console.log("==============================================\n");
  console.log("👉 يمكنك الآن تسجيل الدخول مباشرة في الموقع.\n");

  rl.close();
}

main().catch((err) => {
  console.error("❌ خطأ غير متوقع:", err);
  rl.close();
});
