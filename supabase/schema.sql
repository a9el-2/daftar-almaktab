-- ============================================================================
--  دفتر الصندوق اليومي — مخطط قاعدة البيانات (Supabase / PostgreSQL)
--  طريقة التشغيل:
--    Supabase Dashboard ← SQL Editor ← New query ← الصق الملف كاملاً ← Run
--  ملاحظة: هذا الملف يُشغَّل مرة واحدة فقط على مشروع فارغ.
-- ============================================================================

begin;

-- ============================================================================
-- 1) الأنواع (Enums)
-- ============================================================================
create type public.user_role as enum ('super_admin', 'accountant', 'employee');
create type public.payment_method as enum ('cash', 'bank');
create type public.profit_timing as enum ('on_create', 'on_payment');

-- تاريخ "اليوم" بتوقيت السعودية (يُستخدم لقفل الأيام وتاريخ الإدخالات الافتراضي)
create or replace function public.today_riyadh()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Riyadh')::date $$;

-- ============================================================================
-- 2) الجداول
-- ============================================================================

-- المكاتب (كل مكتب = مشترك في النظام)
create table public.organizations (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (length(trim(name)) > 0),
  slug               text unique,
  plan               text not null default 'monthly' check (plan in ('monthly', 'lifetime')),
  subscription_end   date,
  logo_url           text,
  primary_color      text default '#0f766e' check (primary_color is null or primary_color ~* '^#[0-9a-f]{6}$'),
  secondary_color    text check (secondary_color is null or secondary_color ~* '^#[0-9a-f]{6}$'),
  active             boolean not null default true,
  show_powered_by    boolean not null default true,
  -- متى يُحتسب ربح الدين؟ عند إنشاء الدين أو عند سداده (الافتراضي: عند السداد)
  debt_profit_timing public.profit_timing not null default 'on_payment',
  created_at         timestamptz not null default now(),
  constraint organizations_slug_format check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- الفروع
create table public.branches (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create index branches_org_idx on public.branches (org_id);

-- المستخدمون: يربط حساب الدخول (auth.users) بدور ومكتب وفرع
create table public.profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  org_id               uuid references public.organizations(id) on delete cascade,
  branch_id            uuid references public.branches(id) on delete restrict,
  role                 public.user_role not null,
  full_name            text,
  active               boolean not null default true,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now(),
  constraint profiles_scope check (
    (role = 'super_admin' and org_id is null and branch_id is null)
    or (role = 'accountant' and org_id is not null and branch_id is null)
    or (role = 'employee' and org_id is not null and branch_id is not null)
  )
);
create index profiles_org_idx on public.profiles (org_id);
create index profiles_branch_idx on public.profiles (branch_id);

-- أنواع الوارد (سداد، شغل، ...)
create table public.income_types (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  -- هل يمكن حفظ الإدخال بدون مبلغ (ربح فقط)؟
  amount_optional boolean not null default false,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (org_id, name)
);

-- الوارد
create table public.income_entries (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  branch_id  uuid not null references public.branches(id) on delete restrict,
  date       date not null default public.today_riyadh(),
  type_id    uuid not null references public.income_types(id) on delete restrict,
  amount     numeric(14, 2) check (amount is null or amount >= 0),
  profit     numeric(14, 2) not null default 0 check (profit >= 0),
  note       text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index income_entries_branch_date_idx on public.income_entries (branch_id, date);
create index income_entries_org_date_idx on public.income_entries (org_id, date);

-- المنصرف
create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  branch_id      uuid not null references public.branches(id) on delete restrict,
  date           date not null default public.today_riyadh(),
  amount         numeric(14, 2) not null check (amount > 0),
  recipient_name text not null check (length(trim(recipient_name)) > 0),
  method         public.payment_method not null default 'cash',
  note           text,
  created_by     uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at     timestamptz not null default now()
);
create index expenses_branch_date_idx on public.expenses (branch_id, date);
create index expenses_org_date_idx on public.expenses (org_id, date);

-- المديونون (الأشخاص)
create table public.debtors (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  phone      text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index debtors_org_name_idx on public.debtors (org_id, name);

-- الديون (كل دين مبلغ على شخص)
create table public.debts (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  debtor_id  uuid not null references public.debtors(id) on delete restrict,
  branch_id  uuid not null references public.branches(id) on delete restrict,
  date       date not null default public.today_riyadh(),
  amount     numeric(14, 2) not null check (amount > 0),
  profit     numeric(14, 2) not null default 0 check (profit >= 0),
  note       text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index debts_debtor_idx on public.debts (debtor_id);
create index debts_branch_date_idx on public.debts (branch_id, date);
create index debts_org_date_idx on public.debts (org_id, date);

-- سداد الديون (قد يكون جزئياً)
create table public.debt_payments (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  debtor_id  uuid not null references public.debtors(id) on delete restrict,
  debt_id    uuid not null references public.debts(id) on delete cascade,
  branch_id  uuid not null references public.branches(id) on delete restrict,
  date       date not null default public.today_riyadh(),
  amount     numeric(14, 2) not null check (amount > 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index debt_payments_debt_idx on public.debt_payments (debt_id);
create index debt_payments_branch_date_idx on public.debt_payments (branch_id, date);

-- الحوالات البنكية
create table public.bank_transfers (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  branch_id  uuid not null references public.branches(id) on delete restrict,
  date       date not null default public.today_riyadh(),
  amount     numeric(14, 2) not null check (amount > 0),
  statement  text not null check (length(trim(statement)) > 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index bank_transfers_branch_date_idx on public.bank_transfers (branch_id, date);

-- إغلاق اليوم
create table public.day_closings (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  branch_id           uuid not null references public.branches(id) on delete restrict,
  date                date not null default public.today_riyadh(),
  opening_balance     numeric(14, 2) not null default 0,
  actual_cash_counted numeric(14, 2),
  book_balance        numeric(14, 2) not null default 0,
  difference          numeric(14, 2),
  closed_by           uuid references auth.users(id) on delete set null,
  closed_at           timestamptz not null default now(),
  locked              boolean not null default true,
  unique (branch_id, date)
);
create index day_closings_org_date_idx on public.day_closings (org_id, date);

-- ============================================================================
-- 3) دوال مساعدة للصلاحيات (تقرأ ملف المستخدم الحالي)
-- ============================================================================

create or replace function public.my_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p from public.profiles p where p.user_id = auth.uid()
$$;

-- دور المستخدم (فقط إذا كان حسابه نشطاً)
create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid() and active
$$;

-- مكتب المستخدم (فقط إذا كان الحساب والمكتب نشطين)
create or replace function public.my_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.org_id
  from public.profiles p
  join public.organizations o on o.id = p.org_id
  where p.user_id = auth.uid() and p.active and o.active
$$;

-- فرع المستخدم
create or replace function public.my_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select branch_id from public.profiles where user_id = auth.uid() and active
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'super_admin' and active
  )
$$;

create or replace function public.is_accountant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'accountant' and active
  )
$$;

-- ============================================================================
-- 4) Triggers للحماية والتحقق
-- ============================================================================

-- 4.1 منع تعديل بيانات يوم مُقفل (يُطبَّق على كل جداول الحركة)
create or replace function public.prevent_locked_day_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch uuid;
  v_date   date;
begin
  if tg_op = 'DELETE' then
    v_branch := old.branch_id;
    v_date   := old.date;
  else
    v_branch := new.branch_id;
    v_date   := new.date;
  end if;

  if v_branch is not null and v_date is not null then
    if exists (
      select 1 from public.day_closings c
      where c.branch_id = v_branch and c.date = v_date and c.locked
    ) then
      raise exception 'اليوم مُقفل ولا يمكن تعديله. اطلب من المحاسب فتح اليوم أولاً.'
        using errcode = 'P0001';
    end if;

    -- عند نقل إدخال من يوم مقفل إلى يوم آخر، نتحقق أيضاً من اليوم القديم
    if tg_op = 'UPDATE' and (old.branch_id is distinct from new.branch_id or old.date is distinct from new.date) then
      if exists (
        select 1 from public.day_closings c
        where c.branch_id = old.branch_id and c.date = old.date and c.locked
      ) then
        raise exception 'لا يمكن نقل إدخال من يوم مُقفل.'
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

-- 4.2 تعبئة created_by تلقائياً
create or replace function public.stamp_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  return new;
end $$;

-- 4.3 التحقق من إدخال الوارد (النوع يتبع نفس المكتب + المبلغ حسب إعداد النوع)
create or replace function public.validate_income_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.income_types;
begin
  if new.org_id is null then new.org_id := public.my_org_id(); end if;
  if new.branch_id is null then new.branch_id := public.my_branch_id(); end if;
  new.created_by := coalesce(auth.uid(), new.created_by);

  select * into v_type
  from public.income_types
  where id = new.type_id and org_id = new.org_id;

  if not found then
    raise exception 'نوع الوارد غير موجود في هذا المكتب.' using errcode = 'P0001';
  end if;

  if new.amount is null and not v_type.amount_optional then
    raise exception 'هذا النوع يتطلب إدخال المبلغ.' using errcode = 'P0001';
  end if;

  return new;
end $$;

-- 4.4 تجهيز سداد الدين (نأخذ المكتب والفرع من الدين نفسه)
create or replace function public.prepare_debt_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt   public.debts;
  v_paid   numeric(14, 2);
begin
  select * into v_debt from public.debts where id = new.debt_id;
  if not found then
    raise exception 'الدين غير موجود.' using errcode = 'P0001';
  end if;

  new.org_id    := v_debt.org_id;
  new.branch_id := v_debt.branch_id;
  new.debtor_id := v_debt.debtor_id;
  new.created_by := coalesce(auth.uid(), new.created_by);

  if tg_op = 'INSERT' then
    select coalesce(sum(amount), 0) into v_paid
    from public.debt_payments where debt_id = new.debt_id;

    if v_paid + new.amount > v_debt.amount then
      raise exception 'المبلغ أكبر من المتبقي على الدين (المتبقي: %).', (v_debt.amount - v_paid)
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

-- 4.5 حماية ملفات المستخدمين من تصعيد الصلاحيات
create or replace function public.guard_profile_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_org uuid;
begin
  -- السماح بإنشاء مدير نظام إن كان المنفذ super_admin، أو إن لم يكن هناك أي مدير نظام مسجل بعد (أول مدير)
  if new.role = 'super_admin' and not public.is_super_admin() then
    if exists (select 1 from public.profiles where role = 'super_admin' and user_id <> new.user_id) then
      raise exception 'غير مسموح بإنشاء حساب مدير نظام.' using errcode = 'P0001';
    end if;
  end if;

  if new.role = 'employee' then
    if new.org_id is null or new.branch_id is null then
      raise exception 'حساب الموظف يجب أن يُربط بفرع.' using errcode = 'P0001';
    end if;
    select org_id into v_branch_org from public.branches where id = new.branch_id;
    if v_branch_org is distinct from new.org_id then
      raise exception 'الفرع لا يتبع نفس المكتب.' using errcode = 'P0001';
    end if;
  elsif new.role = 'accountant' then
    new.branch_id := null;
  elsif new.role = 'super_admin' then
    new.org_id := null;
    new.branch_id := null;
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id then
      raise exception 'غير مسموح بتغيير صاحب الحساب.' using errcode = 'P0001';
    end if;
    if old.user_id = auth.uid()
       and new.role is distinct from old.role
       and not public.is_super_admin() then
      raise exception 'لا يمكنك تغيير دورك بنفسك.' using errcode = 'P0001';
    end if;
    if not public.is_super_admin() and new.org_id is distinct from old.org_id then
      raise exception 'غير مسموح بنقل الحساب إلى مكتب آخر.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

-- 4.6 المحاسب لا يستطيع تفعيل/إيقاف المكتب أو إظهار "مدعوم من"
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

-- 4.7 تجهيز إغلاق اليوم
create or replace function public.prepare_day_closing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.branches where id = new.branch_id;
  if v_org is null then
    raise exception 'الفرع غير موجود.' using errcode = 'P0001';
  end if;

  new.org_id := v_org;
  if new.closed_by is null then new.closed_by := auth.uid(); end if;
  if tg_op = 'INSERT' then new.closed_at := now(); end if;

  return new;
end $$;

-- ربط الـ triggers بالجداول
create trigger a_stamp_created_by before insert on public.expenses
  for each row execute function public.stamp_created_by();
create trigger a_stamp_created_by before insert on public.debts
  for each row execute function public.stamp_created_by();
create trigger a_stamp_created_by before insert on public.debtors
  for each row execute function public.stamp_created_by();
create trigger a_stamp_created_by before insert on public.bank_transfers
  for each row execute function public.stamp_created_by();

create trigger a_validate_income_entry before insert or update on public.income_entries
  for each row execute function public.validate_income_entry();

create trigger a_prepare_debt_payment before insert or update on public.debt_payments
  for each row execute function public.prepare_debt_payment();

create trigger a_guard_profile_write before insert or update on public.profiles
  for each row execute function public.guard_profile_write();

create trigger a_guard_organization_update before update on public.organizations
  for each row execute function public.guard_organization_update();

create trigger a_prepare_day_closing before insert or update on public.day_closings
  for each row execute function public.prepare_day_closing();

-- أقفال الأيام (الأسماء تبدأ بـ z لتعمل بعد تجهيز الصف)
create trigger z_prevent_locked_day_write before insert or update or delete on public.income_entries
  for each row execute function public.prevent_locked_day_write();
create trigger z_prevent_locked_day_write before insert or update or delete on public.expenses
  for each row execute function public.prevent_locked_day_write();
create trigger z_prevent_locked_day_write before insert or update or delete on public.debts
  for each row execute function public.prevent_locked_day_write();
create trigger z_prevent_locked_day_write before insert or update or delete on public.debt_payments
  for each row execute function public.prevent_locked_day_write();
create trigger z_prevent_locked_day_write before insert or update or delete on public.bank_transfers
  for each row execute function public.prevent_locked_day_write();

-- ============================================================================
-- 5) Row Level Security — العزل بين المكاتب والأدوار
-- ============================================================================
alter table public.organizations  enable row level security;
alter table public.branches       enable row level security;
alter table public.profiles       enable row level security;
alter table public.income_types  enable row level security;
alter table public.income_entries enable row level security;
alter table public.expenses       enable row level security;
alter table public.debtors        enable row level security;
alter table public.debts          enable row level security;
alter table public.debt_payments  enable row level security;
alter table public.bank_transfers enable row level security;
alter table public.day_closings   enable row level security;

-- 5.1 المكاتب
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_super_admin() or id = public.my_org_id());

create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (public.is_super_admin());

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_super_admin() or (public.is_accountant() and id = public.my_org_id()))
  with check (public.is_super_admin() or (public.is_accountant() and id = public.my_org_id()));

