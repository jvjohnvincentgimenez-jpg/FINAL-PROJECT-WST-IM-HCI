grant select on public.folio_foundry_portfolios to anon;

drop policy if exists "Folio Foundry public can view published portfolios"
  on public.folio_foundry_portfolios;

create policy "Folio Foundry public can view published portfolios"
  on public.folio_foundry_portfolios for select to anon
  using (is_published = true);
