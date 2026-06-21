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

const ct = await host.rpc("create_tour", {
  p_team: "우동 삼인투어", p_count: 3, p_start: "2026-06-20", p_end: "2026-06-22",
});
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
const j = () => (Math.random() - 0.5); // -0.5~0.5
// 그릇별 [맛, 면발, 가성비, 비주얼] 베이스 — 우승은 6번(가성비 9번, 비주얼 2번이 강점)
const BASE = [
  [3.8, 3.9, 3.5, 3.7], [4.1, 4.0, 3.6, 4.7], [3.4, 3.6, 3.5, 3.3], [4.5, 4.6, 4.0, 4.3],
  [3.1, 3.3, 3.0, 3.2], [4.8, 4.7, 4.4, 4.6], [3.9, 3.7, 3.8, 3.8], [4.0, 4.1, 3.9, 3.6],
  [3.6, 3.7, 4.8, 3.5], [4.2, 4.3, 4.0, 4.1],
];
const NOTES = {
  1: "코시가 살아있다", 4: "출장 와서 먹은 인생 우동", 6: "면·국물·튀김 삼박자",
  9: "이 가격에 이 퀄리티?", 2: "비주얼 깡패 온타마",
};

for (let n = 1; n <= 10; n++) {
  const b = BASE[n - 1];
  // 호스트가 사진 업로드(도감/우승카드용)
  let photo = null;
  const file = `/tmp/udontest/udon_${((n - 1) % 9) + 1}.jpg`;
  if (existsSync(file)) {
    const path = `tour_${tour.id}/bowl_${n}/${hp}_udon_0.jpg`;
    const up = await host.storage.from("bowl-photos").upload(path, readFileSync(file), { upsert: true, contentType: "image/jpeg" });
    if (up.error) console.error("upload", n, up.error.message);
    else photo = host.storage.from("bowl-photos").getPublicUrl(path).data.publicUrl + "?v=" + n;
  }
  const raters = [[host, hp, true], [g1, p1, false], [g2, p2, false]];
  for (const [c, p, isHost] of raters) {
    const r = await c.from("ratings").upsert({
      tour_id: tour.id, participant_id: p, bowl_n: n,
      taste: half(b[0] + j()), noodle: half(b[1] + j()), price: half(b[2] + j()), visual: half(b[3] + j()),
      condition: 1 + Math.floor(Math.random() * 5),
      revisit: (b[0] + b[1]) / 2 + j() > 3.9,
      menu: null,
      note: isHost ? (NOTES[n] ?? null) : null,
      photo_urls: isHost && photo ? [photo] : [],
      photo_kinds: isHost && photo ? ["udon"] : [],
      updated_at: new Date().toISOString(),
    }, { onConflict: "participant_id,bowl_n" });
    if (r.error) console.error("rating", n, isHost ? "host" : "guest", r.error.message);
  }
  if (n < 10) {
    const a = await host.rpc("advance_bowl", { p_tour: tour.id });
    if (a.error) console.error("advance", n, a.error.message);
  }
}

// 상호명 공개(일부) + 우승 그릇에 지도 링크
const NAMES = [
  [1, "さぬき麺業 兵庫町店", ""], [4, "手打十段 うどんバカ一代", ""],
  [6, "Ryuun 本格手打ちさぬきうどん 竜雲", "https://maps.app.goo.gl/ryuun-honten"],
  [9, "セルフうどんの店 ちくせい", ""],
];
for (const [n, nm, map] of NAMES) {
  const s = await host.rpc("set_shop", { p_tour: tour.id, p_n: n, p_shop: nm, p_map: map });
  if (s.error) console.error("set_shop", n, s.error.message);
}

const { data: { session } } = await host.auth.getSession();
console.log("CODE=" + tour.code);
console.log("SESSION=" + JSON.stringify(session));
