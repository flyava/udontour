-- ============================================================
-- 모리 우동투어 — 0006: 그릇 스킵(배불러서 패스)
-- 참여자가 특정 그릇을 패스하면 게이트에서 인원으로 인정 → 호스트가 진행 가능
-- ============================================================

create table if not exists skips (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  bowl_n int not null,
  created_at timestamptz not null default now(),
  unique (participant_id, bowl_n)
);
create index if not exists skips_tour_bowl_idx on skips (tour_id, bowl_n);

alter table skips enable row level security;

-- 같은 투어 멤버 읽기
drop policy if exists "skips_select_member" on skips;
create policy "skips_select_member" on skips
  for select using (is_tour_member(tour_id));

-- 본인 스킵만 쓰기/삭제
drop policy if exists "skips_write_self" on skips;
create policy "skips_write_self" on skips
  for all using (
    exists (select 1 from participants p where p.id = skips.participant_id and p.auth_uid = auth.uid())
  ) with check (
    exists (select 1 from participants p where p.id = skips.participant_id and p.auth_uid = auth.uid())
    and tour_id = (select tour_id from participants where id = skips.participant_id)
  );

-- Realtime
do $$ begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'skips'
  ) then
    alter publication supabase_realtime add table skips;
  end if;
end $$;

-- 게이트: 현재 그릇을 평가했거나(rating) 스킵한(skip) 인원이 전원이면 진행
create or replace function advance_bowl(p_tour uuid)
returns int language plpgsql security definer
set search_path = public as $$
declare v_cur int; v_cnt int; v_need int;
begin
  if not is_tour_host(p_tour) then raise exception 'not host'; end if;
  select current_bowl, participant_count into v_cur, v_need from tours where id = p_tour;
  select count(distinct pid) into v_cnt from (
    select participant_id as pid from ratings where tour_id = p_tour and bowl_n = v_cur
    union
    select participant_id as pid from skips   where tour_id = p_tour and bowl_n = v_cur
  ) q;
  if v_cnt < v_need then
    raise exception 'gate: % of % submitted', v_cnt, v_need;
  end if;
  update tours set current_bowl = v_cur + 1, max_bowl = greatest(max_bowl, v_cur + 1)
   where id = p_tour;
  insert into bowls (tour_id, n) values (p_tour, v_cur + 1)
   on conflict (tour_id, n) do nothing;
  return v_cur + 1;
end $$;