-- 5.2 الفروع
create policy branches_select on public.branches
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      org_id = public.my_org_id()
      and (public.is_accountant() or id = public.my_branch_id())
    )
  );

create policy branches_write on public.branches
  for all to authenticated
  using (public.is_super_admin() or (public.is_accountant() and org_id = public.my_org_id()))
  with check (public.is_super_admin() or (public.is_accountant() and org_id = public.my_org_id()));

-- 5.3 ملفات المستخدمين
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_super_admin()
    or (public.is_accountant() and org_id = public.my_org_id())
  );

create policy profiles_write on public.profiles
  for all to authenticated
  using (
    public.is_super_admin()
    or (public.is_accountant() and org_id = public.my_org_id() and role <> 'super_admin')
  )
  with check (
    public.is_super_admin()
    or (public.is_accountant() and org_id = public.my_org_id() and role <> 'super_admin')
  );

-- 5.4 أنواع الوارد: الجميع يقرأ، المحاسب فقط يكتب
create policy income_types_select on public.income_types
  for select to authenticated
  using (org_id = public.my_org_id());

create policy income_types_write on public.income_types
  for all to authenticated
  using (public.is_accountant() and org_id = public.my_org_id())
  with check (public.is_accountant() and org_id = public.my_org_id());

-- 5.5 الوارد
create policy income_entries_select on public.income_entries
  for select to authenticated
  using (
    org_id = public.my_org_id()
    and (public.is_accountant() or branch_id = public.my_branch_id())
  );

