-- Transactional regression checks. All fixture changes, including broadcasts, roll back.
begin;
do $$
declare u uuid; d uuid:=gen_random_uuid(); b uuid; n int;
begin
 select id into u from auth.users limit 1;
 if u is null then raise exception 'Requires an existing test account'; end if;
 delete from calendar_private.alert_occurrences where user_id=u;
 insert into public.calendar_alert_preferences(user_id,birthday_enabled,birthday_time,rain_enabled)
 values(u,true,'08:00',false) on conflict(user_id) do update set birthday_enabled=true,birthday_time='08:00',birthday_days_before=0,rain_enabled=false;
 insert into public.calendar_app_birthdays(id,user_id,person_name,birth_date) values(d,u,'Alert regression fixture','2000-02-29');
 perform calendar_private.evaluate_alerts('2030-02-28T07:59:00+09:00');
 if exists(select 1 from calendar_private.alert_occurrences where source_id=d) then raise exception 'Early birthday';end if;
 perform calendar_private.evaluate_alerts('2030-02-28T08:00:00+09:00');
 select broadcast_id into b from calendar_private.alert_occurrences where source_id=d;
 if b is null then raise exception 'Missing non-leap birthday';end if;
 perform calendar_private.evaluate_alerts('2030-02-28T08:01:00+09:00');
 if (select count(*) from calendar_private.alert_occurrences where source_id=d)<>1 then raise exception 'Duplicate birthday';end if;
 perform calendar_private.evaluate_alerts('2032-02-28T08:00:00+09:00');
 if (select count(*) from calendar_private.alert_occurrences where source_id=d)<>1 then raise exception 'Early leap birthday';end if;
 perform calendar_private.evaluate_alerts('2032-02-29T08:00:00+09:00');
 if (select count(*) from calendar_private.alert_occurrences where source_id=d)<>2 then raise exception 'Missing leap birthday';end if;
 delete from public.calendar_app_birthdays where id=d;
 perform calendar_private.evaluate_alerts('2032-02-29T08:01:00+09:00');
 if exists(select 1 from public.akatsuki_broadcasts b join calendar_private.alert_occurrences o on b.id=o.broadcast_id where o.source_id=d and b.state='scheduled') then raise exception 'Deleted birthday still pending';end if;
 update public.calendar_alert_preferences set birthday_enabled=false,rain_enabled=true,rain_time='07:00',weather_key='test:calendar-alert',rain_mm=2 where user_id=u;
 insert into public.akatsuki_cache(user_id,source,key,payload,fetched_at,expires_at)
 values(u,'weather','test:calendar-alert','{"label":"Test","days":[{"date":"2033-01-01","precip_mm":3}]}','2033-01-01T06:00:00+09:00','2033-01-01T10:00:00+09:00');
 perform calendar_private.evaluate_alerts('2033-01-01T07:00:00+09:00');
 perform calendar_private.evaluate_alerts('2033-01-01T07:01:00+09:00');
 if (select count(*) from calendar_private.alert_occurrences where user_id=u and event_key='rain:2033-01-01')<>1 then raise exception 'Rain missing/duplicate';end if;
 update public.akatsuki_cache set payload='{"days":[{"date":"2033-01-02","precip_mm":3}]}',expires_at='2033-01-02T10:00:00+09:00' where user_id=u and key='test:calendar-alert';
 perform calendar_private.evaluate_alerts('2033-01-02T07:00:00+09:00');
 if exists(select 1 from calendar_private.alert_occurrences where user_id=u and event_key='rain:2033-01-02') then raise exception 'Stale forecast sent';end if;
 update public.akatsuki_cache set fetched_at='2033-01-02T06:30:00+09:00',payload='{"days":[{"date":"2033-01-02","precip_mm":0.5}]}' where user_id=u and key='test:calendar-alert';
 perform calendar_private.evaluate_alerts('2033-01-02T07:00:00+09:00');
 if exists(select 1 from calendar_private.alert_occurrences where user_id=u and event_key='rain:2033-01-02') then raise exception 'Below threshold sent';end if;
 if has_function_privilege('authenticated','calendar_private.evaluate_alerts(timestamptz)','execute') then raise exception 'Public scheduler';end if;
 if not (select relrowsecurity from pg_class where oid='public.calendar_alert_preferences'::regclass) then raise exception 'RLS missing';end if;
end $$;
rollback;
select 'Birthday timing, leap years, deduplication, deletion, rain threshold, freshness and scheduler privileges passed; fixtures rolled back.' as result;
