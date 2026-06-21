# 모리 우동투어 🍜

블라인드 그룹 우동투어 평가 앱. 호스트가 팀·인원수를 세팅하고, 매 그릇마다 전원이 입력해야 다음 우동이 열린다(게이트). 0.5 단위 평가, 가게명 블라인드, 종료 후 우승 우동 발표.

스택: Next.js (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + Anonymous Auth + Realtime + Storage).

## 셋업

### 1. Supabase 설정
1. **익명 로그인 켜기**: Dashboard → Authentication → Sign In / Providers → **Anonymous sign-ins** 활성화.
2. **마이그레이션 적용**: Dashboard → SQL Editor 에서 순서대로 실행
   - `supabase/migrations/0001_init.sql` (스키마 · RLS · RPC · Realtime)
   - `supabase/migrations/0002_storage.sql` (사진 버킷 · 정책)

   또는 Supabase CLI:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```

### 2. 환경변수
`.env.local` 에 키 입력:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. 실행
```bash
npm install
npm run dev   # http://localhost:3000
```

## 동작
- `/` — 투어 생성(호스트) 또는 코드로 입장
- `/t/{code}` — 온보딩(이름) → 평가/순위 탭. 호스트만 진행·공개·발표 컨트롤이 보임
- 게이트는 `advance_bowl` RPC에서 서버 검증(전원 입력 전엔 거부)
- 평가 중 `shop_name` 은 항상 null → 블라인드 유지. reveal에서만 채워짐

## 배포 (Vercel)
환경변수 두 개를 Vercel 프로젝트에 등록 후 배포.
