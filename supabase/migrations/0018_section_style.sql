-- A section of the work is usually a style ("Realismo black & grey",
-- "Color", "Fine line"…): it can carry the style it stands for and the piece
-- chosen as its cover in the styles carousel.
alter table public.portfolio_sections add column if not exists style text;
alter table public.portfolio_sections add column if not exists cover_item_id uuid references public.portfolio_items (id) on delete set null;
