-- ============================================================================
-- الخطوة 2: إضافة حقول الخطة والاشتراك والرابط الفريد (slug) لجدول المكاتب
-- ============================================================================

alter table public.organizations
  add column if not exists slug text unique,
  add column if not exists plan text not null default 'monthly' check (plan in ('monthly', 'lifetime')),
  add column if not exists subscription_end date;

alter table public.organizations
  drop constraint if exists organizations_slug_format;

alter table public.organizations
  add constraint organizations_slug_format check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- حماية حقول الخطة والاشتراك من التعديل بواسطة غير مدير النظام
create or replace function public.guard_organization_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    new.id               := old.id;
    new.slug             := old.slug;
    new.plan             := old.plan;
    new.subscription_end := old.subscription_end;
    new.active           := old.active;
    new.show_powered_by  := old.show_powered_by;
    new.created_at       := old.created_at;
  end if;
  return new;
end $$;
