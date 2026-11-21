-- ============================================================================
-- الهوية البصرية للمكاتب: أعمدة الألوان وتخزين الشعارات وسياسات الأمان
-- ============================================================================

-- 1) إضافة أعمدة الهوية البصرية لجدول organizations
alter table public.organizations
  add column if not exists primary_color text default '#0f766e',
  add column if not exists secondary_color text;

-- قيود فحص صيغة الألوان #RRGGBB
alter table public.organizations
  drop constraint if exists organizations_primary_color_format,
  add constraint organizations_primary_color_format check (primary_color is null or primary_color ~* '^#[0-9a-f]{6}$');

alter table public.organizations
  drop constraint if exists organizations_secondary_color_format,
  add constraint organizations_secondary_color_format check (secondary_color is null or secondary_color ~* '^#[0-9a-f]{6}$');

-- 2) إنشاء Bucket مخصص للشعارات office-assets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'office-assets',
  'office-assets',
  true,
  1048576, -- 1MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- 3) سياسات التخزين Storage RLS Policies
drop policy if exists "office_assets_public_read" on storage.objects;
create policy "office_assets_public_read" on storage.objects
  for select to public
  using (bucket_id = 'office-assets');

drop policy if exists "office_assets_insert" on storage.objects;
create policy "office_assets_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'office-assets'
    and (
      public.is_super_admin()
      or (
        public.is_accountant()
        and (split_part(name, '/', 1)) = (public.my_org_id())::text
      )
    )
  );

drop policy if exists "office_assets_update" on storage.objects;
create policy "office_assets_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'office-assets'
    and (
      public.is_super_admin()
      or (
        public.is_accountant()
        and (split_part(name, '/', 1)) = (public.my_org_id())::text
      )
    )
  );

drop policy if exists "office_assets_delete" on storage.objects;
create policy "office_assets_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'office-assets'
    and (
      public.is_super_admin()
      or (
        public.is_accountant()
        and (split_part(name, '/', 1)) = (public.my_org_id())::text
      )
    )
  );