create policy income_entries_insert on public.income_entries
  for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and (public.is_accountant() or branch_id = public.my_branch_id())
  );

create policy income_entries_update on public.income_entries
  for update to authenticated
  using (public.is_accountant() and org_id = public.my_org_id())
  with check (public.is_accountant() and org_id = public.my_org_id());

create policy income_entries_delete on public.income_entries
  for delete to authenticated
  using (public.is_accountant() and org_id = public.my_org_id());

-- 5.6 المنصرف
create policy expenses_select on public.expenses
  for select to authenticated
  using (
    org_id = public.my_org_id()
    and (public.is_accountant() or branch_id = public.my_branch_id())
  );

create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and (public.is_accountant() or branch_id = public.my_branch_id())
  );

create policy expenses_update on public.expenses
  for update to authenticated
  using (public.is_accountant() and org_id = public.my_org_id())
  with check (public.is_accountant() and org_id = public.my_org_id());

create policy expenses_delete on public.expenses
  for delete to authenticated
  using (public.is_accountant() and org_id = public.my_org_id());

-- 5.7 المديونون: المحاسب يرى الجميع، الموظف يرى مديوني مكتبه
create policy debtors_select on public.debtors
  for select to authenticated
  using (org_id = public.my_org_id());

create policy debtors_insert on public.debtors
  for insert to authenticated
  with check (org_id = public.my_org_id());

