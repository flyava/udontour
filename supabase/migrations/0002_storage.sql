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
