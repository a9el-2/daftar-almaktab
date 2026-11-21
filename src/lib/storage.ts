import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const MAX_LOGO_SIZE_BYTES = 1024 * 1024; // 1MB

export type ImageValidationResult =
  | { valid: true; mimeType: "image/png" | "image/jpeg" | "image/webp"; extension: "png" | "jpg" | "webp" }
  | { valid: false; error: string };

/**
 * فحص نوع الصورة الحقيقي بناءً على التواقيع الرقمية (Magic Bytes) وليس الامتداد فقط
 * ويمنع منعاً باتاً ملفات SVG وأي ملفات تنفيذية أو غير مدعومة
 */
export function validateImageBuffer(buffer: Buffer | Uint8Array): ImageValidationResult {
  if (buffer.length === 0) {
    return { valid: false, error: "الملف المرفوع فارغ." };
  }

  if (buffer.length > MAX_LOGO_SIZE_BYTES) {
    return { valid: false, error: "حجم الشعار يتجاوز الحد الأقصى المسموح (1 ميجابايت)." };
  }

  // 1) فحص PNG: 89 50 4E 47 0D 0A 1A 0A
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

  // 2) فحص JPEG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { valid: true, mimeType: "image/jpeg", extension: "jpg" };
  }

  // 3) فحص WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 && // RIFF
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50 // WEBP
  ) {
    return { valid: true, mimeType: "image/webp", extension: "webp" };
  }

  return {
    valid: false,
    error: "نوع الملف غير مدعوم. يُسمح فقط بصور PNG أو JPG أو WebP (ملفات SVG غير مسموح بها).",
  };
}

/**
 * رفع الشعار إلى Supabase Storage في مجلد خاص برقم المكتب
 */
export async function uploadOfficeLogo(
  orgId: string,
  file: File,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      return { success: false, error: "حجم الشعار يتجاوز الحد الأقصى (1 ميجابايت)." };
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = validateImageBuffer(buffer);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const randomName = crypto.randomUUID();
    const filePath = `${orgId}/${randomName}.${validation.extension}`;

    const admin = createSupabaseAdminClient();
    const { error: uploadError } = await admin.storage
      .from("office-assets")
      .upload(filePath, buffer, {
        contentType: validation.mimeType,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return { success: false, error: "تعذر حفظ الشعار في وحدة التخزين." };
    }

    const { data: publicUrlData } = admin.storage
      .from("office-assets")
      .getPublicUrl(filePath);

    return { success: true, url: publicUrlData.publicUrl };
  } catch (err) {
    console.error("uploadOfficeLogo unexpected error:", err);
    return { success: false, error: "حدث خطأ غير متوقع أثناء معالجة الشعار." };
  }
}
