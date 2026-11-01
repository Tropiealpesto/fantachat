-- FantaChat - keep closed matchdays visible in statistics
--
-- Closed matchdays must be available in the statistics page, but empty future
-- calendar rows should not flood the selector.

create or replace function public.get_player_stats_matchdays(
  p_league_competition_id uuid
)
returns table(
  matchday_number integer,
  status text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
begin
  select competition_id, season_id, league_id
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id;

  if v_lc.league_id is null or not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  return query
  select md.number, md.status
  from public.matchdays md
  where md.season_id = v_lc.season_id
    and (
      md.status in ('open', 'completed', 'locked')
      or exists (
        select 1
        from public.player_stats ps
        where ps.competition_id = v_lc.competition_id
          and ps.season_id = v_lc.season_id
          and ps.matchday_number = md.number
      )
      or exists (
        select 1
        from public.lineups li
        where li.league_competition_id = p_league_competition_id
          and li.matchday_id = md.id
      )
      or (
        md.status = 'closed'
        and exists (
          select 1
          from public.fixtures f
          where f.competition_id = v_lc.competition_id
            and f.season_id = v_lc.season_id
            and f.matchday_number = md.number
            and f.status in ('live', 'completed')
        )
      )
    )
  order by md.number asc;
end;
$function$;

revoke execute on function public.get_player_stats_matchdays(uuid) from public, anon;
grant execute on function public.get_player_stats_matchdays(uuid) to authenticated;
