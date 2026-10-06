create table if not exists public.folio_foundry_portfolios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  full_name text not null default '',
  template text not null default 'simple'
    check (template in ('simple', 'modern', 'creative')),
  content jsonb not null default '{}'::jsonb,
  profile_image text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists folio_foundry_portfolios_owner_id_idx
  on public.folio_foundry_portfolios (owner_id);

alter table public.folio_foundry_portfolios enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.folio_foundry_portfolios to anon, authenticated;
grant insert, update, delete on public.folio_foundry_portfolios to authenticated;

create policy "Folio Foundry owners can read their portfolios"
  on public.folio_foundry_portfolios for select to authenticated
  using (auth.uid() = owner_id);

create policy "Folio Foundry public can read published portfolios"
  on public.folio_foundry_portfolios for select to anon, authenticated
  using (is_published = true);

create policy "Folio Foundry owners can create portfolios"
  on public.folio_foundry_portfolios for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "Folio Foundry owners can update their portfolios"
  on public.folio_foundry_portfolios for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Folio Foundry owners can delete their portfolios"
  on public.folio_foundry_portfolios for delete to authenticated
  using (auth.uid() = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('folio-foundry-photos', 'folio-foundry-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Folio Foundry owners can upload their own photo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'folio-foundry-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Folio Foundry owners can update their own photo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'folio-foundry-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'folio-foundry-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Folio Foundry owners can delete their own photo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'folio-foundry-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Folio Foundry public can view portfolio photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'folio-foundry-photos');
