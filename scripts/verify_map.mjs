import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

function ok(label, cond, extra = "") {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? " — " + extra : ""}`);
  if (!cond) process.exitCode = 1;
}

await sb.auth.signInAnonymously();
const ct = await sb.rpc("create_tour", { p_team: "맵검증", p_count: 1 });
ok("create_tour", !ct.error && !!ct.data?.code, ct.error?.message);
const tour = ct.data;
if (!tour) process.exit(1);

await sb.rpc("start_tour", { p_tour: tour.id });

const SHOP = "마루가메제면 시부야점";
const MAP = "https://maps.app.goo.gl/verifyTest123";

// 4-인자 set_shop (가게명 + 구글맵 링크)
const rev = await sb.rpc("set_shop", { p_tour: tour.id, p_n: 1, p_shop: SHOP, p_map: MAP });
ok("set_shop (4-인자, p_map 포함)", !rev.error, rev.error?.message);

// 되읽기
const { data: bowl, error: readErr } = await sb
  .from("bowls")
  .select("n, shop_name, map_url")
  .eq("tour_id", tour.id)
  .eq("n", 1)
  .single();
ok("bowl 되읽기", !readErr, readErr?.message);
ok("shop_name 저장됨", bowl?.shop_name === SHOP, `값: ${bowl?.shop_name}`);
ok("map_url 저장됨", bowl?.map_url === MAP, `값: ${bowl?.map_url}`);

// 링크만 지우고 가게명 유지되는지(빈 맵 → null)
const rev2 = await sb.rpc("set_shop", { p_tour: tour.id, p_n: 1, p_shop: SHOP, p_map: "" });
ok("set_shop (맵 비우기)", !rev2.error, rev2.error?.message);
const { data: bowl2 } = await sb
  .from("bowls")
  .select("shop_name, map_url")
  .eq("tour_id", tour.id)
  .eq("n", 1)
  .single();
ok("맵 비우면 map_url = null", bowl2?.map_url === null, `값: ${bowl2?.map_url}`);
ok("가게명은 유지", bowl2?.shop_name === SHOP, `값: ${bowl2?.shop_name}`);

console.log("\n검증 종료. (테스트 투어 코드:", tour.code, ")");
