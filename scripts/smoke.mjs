import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const mk = () => createClient(URL_, KEY, { auth: { persistSession: false } });

function ok(label, cond, extra = "") {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? " — " + extra : ""}`);
  if (!cond) process.exitCode = 1;
}

// 호스트 기기
const host = mk();
const a1 = await host.auth.signInAnonymously();
ok("익명 로그인 (host)", !a1.error, a1.error?.message);

const ct = await host.rpc("create_tour", { p_team: "스모크테스트", p_count: 2 });
ok("create_tour RPC", !ct.error && !!ct.data?.code, ct.error?.message);
const tour = ct.data;
console.log("   → code:", tour?.code, "id:", tour?.id);
if (!tour) { console.log("중단: 투어 없음"); process.exit(1); }

// 참여자 기기
const guest = mk();
await guest.auth.signInAnonymously();
const jt = await guest.rpc("join_tour", { p_code: tour.code, p_name: "게스트" });
ok("join_tour RPC", !jt.error && !!jt.data?.id, jt.error?.message);
const guestPart = jt.data;

// 호스트 participant id 조회
const { data: hostUser } = await host.auth.getUser();
const { data: hostPart } = await host
  .from("participants").select("*").eq("tour_id", tour.id).eq("auth_uid", hostUser.user.id).single();

// 시작
const st = await host.rpc("start_tour", { p_tour: tour.id });
ok("start_tour (host)", !st.error, st.error?.message);

// 게스트가 호스트 권한 RPC 시도 → 거부되어야 함
const badStart = await guest.rpc("advance_bowl", { p_tour: tour.id });
ok("비호스트 advance_bowl 거부", !!badStart.error, badStart.error?.message ?? "에러 없음(문제!)");

// 한 명만 입력 → 게이트 닫힘
const r1 = await host.from("ratings").upsert({
  tour_id: tour.id, participant_id: hostPart.id, bowl_n: 1,
  taste: 3.5, noodle: 4, price: 5, visual: 2.5, condition: 2, revisit: true, menu: "가마타마",
}, { onConflict: "participant_id,bowl_n" }).select().single();
ok("ratings upsert (host, 0.5단위)", !r1.error, r1.error?.message);

const gate1 = await host.rpc("advance_bowl", { p_tour: tour.id });
ok("게이트 닫힘 (1/2 입력 시 거부)", !!gate1.error, gate1.error?.message);

// 0.5 단위 위반은 거부되어야 함
const badStep = await guest.from("ratings").upsert({
  tour_id: tour.id, participant_id: guestPart.id, bowl_n: 1,
  taste: 3.7, noodle: 4, price: 5, visual: 3,
}, { onConflict: "participant_id,bowl_n" });
ok("0.5단위 위반 거부 (3.7)", !!badStep.error, badStep.error?.message ?? "통과됨(문제!)");

// 게스트 정상 입력 → 전원(2/2)
const r2 = await guest.from("ratings").upsert({
  tour_id: tour.id, participant_id: guestPart.id, bowl_n: 1,
  taste: 4, noodle: 4, price: 4, visual: 4,
}, { onConflict: "participant_id,bowl_n" }).select().single();
ok("ratings upsert (guest)", !r2.error, r2.error?.message);

const gate2 = await host.rpc("advance_bowl", { p_tour: tour.id });
ok("게이트 열림 (2/2 → bowl 2)", !gate2.error && gate2.data === 2, gate2.error?.message ?? `bowl=${gate2.data}`);

// reveal & finish
const rev = await host.rpc("set_shop", { p_tour: tour.id, p_n: 1, p_shop: "테스트우동" });
ok("set_shop (reveal)", !rev.error, rev.error?.message);
const fin = await host.rpc("finish_tour", { p_tour: tour.id, p_finished: true });
ok("finish_tour", !fin.error, fin.error?.message);

// 게스트가 상호 점수 읽기 (RLS select)
const { data: allR, error: readErr } = await guest.from("ratings").select("*").eq("tour_id", tour.id);
ok("게스트가 전체 ratings 읽기 (RLS)", !readErr && allR.length === 2, readErr?.message ?? `${allR?.length}건`);

console.log("\n스모크 테스트 종료. (테스트 투어 코드:", tour.code, ")");
