// اختبار منطق فحص الملفات
const MAX_LOGO_SIZE_BYTES = 1024 * 1024;

function validateImageBuffer(buffer) {
  if (buffer.length === 0) return { valid: false, error: "الملف المرفوع فارغ." };
  if (buffer.length > MAX_LOGO_SIZE_BYTES) return { valid: false, error: "حجم الشعار يتجاوز الحد الأقصى المسموح (1 ميجابايت)." };

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, mimeType: "image/png", extension: "png" };
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: "image/jpeg", extension: "jpg" };
  }

  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, mimeType: "image/webp", extension: "webp" };
  }

  return { valid: false, error: "نوع الملف غير مدعوم. يُسمح فقط بصور PNG أو JPG أو WebP (SVG ممنوع)." };
}

function isValidHexColor(hex) {
  if (!hex || typeof hex !== "string") return false;
  return /^#[0-9A-Fa-f]{6}$/.test(hex.trim());
}

function getRelativeLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastInfo(hex) {
  if (!isValidHexColor(hex)) return { textColor: "#ffffff", isLowContrast: false };
  const cleanHex = hex.trim().replace("#", "");
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);

  const lum = getRelativeLuminance(r, g, b);
  const contrastWithWhite = (1.0 + 0.05) / (lum + 0.05);
  const contrastWithBlack = (lum + 0.05) / (0.0 + 0.05);
  const textColor = contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#000000";
  const bestContrast = Math.max(contrastWithWhite, contrastWithBlack);
  return { textColor, isLowContrast: bestContrast < 4.5 };
}

console.log("=== بدء اختبارات الأمان للهوية البصرية ===\n");

// 1. اختبار رفض الملفات غير المدعومة و SVG
console.log("1) فحص رفض الملفات غير الصور وملفات SVG:");
const fakeSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const svgResult = validateImageBuffer(fakeSvg);
console.log(" - نتيجة رفع SVG:", svgResult.valid === false ? "✅ رُفض بنجاح" : "❌ خطأ: قُبل!", `(${svgResult.error || ""})`);

const textFile = Buffer.from("هذا ملف نصي عادي وليس صورة");
const textResult = validateImageBuffer(textFile);
console.log(" - نتيجة رفع ملف نصي:", textResult.valid === false ? "✅ رُفض بنجاح" : "❌ خطأ: قُبل!", `(${textResult.error || ""})`);

// 2. اختبار رفض الملفات الأكبر من 1 ميجابايت
console.log("\n2) فحص رفض الملفات الأكبر من 1 ميجابايت:");
const largeBuffer = Buffer.alloc(1024 * 1024 + 100);
largeBuffer[0] = 0x89; largeBuffer[1] = 0x50; largeBuffer[2] = 0x4e; largeBuffer[3] = 0x47; // Fake PNG header
const largeResult = validateImageBuffer(largeBuffer);
console.log(" - نتيجة رفع ملف حجمه 1.001MB:", largeResult.valid === false ? "✅ رُفض بنجاح" : "❌ خطأ: قُبل!", `(${largeResult.error || ""})`);

// 3. اختبار قبول الصور الصالحة
console.log("\n3) فحص قبول صور PNG و JPEG و WebP الصالحة:");
const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
console.log(" - صورة PNG صالحة:", validateImageBuffer(validPng).valid === true ? "✅ قُبلت" : "❌ رُفضت");

const validJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
console.log(" - صورة JPG صالحة:", validateImageBuffer(validJpg).valid === true ? "✅ قُبلت" : "❌ رُفضت");

const validWebp = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20
]);
console.log(" - صورة WebP صالحة:", validateImageBuffer(validWebp).valid === true ? "✅ قُبلت" : "❌ رُفضت");

// 4. اختبار فحص الألوان وصيغة #RRGGBB
console.log("\n4) فحص الألوان وصيغة #RRGGBB:");
const invalidColors = ["red", "rgb(0,0,0)", "#123", "javascript:alert(1)", "#GGG000", "#1234567", ""];
invalidColors.forEach((c) => {
  const ok = isValidHexColor(c);
  console.log(` - اللون غير الصالح "${c}":`, !ok ? "✅ رُفض بنجاح" : "❌ خطأ: قُبل!");
});

const validColors = ["#0f766e", "#1e3a8a", "#047857", "#FFFFFF", "#000000"];
validColors.forEach((c) => {
  const ok = isValidHexColor(c);
  console.log(` - اللون الصالح "${c}":`, ok ? "✅ قُبل بنجاح" : "❌ خطأ: رُفض!");
});

// 5. اختبار حساب التباين والتحذير
console.log("\n5) فحص التباين والتحذير الذاتي:");
const darkContrast = getContrastInfo("#1e3a8a");
console.log(" - اللون الكحلي #1e3a8a: لون النص المختَار =", darkContrast.textColor, "(المتوقع #ffffff)", darkContrast.textColor === "#ffffff" ? "✅" : "❌");

const lightContrast = getContrastInfo("#fef08a"); // أصفر فاتح
console.log(" - اللون الأصفر الفاتح #fef08a: لون النص المختَار =", lightContrast.textColor, "(المتوقع #000000)", lightContrast.textColor === "#000000" ? "✅" : "❌");

const mudContrast = getContrastInfo("#777777"); // رمادي تباينه ضعيف
console.log(" - الرمادي المتوسط #777777: هل ظهر تحذير تباين؟", mudContrast.isLowContrast ? "✅ نعم تم التحذير" : "❌ لم يظهر تحذير");

console.log("\n=== انتهت الفحوصات بنجاح ===");
