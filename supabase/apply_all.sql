-- ============================================================
-- 모리 우동투어 — 초기 스키마 / RLS / RPC
-- ============================================================

-- ---------- Tables ----------

create table if not exists tours (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  team_name text not null,
  participant_count int not null default 3 check (participant_count between 1 and 8),
  current_bowl int not null default 0,
  max_bowl int not null default 0,
  started boolean not null default false,
  finished boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  auth_uid uuid not null,
  name text not null,
  is_host boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tour_id, auth_uid)
);

create table if not exists bowls (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  n int not null,
  menu text,
  shop_name text,
  unique (tour_id, n)
);

create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  bowl_n int not null,
  taste numeric(2,1) not null check (taste between 1 and 5 and (taste*2)=floor(taste*2)),
  noodle numeric(2,1) not null check (noodle between 1 and 5 and (noodle*2)=floor(noodle*2)),
  price numeric(2,1) not null check (price between 1 and 5 and (price*2)=floor(price*2)),
  visual numeric(2,1) not null check (visual between 1 and 5 and (visual*2)=floor(visual*2)),
  condition int check (condition between 1 and 5),
  revisit boolean,
  menu text,
  note text,
  photo_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, bowl_n)
);

create index if not exists ratings_tour_bowl_idx on ratings (tour_id, bowl_n);
create index if not exists participants_tour_idx on participants (tour_id);

-- ---------- Helper (SECURITY DEFINER, avoids RLS recursion) ----------

create or replace function is_tour_member(p_tour uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from participants
    where tour_id = p_tour and auth_uid = auth.uid()
  );
$$;

create or replace function is_tour_host(p_tour uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from participants
    where tour_id = p_tour and auth_uid = auth.uid() and is_host
  );
$$;

-- ---------- RLS ----------

alter table tours        enable row level security;
alter table participants enable row level security;
alter table bowls        enable row level security;
alter table ratings      enable row level security;

-- tours: 멤버만 읽기. 직접 INSERT/UPDATE 금지(모두 RPC 경유).
drop policy if exists "tours_select_member" on tours;
create policy "tours_select_member" on tours
  for select using (is_tour_member(id));

-- participants: 같은 투어 멤버끼리 읽기. 본인 행만 UPDATE(이름 변경).
drop policy if exists "participants_select_member" on participants;
create policy "participants_select_member" on participants
  for select using (is_tour_member(tour_id));

drop policy if exists "participants_update_self" on participants;
create policy "participants_update_self" on participants
  for update using (auth_uid = auth.uid())
  with check (auth_uid = auth.uid());

-- bowls: 같은 투어 멤버 읽기. 쓰기는 RPC(host)만.
drop policy if exists "bowls_select_member" on bowls;
create policy "bowls_select_member" on bowls
  for select using (is_tour_member(tour_id));

-- ratings: 같은 투어 멤버 읽기(상호 집계). 본인 행만 INSERT/UPDATE.
drop policy if exists "ratings_select_member" on ratings;
create policy "ratings_select_member" on ratings
  for select using (is_tour_member(tour_id));

drop policy if exists "ratings_write_self" on ratings;
create policy "ratings_write_self" on ratings
  for all using (
    exists (select 1 from participants p
            where p.id = ratings.participant_id and p.auth_uid = auth.uid())
  ) with check (
    exists (select 1 from participants p
            where p.id = ratings.participant_id and p.auth_uid = auth.uid())
    and tour_id = (select tour_id from participants where id = ratings.participant_id)
  );

-- ---------- RPCs ----------

-- 투어 생성: 투어 + 호스트 participant 원자적 등록, join code 반환
create or replace function create_tour(p_team text, p_count int)
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

  insert into tours (code, team_name, participant_count)
    values (v_code, p_team, p_count)
    returning * into v_tour;

  insert into participants (tour_id, auth_uid, name, is_host)
    values (v_tour.id, auth.uid(), '모리', true);

  return v_tour;
end $$;

-- 입장: code로 투어 찾고 본인 participant upsert(호스트 여부 유지)
create or replace function join_tour(p_code text, p_name text)
returns participants language plpgsql security definer
set search_path = public as $$
declare
  v_tour tours;
  v_part participants;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if char_length(coalesce(p_name,'')) = 0 or char_length(p_name) > 12 then
    raise exception 'invalid name';
  end if;

  select * into v_tour from tours where code = upper(p_code);
  if v_tour.id is null then raise exception 'tour not found'; end if;

  insert into participants (tour_id, auth_uid, name, is_host)
    values (v_tour.id, auth.uid(), p_name, false)
    on conflict (tour_id, auth_uid)
      do update set name = excluded.name
    returning * into v_part;

  return v_part;
end $$;

