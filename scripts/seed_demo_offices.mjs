import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import zlib from "zlib";
import { createClient } from "@supabase/supabase-js";

// قراءة الإعدادات من .env.local في حال توفره
const env = {};
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
}

const connectionString =
  process.env.DATABASE_URL || env.DATABASE_URL || "";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// مولد صور PNG نقية بدقة 120x120 بدون أي مكتبات خارجية
function generateLogoPng(r, g, b, borderR, borderG, borderB) {
  const width = 120;
  const height = 120;
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(2, 9);
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  const ihdr = makeChunk("IHDR", ihdrData);

  const rowSize = 1 + width * 3;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const offset = y * rowSize;
    rawData[offset] = 0;
    for (let x = 0; x < width; x++) {
      const pxOffset = offset + 1 + x * 3;
      const isBorder =
        x < 8 || x >= width - 8 || y < 8 || y >= height - 8;
      const isCenterBox =
        x >= 40 && x <= 80 && y >= 40 && y <= 80;

      if (isBorder || isCenterBox) {
        rawData[pxOffset] = borderR;
        rawData[pxOffset + 1] = borderG;
        rawData[pxOffset + 2] = borderB;
      } else {
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idat = makeChunk("IDAT", compressedData);
  const iend = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, body, crcBuf]);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

async function main() {
  const pgClient = new Client({ connectionString });
  await pgClient.connect();
  console.log("Connected to PostgreSQL");

  const demoOffices = [
    {
      name: "مكتب الصفوة المالي",
      slug: "safwa",
      plan: "lifetime",
      subscription_end: null,
      primary_color: "#1e3a8a", // أزرق كحلي فخم
      secondary_color: "#f59e0b", // ذهبي كهرماني
      accountantEmail: "safwa@office.local",
      accountantName: "محاسب الصفوة",
      password: "Password123!",
      logoPng: generateLogoPng(30, 58, 138, 245, 158, 11), // Navy + Gold
    },
    {
      name: "مكتب الرواد للاستشارات",
      slug: "rowad",
      plan: "monthly",
      subscription_end: "2027-12-31",
      primary_color: "#047857", // أخضر زمردي راقٍ
      secondary_color: "#0284c7", // سماوي مشرق
      accountantEmail: "rowad@office.local",
      accountantName: "محاسب الرواد",
      password: "Password123!",
      logoPng: generateLogoPng(4, 120, 87, 2, 132, 199), // Emerald + Sky
    },
  ];

  for (const item of demoOffices) {
    console.log(`\n--- معالجة ${item.name} (${item.slug}) ---`);

    // 1) فحص أو إنشاء المكتب
    const { rows: existingRows } = await pgClient.query(
      `SELECT id FROM public.organizations WHERE slug = $1`,
      [item.slug],
    );

    let orgId;
    if (existingRows.length > 0) {
      orgId = existingRows[0].id;
      console.log(`المكتب موجود مسبقاً برقم: ${orgId}`);
      await pgClient.query(
        `UPDATE public.organizations
         SET name = $1, plan = $2, subscription_end = $3, primary_color = $4, secondary_color = $5, active = true
         WHERE id = $6`,
        [
          item.name,
          item.plan,
          item.subscription_end,
          item.primary_color,
          item.secondary_color,
          orgId,
        ],
      );
    } else {
      const { rows: newOrgRows } = await pgClient.query(
        `INSERT INTO public.organizations (name, slug, plan, subscription_end, primary_color, secondary_color, active)
         VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
        [
          item.name,
          item.slug,
          item.plan,
          item.subscription_end,
          item.primary_color,
          item.secondary_color,
        ],
      );
      orgId = newOrgRows[0].id;
      console.log(`تم إنشاء المكتب برقم: ${orgId}`);

      // إنشاء الفرع الرئيسي
      await pgClient.query(
        `INSERT INTO public.branches (org_id, name, active) VALUES ($1, 'الفرع الرئيسي', true) ON CONFLICT DO NOTHING`,
        [orgId],
      );

      // إنشاء أنواع الوارد الافتراضية
      await pgClient.query(
        `INSERT INTO public.income_types (org_id, name, amount_optional, active)
         VALUES ($1, 'سداد', false, true), ($1, 'شغل', false, true)
         ON CONFLICT DO NOTHING`,
        [orgId],
      );
    }

    // 2) رفع الشعار إلى Supabase Storage
    const logoFilePath = `${orgId}/logo.png`;
    const { error: uploadError } = await supabase.storage
      .from("office-assets")
      .upload(logoFilePath, item.logoPng, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      console.error(`خطأ أثناء رفع الشعار لمكتب ${item.name}:`, uploadError);
    } else {
      const { data: pubData } = supabase.storage
        .from("office-assets")
        .getPublicUrl(logoFilePath);
      console.log(`رابط الشعار: ${pubData.publicUrl}`);

      await pgClient.query(
        `UPDATE public.organizations SET logo_url = $1 WHERE id = $2`,
        [pubData.publicUrl, orgId],
      );
    }

    // 3) فحص أو إنشاء حساب المحاسب
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const existingUser = usersData.users.find(
      (u) => u.email === item.accountantEmail,
    );

    let userId;
    if (existingUser) {
      userId = existingUser.id;
      console.log(`مستخدم المحاسب موجود مسبقاً: ${userId}`);
      await supabase.auth.admin.updateUserById(userId, {
        password: item.password,
        email_confirm: true,
      });
    } else {
      const { data: newAuth, error: authErr } =
        await supabase.auth.admin.createUser({
          email: item.accountantEmail,
          password: item.password,
          email_confirm: true,
          user_metadata: { full_name: item.accountantName },
        });

      if (authErr) {
        console.error(`خطأ إنشاء المحاسب ${item.accountantEmail}:`, authErr);
        continue;
      }
      userId = newAuth.user.id;
      console.log(`تم إنشاء حساب المحاسب بنجاح: ${userId}`);
    }

    // ربط الحساب بجدول profiles
    await pgClient.query(
      `INSERT INTO public.profiles (user_id, org_id, role, full_name, active, must_change_password)
       VALUES ($1, $2, 'accountant', $3, true, false)
       ON CONFLICT (user_id) DO UPDATE SET
         org_id = $2, role = 'accountant', full_name = $3, active = true, must_change_password = false`,
      [userId, orgId, item.accountantName],
    );

    console.log(`تم ربط المحاسب ${item.accountantEmail} بالمكتب بنجاح.`);
  }

  await pgClient.end();
  console.log("\nاكتمل إنشاء المكاتب التجريبية بنجاح تام!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
