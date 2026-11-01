-- Keep superadmin recognition tied to the database allowlist, while treating
-- email casing and accidental surrounding spaces consistently.

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists(
    select 1
    from public.app_admins a
    where lower(trim(a.email)) = lower(trim(auth.email()))
  );
$function$;

create or replace function public.is_current_user_superadmin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.is_app_admin();
$function$;

revoke execute on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;
revoke execute on function public.is_current_user_superadmin() from public, anon;
grant execute on function public.is_current_user_superadmin() to authenticated;
