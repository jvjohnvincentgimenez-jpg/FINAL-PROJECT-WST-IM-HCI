drop policy if exists "Folio Foundry public can read published portfolios"
  on public.folio_foundry_portfolios;
drop policy if exists "Folio Foundry owners can read their portfolios"
  on public.folio_foundry_portfolios;
drop policy if exists "Folio Foundry owners can create portfolios"
  on public.folio_foundry_portfolios;
drop policy if exists "Folio Foundry owners can update their portfolios"
  on public.folio_foundry_portfolios;
drop policy if exists "Folio Foundry owners can delete their portfolios"
  on public.folio_foundry_portfolios;

create policy "Folio Foundry owners can read their portfolios"
  on public.folio_foundry_portfolios for select to authenticated
  using (
    auth.uid() = owner_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Folio Foundry authenticated users can read published portfolios"
  on public.folio_foundry_portfolios for select to authenticated
  using (
    is_published = true
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Folio Foundry owners can create portfolios"
  on public.folio_foundry_portfolios for insert to authenticated
  with check (
    auth.uid() = owner_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Folio Foundry owners can update their portfolios"
  on public.folio_foundry_portfolios for update to authenticated
  using (
    auth.uid() = owner_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  )
  with check (
    auth.uid() = owner_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "Folio Foundry owners can delete their portfolios"
  on public.folio_foundry_portfolios for delete to authenticated
  using (
    auth.uid() = owner_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

revoke select on public.folio_foundry_portfolios from anon;
