-- Calendar opt-in alert sources. Existing Akatsuki cron delivers the broadcasts.
-- No user preferences are enabled by this migration.
create schema if not exists calendar_private;
revoke all on schema calendar_private from public, anon, authenticated;
create table public.calendar_alert_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 birthday_enabled boolean not null default false,
 birthday_time time not null default '08:00',
 birthday_days_before integer not null default 0 check (birthday_days_before between 0 and 7),
 rain_enabled boolean not null default false,
 rain_time time not null default '07:00',
 weather_key text not null default 'plan' check (length(weather_key) between 1 and 160),
 rain_mm numeric not null default 2 check (rain_mm between 0.1 and 500),
 timezone text not null default 'Asia/Tokyo' check (timezone = 'Asia/Tokyo')
);
alter table public.calendar_alert_preferences enable row level security;
create policy calendar_alert_preferences_own on public.calendar_alert_preferences for all to authenticated
 using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
revoke all on public.calendar_alert_preferences from public,anon,authenticated;
grant select,insert,update,delete on public.calendar_alert_preferences to authenticated;

create table calendar_private.alert_occurrences (
 user_id uuid not null references auth.users(id) on delete cascade,
 event_key text not null,
 kind text not null,
 source_id uuid,
 source_date date,
 broadcast_id uuid not null unique,
 expires_at timestamptz not null,
 primary key(user_id,event_key)
);
alter table calendar_private.alert_occurrences enable row level security;
revoke all on calendar_private.alert_occurrences from public,anon,authenticated;

-- Invoker, callable only by the scheduler owner. No publicly callable privileged RPC.
create function calendar_private.evaluate_alerts(p_now timestamptz default now())
returns integer language plpgsql security invoker set search_path='' as $$
declare item record; new_id uuid; n integer:=0;
begin
 -- Serialise evaluations, including manual health checks.
 if not pg_try_advisory_xact_lock(719384622) then return 0; end if;
 -- Withdraw pending reminders when disabled, deleted, edited, or out of date.
 update public.akatsuki_broadcasts b set state='cancelled',updated_at=p_now
 from calendar_private.alert_occurrences o
 where b.id=o.broadcast_id and b.state in ('scheduled','paused') and (
  o.expires_at<=p_now or not exists (
   select 1 from public.calendar_alert_preferences p where p.user_id=o.user_id and
    case when o.kind='birthday' then p.birthday_enabled and exists (
     select 1 from public.calendar_app_birthdays d where d.id=o.source_id and d.user_id=o.user_id and d.birth_date=o.source_date
    ) else p.rain_enabled end
  )
 );
 for item in
 with prefs as (
  select p.*, (p_now at time zone p.timezone)::date today from public.calendar_alert_preferences p
 ), bdays as (
  select p.*,d.id birthday_id,d.birth_date,d.person_name,
   make_date(extract(year from p.today+p.birthday_days_before)::int,extract(month from d.birth_date)::int,
    least(extract(day from d.birth_date)::int,
     extract(day from (date_trunc('month',make_date(extract(year from p.today+p.birthday_days_before)::int,extract(month from d.birth_date)::int,1))+interval '1 month - 1 day'))::int)) occurrence
  from prefs p join public.calendar_app_birthdays d on d.user_id=p.user_id where p.birthday_enabled
 ), candidates as (
  select user_id,'birthday' kind,birthday_id source_id,birth_date source_date,
   'birthday:'||birthday_id||':'||occurrence event_key,
   left('🎂 '||person_name|| CASE WHEN birthday_days_before=0 THEN ' — birthday today' ELSE ' — birthday in '||birthday_days_before||' day(s)' END,120) title,
   'Birthday: '||to_char(occurrence,'YYYY-MM-DD')||'. Open Calendar to view or edit.' body,
   (today+birthday_time) at time zone timezone due_at,
   (today+1)::timestamp at time zone timezone expires_at
  from bdays where occurrence=today+birthday_days_before
  union all
  select p.user_id,'rain',null::uuid,null::date,'rain:'||p.today,
   left('🌧️ Rain forecast — '||coalesce(w.payload->>'label','your location'),120),
   'Forecast for '||p.today||': '||(d->>'precip_mm')||' mm. Daily forecast, not a live rain-onset alert. '||coalesce(w.payload->>'attribution',''),
   (p.today+p.rain_time) at time zone p.timezone,
   (p.today+1)::timestamp at time zone p.timezone
  from prefs p join public.akatsuki_cache w on w.user_id=p.user_id and w.source='weather' and w.key=p.weather_key
  cross join lateral jsonb_array_elements(w.payload->'days') d
  where p.rain_enabled and w.fetched_at>p_now-interval '4 hours' and (w.expires_at is null or w.expires_at>p_now)
   and d->>'date'=p.today::text and jsonb_typeof(d->'precip_mm')='number' and (d->>'precip_mm')::numeric>=p.rain_mm
 )
 select * from candidates where due_at<=p_now and due_at>p_now-interval '2 hours'
 loop
  new_id:=null;
  insert into calendar_private.alert_occurrences(user_id,event_key,kind,source_id,source_date,broadcast_id,expires_at)
   values(item.user_id,item.event_key,item.kind,item.source_id,item.source_date,gen_random_uuid(),item.expires_at)
   on conflict do nothing returning broadcast_id into new_id;
  if new_id is not null then
   insert into public.akatsuki_broadcasts(id,user_id,title,body,due_at,created_by,category,timezone)
    values(new_id,item.user_id,item.title,left(item.body,1000),item.due_at,'cal','daily','Asia/Tokyo');
   n:=n+1;
  end if;
 end loop;
 return n;
end $$;
revoke all on function calendar_private.evaluate_alerts(timestamptz) from public,anon,authenticated;
select cron.schedule('calendar-alert-sources','* * * * *','select calendar_private.evaluate_alerts();');
notify pgrst,'reload schema';