create policy debtors_update on public.debtors
  for update to authenticated
  using (public.is_accountant() and org_id = public.my_org_id())
  with check (public.is_accountant() and org_id = public.my_org_id());

create policy debtors_delete on public.debtors
  for delete to authenticated
  using (public.is_accountant() and org_id = public.my_org_id());

-- 5.8 الديون
create policy debts_select on public.debts
  for select to authenticated
  using (
    org_id = public.my_org_id()
    and (public.is_accountant() or branch_id = public.my_branch_id())
  );

create policy debts_insert on public.debts
  for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and (public.is_accountant() or branch_id = public.my_branch_id())
  );

create policy debts_update on public.debts
  for update to authenticated
  using (public.is_accountant() and org_id = public.my_org_id())
  with check (public.is_accountant() and org_id = public.my_org_id());

create policy debts_delete on public.debts
  for delete to authenticated
  using (public.is_accountant() and org_id = public.my_org_id());

-- 5.9 سداد الديون
create policy debt_payments_select on public.debt_payments
  for select to authenticated
  using (
    org_id = public.my_org_id()
    and (public.is_accountant() or branch_id = public.my_branch_id())
  );

create policy debt_payments_insert on public.debt_payments
  for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and (public.is_accountant() or branch_id = public.my_branch_id())
  );

