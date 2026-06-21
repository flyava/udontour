import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const mk = () => createClient(URL_, KEY, { auth: { persistSession: false } });

const host = mk(), g1 = mk(), g2 = mk();
await host.auth.signInAnonymously();
await g1.auth.signInAnonymously();
await g2.auth.signInAnonymously();

const ct = await host.rpc("create_tour", { p_team: "사누키 7가게 투어", p_count: 3, p_start: "2026-06-20", p_end: "2026-06-22" });
if (ct.error) { console.error("create_tour", ct.error.message); process.exit(1); }
const tour = ct.data;
await g1.rpc("join_tour", { p_code: tour.code, p_name: "지수" });
await g2.rpc("join_tour", { p_code: tour.code, p_name: "현우" });
await host.rpc("start_tour", { p_tour: tour.id });

const pid = async (c) => {
  const { data: { user } } = await c.auth.getUser();
  const { data } = await c.from("participants").select("id").eq("tour_id", tour.id).eq("auth_uid", user.id).single();
  return data.id;
};
const hp = await pid(host), p1 = await pid(g1), p2 = await pid(g2);

const half = (x) => Math.max(1, Math.min(5, Math.round(x * 2) / 2));
const j = () => Math.random() - 0.5;

const SHOPS = [
  ["さぬき麺業 兵庫町店", ""],
  ["うどん本陣 山田家", "https://maps.app.goo.gl/yamadaya"],
  ["手打十段 うどんバカ一代", ""],
  ["Ryuun 本格手打ちさぬきうどん 竜雲", "https://maps.app.goo.gl/ryuun"],
  ["セルフうどんの店 ちくせい", ""],
  ["中村うどん", ""],
  ["がもう", ""],
];
// [맛, 면발, 가성비, 비주얼] — 우승=3번(바카一代), 가성비=5/7, 비주얼=2번
const BASE = [
  [4.0, 4.1, 3.8, 3.9], [3.6, 3.7, 3.2, 4.4], [4.7, 4.8, 4.3, 4.4], [4.4, 4.5, 4.0, 4.3],
  [3.5, 3.6, 4.8, 3.3], [4.2, 4.3, 4.1, 3.8], [4.5, 4.4, 4.7, 3.4],
];
// 가게별 각자 먹은 우동(같은 것도/다른 것도) · 'skip' = 배불러서 패스
const PLAN = [
  { mori: "가마타마 우동", jisu: "가마타마 우동", hyun: "붓카케 우동" },      // 1: 같은+다른
  { mori: "니쿠 우동", jisu: "카케 우동", hyun: "니쿠 우동" },                // 2
  { mori: "붓카케 우동", jisu: "붓카케 우동", hyun: "붓카케 우동" },          // 3: 다 같은
  { mori: "skip", jisu: "자루 우동", hyun: "온타마 우동" },                   // 4: 모리 스킵
  { mori: "카마아게 우동", jisu: "skip", hyun: "카마아게 우동" },             // 5: 지수 스킵
  { mori: "텐푸라 우동", jisu: "카케 우동", hyun: "skip" },                   // 6: 현우 스킵
  { mori: "가마타마 우동", jisu: "가마타마 우동", hyun: "자루 우동" },        // 7
];

const rateRow = (p, n, b, menu, photo) => ({
  tour_id: tour.id, participant_id: p, bowl_n: n,
  taste: half(b[0] + j()), noodle: half(b[1] + j()), price: half(b[2] + j()), visual: half(b[3] + j()),
  condition: 1 + Math.floor(Math.random() * 5),
  revisit: (b[0] + b[1]) / 2 + j() > 3.9,
  menu, note: null,
  photo_urls: photo ? [photo] : [], photo_kinds: photo ? ["udon"] : [],
  updated_at: new Date().toISOString(),
});

const advLog = [];
for (let n = 1; n <= 7; n++) {
  const b = BASE[n - 1];
  const plan = PLAN[n - 1];
  const acts = [[host, hp, plan.mori, true], [g1, p1, plan.jisu, false], [g2, p2, plan.hyun, false]];
  for (const [c, p, menu, isHost] of acts) {
    if (menu === "skip") {
      const s = await c.from("skips").upsert({ tour_id: tour.id, participant_id: p, bowl_n: n }, { onConflict: "participant_id,bowl_n" });
      if (s.error) console.error("skip", n, s.error.message);
      continue;
    }
    let photo = null;
    if (isHost) {
      const file = `/tmp/udontest/udon_${((n - 1) % 9) + 1}.jpg`;
      if (existsSync(file)) {
        const path = `tour_${tour.id}/bowl_${n}/${hp}_udon_0.jpg`;
        await host.storage.from("bowl-photos").upload(path, readFileSync(file), { upsert: true, contentType: "image/jpeg" });
        photo = host.storage.from("bowl-photos").getPublicUrl(path).data.publicUrl + "?v=" + n;
      }
    }
    const r = await c.from("ratings").upsert(rateRow(p, n, b, menu, photo), { onConflict: "participant_id,bowl_n" });
    if (r.error) console.error("rating", n, isHost ? "host" : "guest", r.error.message);
  }
  if (n < 7) {
    const a = await host.rpc("advance_bowl", { p_tour: tour.id });
    advLog.push(`b${n}->${a.error ? "ERR:" + a.error.message : a.data}`);
  }
}

for (let n = 1; n <= 7; n++) {
  const [nm, map] = SHOPS[n - 1];
  const s = await host.rpc("set_shop", { p_tour: tour.id, p_n: n, p_shop: nm, p_map: map });
  if (s.error) console.error("set_shop", n, s.error.message);
}

const { data: { session } } = await host.auth.getSession();
console.log("CODE=" + tour.code);
console.log("ADV=" + advLog.join(" "));
console.log("SESSION=" + JSON.stringify(session));
