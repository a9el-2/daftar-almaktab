-- ============================================================================
-- إضافة عمود إجبار تغيير كلمة المرور ودالة التحديث
-- شغّل هذا الاستعلام في Supabase Dashboard ← SQL Editor إن كنت قد شغّلت schema.sql مسبقاً
-- ============================================================================

-- 1) إضافة العمود في جدول profiles إن لم يكن موجوداً
alter table public.profiles
  add column if not exists must_change_password boolean not null default true;

-- 2) دالة لتحديث الحالة عند إتمام تغيير كلمة السر من المستخدم الحالي
create or replace function public.complete_password_change()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set must_change_password = false
  where user_id = auth.uid();
end;
$$;

grant execute on function public.complete_password_change() to authenticated;
