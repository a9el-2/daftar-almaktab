import { BrandMark, LogoutIcon } from "@/components/Icons";
import { logoutAction } from "@/lib/actions/logout";
import { getThemeVariables, isValidHexColor } from "@/lib/colors";

type Props = {
  title: string;
  subtitle?: string | null;
  roleLabel: string;
  userName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

export default function AppHeader({
  title,
  subtitle,
  roleLabel,
  userName,
  logoUrl,
  primaryColor,
  secondaryColor,
}: Props) {
  const themeVars = getThemeVariables(primaryColor, secondaryColor);
  const hasCustomColor = isValidHexColor(primaryColor);

  return (
    <header
      style={themeVars as React.CSSProperties}
      className="no-print sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        {logoUrl ? (
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/90 bg-white p-0.5 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={title}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <BrandMark
            className="h-10 w-10 shrink-0 text-teal-600"
            style={{
              color: hasCustomColor ? "var(--brand-primary)" : undefined,
            }}
          />
        )}

        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{title}</p>
          {subtitle ? (
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        <div className="ms-auto flex items-center gap-2">
          <div className="hidden text-left sm:block">
            <p className="text-xs font-semibold text-slate-700">{userName}</p>
            <p
              className="text-[11px] font-semibold text-teal-700"
              style={{
                color: hasCustomColor ? "var(--brand-primary)" : undefined,
              }}
            >
              {roleLabel}
            </p>
          </div>
          <span
            className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 sm:hidden"
            style={{
              backgroundColor: hasCustomColor
                ? `${primaryColor}15`
                : undefined,
              color: hasCustomColor ? "var(--brand-primary)" : undefined,
            }}
          >
            {roleLabel}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <LogoutIcon className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
