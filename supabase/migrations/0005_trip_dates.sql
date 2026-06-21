-- ============================================================
-- 모리 우동투어 — 0005: 여행 기간(호스트가 생성 시 입력)
-- ============================================================

alter table tours add column if not exists trip_start date;
alter table tours add column if not exists trip_end date;

-- create_tour 시그니처 확장(여행 기간 선택) → 기존 2-인자 제거 후 재생성
drop function if exists create_tour(text, int);

create or replace function create_tour(
  p_team text,
  p_count int,
  p_start date default null,
  p_end date default null
)
returns tours language plpgsql security definer
set search_path = public as $$
declare
  v_code text;
  v_tour tours;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if char_length(coalesce(p_team,'')) = 0 or char_length(p_team) > 20 then
    raise exception 'invalid team name';
  end if;
  if p_count < 1 or p_count > 8 then raise exception 'invalid count'; end if;

  loop
    v_code := 'UDON-' || upper(substring(md5(random()::text) from 1 for 4));
    exit when not exists (select 1 from tours where code = v_code);
  end loop;

  insert into tours (code, team_name, participant_count, trip_start, trip_end)
    values (v_code, p_team, p_count, p_start, p_end)
    returning * into v_tour;

  insert into participants (tour_id, auth_uid, name, is_host)
    values (v_tour.id, auth.uid(), '모리', true);

  return v_tour;
end $$;