-- 이름 변경
create or replace function set_name(p_tour uuid, p_name text)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if char_length(coalesce(p_name,'')) = 0 or char_length(p_name) > 12 then
    raise exception 'invalid name';
  end if;
  update participants set name = p_name
   where tour_id = p_tour and auth_uid = auth.uid();
end $$;

-- 인원수 조정(host) — 게이트 기준값. 변경 즉시 realtime 반영.
create or replace function set_count(p_tour uuid, p_count int)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not is_tour_host(p_tour) then raise exception 'not host'; end if;
  if p_count < 1 or p_count > 8 then raise exception 'invalid count'; end if;
  update tours set participant_count = p_count where id = p_tour;
end $$;

-- 그릇 메뉴 announce(host) — 다른 참여자에게 프리필
create or replace function set_menu(p_tour uuid, p_n int, p_menu text)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not is_tour_host(p_tour) then raise exception 'not host'; end if;
  if char_length(coalesce(p_menu,'')) > 24 then raise exception 'menu too long'; end if;
  insert into bowls (tour_id, n, menu) values (p_tour, p_n, p_menu)
    on conflict (tour_id, n) do update set menu = excluded.menu;
end $$;

-- 가게명 매핑 reveal(host)
create or replace function set_shop(p_tour uuid, p_n int, p_shop text)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not is_tour_host(p_tour) then raise exception 'not host'; end if;
  if char_length(coalesce(p_shop,'')) > 30 then raise exception 'shop too long'; end if;
  insert into bowls (tour_id, n, shop_name) values (p_tour, p_n, nullif(p_shop,''))
    on conflict (tour_id, n) do update set shop_name = nullif(excluded.shop_name,'');
end $$;

-- 첫 우동 시작(host)
create or replace function start_tour(p_tour uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not is_tour_host(p_tour) then raise exception 'not host'; end if;
  update tours set started = true, current_bowl = 1, max_bowl = greatest(max_bowl, 1)
   where id = p_tour and started = false;
  insert into bowls (tour_id, n) values (p_tour, 1)
   on conflict (tour_id, n) do nothing;
end $$;

-- 다음 우동(host + 전원 입력 게이트, 원자적)
create or replace function advance_bowl(p_tour uuid)
returns int language plpgsql security definer
set search_path = public as $$
declare v_cur int; v_cnt int; v_need int;
begin
  if not is_tour_host(p_tour) then raise exception 'not host'; end if;
  select current_bowl, participant_count into v_cur, v_need from tours where id = p_tour;
  select count(distinct participant_id) into v_cnt
    from ratings where tour_id = p_tour and bowl_n = v_cur;
  if v_cnt < v_need then
    raise exception 'gate: % of % submitted', v_cnt, v_need;
  end if;
  update tours set current_bowl = v_cur + 1, max_bowl = greatest(max_bowl, v_cur + 1)
   where id = p_tour;
  insert into bowls (tour_id, n) values (p_tour, v_cur + 1)
   on conflict (tour_id, n) do nothing;
  return v_cur + 1;
end $$;

-- 이전 우동(host)
create or replace function prev_bowl(p_tour uuid)
returns int language plpgsql security definer
set search_path = public as $$
declare v_cur int;
begin
  if not is_tour_host(p_tour) then raise exception 'not host'; end if;
  select current_bowl into v_cur from tours where id = p_tour;
  if v_cur <= 1 then return v_cur; end if;
  update tours set current_bowl = v_cur - 1 where id = p_tour;
  return v_cur - 1;
end $$;

-- 결과 발표(host)
create or replace function finish_tour(p_tour uuid, p_finished boolean default true)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not is_tour_host(p_tour) then raise exception 'not host'; end if;
  update tours set finished = p_finished where id = p_tour;
end $$;

-- ---------- Realtime ----------
alter table tours   replica identity full;
alter table bowls   replica identity full;
alter table ratings replica identity full;
alter table participants replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table tours;
alter publication supabase_realtime add table bowls;
alter publication supabase_realtime add table ratings;
alter publication supabase_realtime add table participants;
-- 그릇 사진 버킷 (public read)
insert into storage.buckets (id, name, public)
values ('bowl-photos', 'bowl-photos', true)
on conflict (id) do nothing;

-- 누구나 읽기(public)
drop policy if exists "bowl_photos_public_read" on storage.objects;
create policy "bowl_photos_public_read" on storage.objects
  for select using (bucket_id = 'bowl-photos');

-- 인증된 사용자(익명 포함)는 업로드 가능
drop policy if exists "bowl_photos_auth_insert" on storage.objects;
create policy "bowl_photos_auth_insert" on storage.objects
  for insert with check (bucket_id = 'bowl-photos' and auth.uid() is not null);

drop policy if exists "bowl_photos_auth_update" on storage.objects;
create policy "bowl_photos_auth_update" on storage.objects
  for update using (bucket_id = 'bowl-photos' and auth.uid() is not null);
