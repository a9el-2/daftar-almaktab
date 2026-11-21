"use client";

import { useId, useState } from "react";
import { AlertIcon, CheckIcon, ImageIcon, TrashIcon } from "@/components/Icons";
import {
  getContrastInfo,
  isValidHexColor,
  normalizeHexColor,
} from "@/lib/colors";

type Props = {
  initialLogoUrl?: string | null;
  initialPrimaryColor?: string | null;
  initialSecondaryColor?: string | null;
  onLogoFileSelect?: (file: File | null) => void;
  onPrimaryColorChange?: (color: string) => void;
  onSecondaryColorChange?: (color: string | null) => void;
  disabled?: boolean;
};

export default function OfficeBrandingFields({
  initialLogoUrl,
  initialPrimaryColor = "#0f766e",
  initialSecondaryColor,
  onLogoFileSelect,
  onPrimaryColorChange,
  onSecondaryColorChange,
  disabled = false,
}: Props) {
  const fileInputId = useId();
  const primaryId = useId();
  const secondaryId = useId();

  // حالة الشعار
  const [logoPreview, setLogoPreview] = useState<string | null>(
    initialLogoUrl ?? null,
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const [removeExistingLogo, setRemoveExistingLogo] = useState(false);

  // حالة الألوان
  const [primaryColor, setPrimaryColor] = useState<string>(
    normalizeHexColor(initialPrimaryColor, "#0f766e"),
  );
  const [enableSecondary, setEnableSecondary] = useState<boolean>(
    Boolean(initialSecondaryColor && isValidHexColor(initialSecondaryColor)),
  );
  const [secondaryColor, setSecondaryColor] = useState<string>(
    initialSecondaryColor && isValidHexColor(initialSecondaryColor)
      ? initialSecondaryColor
      : "#0284c7",
  );

  const primaryContrast = getContrastInfo(primaryColor);
  const secondaryContrast = enableSecondary
    ? getContrastInfo(secondaryColor)
    : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // فحص الحجم (1 ميجابايت)
    if (file.size > 1024 * 1024) {
      setFileError("حجم الصورة يتجاوز الحد المسموح به (1 ميجابايت).");
      e.target.value = "";
      return;
    }

    // فحص النوع (PNG, JPG, WebP فقط - منع SVG منعاً باتاً)
    const validMimes = ["image/png", "image/jpeg", "image/webp"];
    if (
      !validMimes.includes(file.type.toLowerCase()) ||
      file.name.toLowerCase().endsWith(".svg")
    ) {
      setFileError(
        "نوع الملف غير مدعوم. يُسمح فقط بصور PNG أو JPG أو WebP (SVG ممنوع).",
      );
      e.target.value = "";
      return;
    }

    setRemoveExistingLogo(false);
    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
    if (onLogoFileSelect) onLogoFileSelect(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setFileError(null);
    setRemoveExistingLogo(true);
    if (onLogoFileSelect) onLogoFileSelect(null);
  };

  const handlePrimaryChange = (val: string) => {
    setPrimaryColor(val);
    if (isValidHexColor(val) && onPrimaryColorChange) {
      onPrimaryColorChange(val);
    }
  };

  const handleSecondaryChange = (val: string) => {
    setSecondaryColor(val);
    if (isValidHexColor(val) && onSecondaryColorChange) {
      onSecondaryColorChange(val);
    }
  };

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4">
      {/* حقول مخفية للنماذج التي تعتمد على FormData */}
      <input
        type="hidden"
        name="primaryColor"
        value={isValidHexColor(primaryColor) ? primaryColor : "#0f766e"}
      />
      <input
        type="hidden"
        name="secondaryColor"
        value={
          enableSecondary && isValidHexColor(secondaryColor)
            ? secondaryColor
            : ""
        }
      />
      <input
        type="hidden"
        name="removeLogo"
        value={removeExistingLogo ? "true" : "false"}
      />

      {/* قسم 1: الشعار */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
          شعار المكتب (اختياري)
        </label>
        <p className="mb-2 text-[11px] text-slate-500">
          صورة بصيغة PNG أو JPG أو WebP فقط، بحد أقصى 1 ميجابايت (ملفات SVG غير
          مسموح بها لأسباب أمنية).
        </p>

        {fileError ? (
          <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            <AlertIcon className="h-4 w-4 shrink-0" />
            <span>{fileError}</span>
          </div>
        ) : null}

        <div className="flex items-center gap-4">
          {logoPreview ? (
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoPreview}
                alt="معاينة الشعار"
                className="h-full w-full object-contain"
              />
              <button
                type="button"
                onClick={handleRemoveLogo}
                title="إزالة الشعار"
                disabled={disabled}
                className="absolute -top-1 -start-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700 focus:outline-none"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-slate-400">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}

          <div className="flex-1">
            <input
              id={fileInputId}
              name="logoFile"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              disabled={disabled}
              className="hidden"
            />
            <label
              htmlFor={fileInputId}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ImageIcon className="h-4 w-4 text-slate-400" />
              <span>{logoPreview ? "تغيير الشعار" : "رفع الشعار من جهازك"}</span>
            </label>
            {logoPreview ? (
              <button
                type="button"
                onClick={handleRemoveLogo}
                disabled={disabled}
                className="ms-2 text-xs font-medium text-red-600 hover:underline"
              >
                حذف الشعار
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* قسم 2: اللون الأساسي */}
      <div className="border-t border-slate-200/80 pt-3">
        <label
          htmlFor={primaryId}
          className="mb-1 block text-xs font-semibold text-slate-700"
        >
          اللون الأساسي للمكتب
        </label>
        <p className="mb-2 text-[11px] text-slate-500">
          يُطبّق على الترويسة والأزرار والعناوين وصفحة الدخول الخاصة بالمكتب.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex items-center">
            <input
              type="color"
              value={isValidHexColor(primaryColor) ? primaryColor : "#0f766e"}
              onChange={(e) => handlePrimaryChange(e.target.value)}
              disabled={disabled}
              className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
            />
          </div>

          <div className="relative w-32">
            <input
              id={primaryId}
              type="text"
              dir="ltr"
              maxLength={7}
              placeholder="#0f766e"
              value={primaryColor}
              onChange={(e) => handlePrimaryChange(e.target.value)}
              disabled={disabled}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs uppercase text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {/* معاينة تباين النص مع الخلفية */}
          <div
            className="flex h-10 items-center justify-center rounded-lg px-3 text-xs font-medium shadow-sm transition"
            style={{
              backgroundColor: isValidHexColor(primaryColor)
                ? primaryColor
                : "#0f766e",
              color: primaryContrast.textColor,
            }}
          >
            نص تجريبي
          </div>
        </div>

        {primaryContrast.warning ? (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-5 text-amber-800">
            <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{primaryContrast.warning}</span>
          </div>
        ) : null}
      </div>

      {/* قسم 3: اللون الثانوي (اختياري) */}
      <div className="border-t border-slate-200/80 pt-3">
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={enableSecondary}
              onChange={(e) => {
                setEnableSecondary(e.target.checked);
                if (!e.target.checked && onSecondaryColorChange) {
                  onSecondaryColorChange(null);
                } else if (e.target.checked && onSecondaryColorChange) {
                  onSecondaryColorChange(secondaryColor);
                }
              }}
              disabled={disabled}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>تخصيص لون ثانوي إضافي (اختياري)</span>
          </label>
        </div>

        {enableSecondary ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={
                  isValidHexColor(secondaryColor) ? secondaryColor : "#0284c7"
                }
                onChange={(e) => handleSecondaryChange(e.target.value)}
                disabled={disabled}
                className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
              />

              <div className="relative w-32">
                <input
                  id={secondaryId}
                  type="text"
                  dir="ltr"
                  maxLength={7}
                  placeholder="#0284c7"
                  value={secondaryColor}
                  onChange={(e) => handleSecondaryChange(e.target.value)}
                  disabled={disabled}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs uppercase text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {secondaryContrast ? (
                <div
                  className="flex h-10 items-center justify-center rounded-lg px-3 text-xs font-medium shadow-sm transition"
                  style={{
                    backgroundColor: isValidHexColor(secondaryColor)
                      ? secondaryColor
                      : "#0284c7",
                    color: secondaryContrast.textColor,
                  }}
                >
                  لون ثانوي
                </div>
              ) : null}
            </div>

            {secondaryContrast?.warning ? (
              <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-5 text-amber-800">
                <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{secondaryContrast.warning}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* تنبيه ثبات ألوان الحالة */}
      <div className="flex items-center gap-2 rounded-xl bg-slate-100/80 px-3 py-2 text-[11px] text-slate-500">
        <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
        <span>
          ألوان العمليات المالية (الأخضر للوارد والزيادة، والأحمر للمنصرف والدين)
          ثابتة لحماية وضوح الحسابات.
        </span>
      </div>
    </div>
  );
}