create policy debt_payments_update on public.debt_payments
  for update to authenticated
  using (public.is_accountant() and org_id = public.my_org_id())
  with check (public.is_accountant() and org_id = public.my_org_id());

create policy debt_payments_delete on public.debt_payments
  for delete to authenticated
  using (public.is_accountant() and org_id = public.my_org_id());

-- 5.10 الحوالات البنكية
create policy bank_transfers_select on public.bank_transfers
  for select to authenticated
  using (
    org_id = public.my_org_id()
    and (public.is_accountant() or branch_id = public.my_branch_id())
  );

create policy bank_transfers_insert on public.bank_transfers
  for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and (public.is_accountant() or branch_id = public.my_branch_id())
  );

create policy bank_transfers_update on public.bank_transfers
  for update to authenticated
  using (public.is_accountant() and org_id = public.my_org_id())
  with check (public.is_accountant() and org_id = public.my_org_id());

create policy bank_transfers_delete on public.bank_transfers
  for delete to authenticated
  using (public.is_accountant() and org_id = public.my_org_id());

-- 5.11 إغلاق اليوم
create policy day_closings_select on public.day_closings
  for select to authenticated
  using (
    org_id = public.my_org_id()
    and (public.is_accountant() or branch_id = public.my_branch_id())
  );

create policy day_closings_insert on public.day_closings
  for insert to authenticated
  with check (
    org_id = public.my_org_id()
    and (
      public.is_accountant()
      or (branch_id = public.my_branch_id() and date = public.today_riyadh())
    )
  );

-- فتح اليوم أو تعديله: المحاسب فقط
create policy day_closings_update on public.day_closings
  for update to authenticated
  using (public.is_accountant() and org_id = public.my_org_id())
  with check (public.is_accountant() and org_id = public.my_org_id());

create policy day_closings_delete on public.day_closings
  for delete to authenticated
  using (public.is_accountant() and org_id = public.my_org_id());

-- ============================================================================
-- 6) الصلاحيات على مستوى الجداول (RLS يبقى الفيصل)
-- ============================================================================
-- دالة استكمال تغيير كلمة السر للمستخدم الحالي (تُستدعى بعد تغيير كلمة السر بنجاح)
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

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- ملاحظة مهمة:
-- super_admin لا يملك أي سياسة قراءة على جداول الحركة (وارد، منصرف، ديون...)
-- لذلك لا يستطيع الاطلاع على بيانات المكاتب من التطبيق، كما هو مطلوب.
-- عند الحاجة للدعم الفني يمكن استخدام SQL Editor في Supabase (صلاحيات كاملة).

commit;

-- ============================================================================
-- 7) بعد تشغيل هذا الملف:
--    أنشئ أول مستخدم (مدير النظام) من Supabase Dashboard:
--    Authentication ← Users ← Add user ← Create user
--    ثم شغّل استعلام ربط الملف الشخصي لجعله super_admin (مع must_change_password = false).
-- ============================================================================
