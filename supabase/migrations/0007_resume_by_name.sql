-- ============================================================
-- 모리 우동투어 — 0007: 닉네임으로 이어하기(세션 끊김 복구)
-- 세션(auth_uid)이 끊겨도 같은 닉네임으로 들어오면 기존 참여자를
-- 현재 기기로 재연결 → 평가/호스트 권한/게이트 인원 그대로 유지
-- ============================================================

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

  -- 1) 이미 이 기기로 참여 중 → 이름만 갱신해서 반환
  select * into v_part from participants
   where tour_id = v_tour.id and auth_uid = auth.uid();
  if found then
    update participants set name = p_name where id = v_part.id returning * into v_part;
    return v_part;
  end if;

  -- 2) 같은 닉네임이 있으면 이 기기로 재연결(이어하기)
  --    세션이 끊겼다가 같은 이름으로 다시 들어온 경우 복구.
  select * into v_part from participants
   where tour_id = v_tour.id and lower(name) = lower(p_name)
   order by created_at
   limit 1;
  if found then
    update participants set auth_uid = auth.uid() where id = v_part.id returning * into v_part;
    return v_part;
  end if;

  -- 3) 신규 참여
  insert into participants (tour_id, auth_uid, name, is_host)
    values (v_tour.id, auth.uid(), p_name, false)
    returning * into v_part;
  return v_part;
end $$;
