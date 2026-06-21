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

const ct = await host.rpc("create_tour", { p_team: "스킵 테스트투어", p_count: 3, p_start: "2026-06-20", p_end: "2026-06-22" });
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
const BASE = [3.8, 4.2, 3.5, 4.6, 3.2, 4.8, 3.9, 4.0, 3.6, 4.3];
const HOST_SKIP = new Set([8, 9]); // 호스트가 배불러서 패스한 그릇
const HOST_NONE = new Set([10]);   // 마지막 그릇은 호스트가 앱에서 직접 처리(미입력)

const rateRow = (tid, p, n, b, withPhoto) => ({
  tour_id: tid, participant_id: p, bowl_n: n,
  taste: half(b + j()), noodle: half(b + j()), price: half(b - 0.2 + j()), visual: half(b + 0.1 + j()),
  condition: 1 + Math.floor(Math.random() * 5), revisit: b + j() > 3.9,
  menu: null, note: null,
  photo_urls: withPhoto ? [withPhoto] : [], photo_kinds: withPhoto ? ["udon"] : [],
  updated_at: new Date().toISOString(),
});

const advLog = [];
for (let n = 1; n <= 10; n++) {
  const b = BASE[n - 1];
  // 게스트 2명은 항상 평가
  await g1.from("ratings").upsert(rateRow(tour.id, p1, n, b, null), { onConflict: "participant_id,bowl_n" });
  await g2.from("ratings").upsert(rateRow(tour.id, p2, n, b, null), { onConflict: "participant_id,bowl_n" });
  // 호스트: 평가 / 스킵 / 미입력
  if (HOST_SKIP.has(n)) {
    const s = await host.from("skips").upsert({ tour_id: tour.id, participant_id: hp, bowl_n: n }, { onConflict: "participant_id,bowl_n" });
    if (s.error) console.error("skip", n, s.error.message);
  } else if (!HOST_NONE.has(n)) {
    let photo = null;
    const file = `/tmp/udontest/udon_${((n - 1) % 9) + 1}.jpg`;
    if (existsSync(file)) {
      const path = `tour_${tour.id}/bowl_${n}/${hp}_udon_0.jpg`;
      await host.storage.from("bowl-photos").upload(path, readFileSync(file), { upsert: true, contentType: "image/jpeg" });
      photo = host.storage.from("bowl-photos").getPublicUrl(path).data.publicUrl + "?v=" + n;
    }
    await host.from("ratings").upsert(rateRow(tour.id, hp, n, b, photo), { onConflict: "participant_id,bowl_n" });
  }
  // 진행(마지막 직전까지). 스킵 그릇에서 게이트가 통과돼야 함
  if (n < 10) {
    const a = await host.rpc("advance_bowl", { p_tour: tour.id });
    advLog.push(`b${n}->${a.error ? "ERR:" + a.error.message : a.data}`);
  }
}

const NAMES = [[6, "Ryuun 本格手打ちさぬきうどん 竜雲", "https://maps.app.goo.gl/ryuun"]];
for (const [n, nm, map] of NAMES) await host.rpc("set_shop", { p_tour: tour.id, p_n: n, p_shop: nm, p_map: map });

const { data: { session } } = await host.auth.getSession();
console.log("CODE=" + tour.code);
console.log("ADV=" + advLog.join(" "));
console.log("SESSION=" + JSON.stringify(session));
