-- ============================================================
-- 모리 우동투어 — 0004: 사진 분류(간판/메뉴/우동)
-- photo_urls[i] 의 분류를 photo_kinds[i] 에 병렬 저장. 최대 5장.
-- ============================================================

alter table ratings add column if not exists photo_kinds text[] not null default '{}';
