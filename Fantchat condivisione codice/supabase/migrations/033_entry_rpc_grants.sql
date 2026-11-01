-- Public launch fix: users must be able to create/select/join leagues after login.

revoke execute on function public.get_my_leagues() from public, anon;
revoke execute on function public.set_active_league(uuid) from public, anon;
revoke execute on function public.create_league_with_default_competition(text, text) from public, anon;
revoke execute on function public.join_league_with_code(text, text) from public, anon;

grant execute on function public.get_my_leagues() to authenticated;
grant execute on function public.set_active_league(uuid) to authenticated;
grant execute on function public.create_league_with_default_competition(text, text) to authenticated;
grant execute on function public.join_league_with_code(text, text) to authenticated;
