-- ============================================================
-- 모리 우동투어 — 0003: 가게 구글맵 링크
-- 호스트가 reveal 시 가게명(필수) + 구글맵 링크(선택)를 함께 저장
-- ============================================================

alter table bowls add column if not exists map_url text;

-- set_shop 시그니처 변경(인자 추가) → 기존 3-인자 오버로드 제거 후 재생성
drop function if exists set_shop(uuid, int, text);

create or replace function set_shop(p_tour uuid, p_n int, p_shop text, p_map text default null)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not is_tour_host(p_tour) then raise exception 'not host'; end if;
  if char_length(coalesce(p_shop,'')) > 30 then raise exception 'shop too long'; end if;
  if char_length(coalesce(p_map,'')) > 500 then raise exception 'map url too long'; end if;
  insert into bowls (tour_id, n, shop_name, map_url)
    values (p_tour, p_n, nullif(p_shop,''), nullif(p_map,''))
  on conflict (tour_id, n) do update
    set shop_name = nullif(excluded.shop_name,''),
        map_url   = nullif(excluded.map_url,'');
end $$;
