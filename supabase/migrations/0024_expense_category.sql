-- Caja: each expense in a category, so the month reads at a glance (supplies, rent, ads, other).
alter table public.expenses add column if not exists category text not null default 'other';
alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses add constraint expenses_category_check check (category in ('supplies', 'rent', 'ads', 'travel', 'other'));
