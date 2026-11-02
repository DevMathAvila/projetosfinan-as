-- Membros da mesma familia podem ver nome/e-mail uns dos outros (mostra "quem lancou" no extrato).
-- Aditiva: a politica "profiles self read" continua valendo; politicas de SELECT se somam (OR).
drop policy if exists "profiles household read" on public.profiles;
create policy "profiles household read" on public.profiles
  for select using (
    exists (
      select 1 from public.household_members hm
      where hm.user_id = profiles.id
        and public.is_household_member(hm.household_id)
    )
  );
