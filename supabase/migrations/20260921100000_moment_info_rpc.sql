-- Moment details for the in-moment info overlay (code, host, member display names).
create or replace function get_moment_details(p_moment_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from members
    where moment_id = p_moment_id and user_id = auth.uid()
  ) then
    raise exception 'Not a member of this moment';
  end if;

  select json_build_object(
    'id', m.id,
    'name', m.name,
    'code', m.code,
    'host_id', m.host_id,
    'members', (
      select coalesce(
        json_agg(
          json_build_object(
            'user_id', mem.user_id,
            'email', u.email,
            'display_name', coalesce(
              u.raw_user_meta_data->>'full_name',
              u.raw_user_meta_data->>'name',
              split_part(u.email, '@', 1)
            )
          )
          order by (mem.user_id = m.host_id) desc, u.email
        ),
        '[]'::json
      )
      from members mem
      join auth.users u on u.id = mem.user_id
      where mem.moment_id = p_moment_id
    )
  )
  into result
  from moments m
  where m.id = p_moment_id;

  return result;
end;
$$;

grant execute on function get_moment_details(uuid) to authenticated;
