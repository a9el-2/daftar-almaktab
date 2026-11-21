/**
 * أداة معالجة الألوان والتحقق من التباين وفق معايير إمكانية الوصول (WCAG)
 */

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * التحقق الصارم من أن اللون بصيغة #RRGGBB فقط
 */
export function isValidHexColor(hex: string | null | undefined): boolean {
  if (!hex || typeof hex !== "string") return false;
  return HEX_COLOR_REGEX.test(hex.trim());
}

/**
 * ضبط صيغة اللون إلى حروف صغيرة أو إرجاع اللون الافتراضي
 */
export function normalizeHexColor(
  hex: string | null | undefined,
  fallback = "#0f766e",
): string {
  if (isValidHexColor(hex)) {
    return (hex as string).trim().toLowerCase();
  }
  return fallback;
}

/**
 * تحليل الرمز الست عشري إلى قيم R, G, B
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!isValidHexColor(hex)) return null;
  const cleanHex = hex.trim().replace("#", "");
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return { r, g, b };
}

/**
 * حساب السطوع النسبي (Relative Luminance) لمعيار WCAG 2.1
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * حساب نسبة التباين (Contrast Ratio) بين قيمتي سطوع
 */
export function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastResult = {
  textColor: "#ffffff" | "#000000";
  contrastRatio: number;
  isLowContrast: boolean;
  warning: string | null;
};

/**
 * حساب أفضل لون نص (أبيض أو أسود) والتحذير إن كان التباين منخفضاً
 */
export function getContrastInfo(hex: string | null | undefined): ContrastResult {
  const clean = normalizeHexColor(hex, "#0f766e");
  const rgb = hexToRgb(clean);

  if (!rgb) {
    return {
      textColor: "#ffffff",
      contrastRatio: 21,
      isLowContrast: false,
      warning: null,
    };
  }

  const lum = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
  const contrastWithWhite = getContrastRatio(lum, 1.0); // سطوع الأبيض = 1.0
  const contrastWithBlack = getContrastRatio(lum, 0.0); // سطوع الأسود = 0.0

  const textColor = contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#000000";
  const bestContrast = Math.max(contrastWithWhite, contrastWithBlack);

  // معيار WCAG AA يشترط تباين 4.5:1 على الأقل للنصوص العادية (ونضع 4.8 لضمان القراءة بوضوح)
  const isLowContrast = bestContrast < 4.8;
  const warning = isLowContrast
    ? "تنبيه: درجة تباين هذا اللون منخفضة وقد تصعّب قراءة النصوص عليها. يُفضّل اختيار درجة أغمق أو أفتح."
    : null;

  return {
    textColor,
    contrastRatio: Number(bestContrast.toFixed(2)),
    isLowContrast,
    warning,
  };
}

/**
 * إنتاج متغيرات CSS للثيم بأمان تام بعد التحقق
 */
export function getThemeVariables(
  primaryColor?: string | null,
  secondaryColor?: string | null,
): Record<string, string> {
  const primary = normalizeHexColor(primaryColor, "#0f766e");
  const primaryContrast = getContrastInfo(primary);

  const secondary = isValidHexColor(secondaryColor)
    ? (secondaryColor as string).trim().toLowerCase()
    : null;
  const secondaryContrast = secondary ? getContrastInfo(secondary) : null;

  const vars: Record<string, string> = {
    "--brand-primary": primary,
    "--brand-primary-text": primaryContrast.textColor,
  };

  if (secondary && secondaryContrast) {
    vars["--brand-secondary"] = secondary;
    vars["--brand-secondary-text"] = secondaryContrast.textColor;
  } else {
    vars["--brand-secondary"] = primary;
    vars["--brand-secondary-text"] = primaryContrast.textColor;
  }

  return vars;
}
