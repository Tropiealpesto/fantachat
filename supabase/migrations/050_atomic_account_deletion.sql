-- FantaChat - transactional account data cleanup

create or replace function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Accesso negato';
  end if;

  update public.messages
  set user_id = null,
      content = 'Messaggio rimosso',
      meta = null,
      mentions_data = null
  where user_id = p_user_id;

  update public.leagues set created_by = null where created_by = p_user_id;
  update public.nyx_content set created_by = null where created_by = p_user_id;
  delete from public.chat_reports where reporter_id = p_user_id;
  delete from public.chat_user_blocks where blocker_id = p_user_id or blocked_id = p_user_id;
  delete from public.lineup_coaches where user_id = p_user_id;
  delete from public.recovery_snapshots where created_by = p_user_id;
  delete from public.lineup_slots where user_id = p_user_id;
  delete from public.user_context where user_id = p_user_id;
  delete from public.league_competition_members where user_id = p_user_id;
  delete from public.league_members where user_id = p_user_id;
end;
$function$;

revoke execute on function public.prepare_account_deletion(uuid) from public, anon;
grant execute on function public.prepare_account_deletion(uuid) to authenticated;
