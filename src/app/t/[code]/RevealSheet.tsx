"use client";

import { useState } from "react";
import type { Bowl } from "@/lib/types";
import { setShop } from "@/lib/api";

export function RevealSheet({
  tourId,
  bowls,
  maxBowl,
  onClose,
}: {
  tourId: string;
  bowls: Bowl[];
  maxBowl: number;
  onClose: () => void;
}) {
  const byN = new Map(bowls.map((b) => [b.n, b]));
  const ns = Array.from({ length: maxBowl }, (_, i) => i + 1);
  const [draft, setDraft] = useState<Record<number, string>>(
    Object.fromEntries(ns.map((n) => [n, byN.get(n)?.shop_name ?? ""])),
  );
  const [maps, setMaps] = useState<Record<number, string>>(
    Object.fromEntries(ns.map((n) => [n, byN.get(n)?.map_url ?? ""])),
  );
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [warn, setWarn] = useState<string | null>(null);

  /** 링크 정규화: 비어있지 않은데 http로 시작 안 하면 https:// 붙임 */
  function normalizeUrl(raw: string): string {
    const v = raw.trim();
    if (!v) return "";
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  }

  async function save(n: number) {
    const shop = (draft[n] ?? "").trim();
    if (!shop) return; // 가게명 필수
    const map = normalizeUrl(maps[n] ?? "");
    setSaving(n);
    setWarn(null);
    try {
      await setShop(tourId, n, shop, map);
      setMaps((m) => ({ ...m, [n]: map }));
      setSaved((s) => ({ ...s, [n]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [n]: false })), 1800);
    } catch (e) {
      setWarn(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="flex items-center justify-between py-2">
          <h2 className="text-[19px] font-extrabold">정리 · 상호공개</h2>
          <button className="text-[14px] font-bold" style={{ color: "var(--ink-faint)" }} onClick={onClose}>
            닫기
          </button>
        </div>
        <p className="text-[13px] mb-3" style={{ color: "var(--ink-soft)" }}>
          그릇마다 실제 가게명을 꼭 입력하세요. 구글맵 링크는 선택이에요. 저장하면 순위·도감·결과에 바로 반영돼요.
        </p>

        <div className="flex flex-col gap-2.5">
          {ns.map((n) => {
            const b = byN.get(n);
            const shop = (draft[n] ?? "").trim();
            return (
              <div key={n} className="card p-3.5">
                <div className="text-[13px] font-bold mb-2" style={{ color: "var(--ink-soft)" }}>
                  {n}번째 가게 →
                </div>
                <input
                  className="field"
                  placeholder="가게명 (필수)"
                  maxLength={30}
                  value={draft[n] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [n]: e.target.value }))}
                />
                <input
                  className="field mt-2"
                  placeholder="구글맵 링크 (선택) · maps.app.goo.gl/…"
                  maxLength={500}
                  inputMode="url"
                  value={maps[n] ?? ""}
                  onChange={(e) => setMaps((m) => ({ ...m, [n]: e.target.value }))}
                />
                <button
                  className="btn btn-primary w-full mt-2.5"
                  disabled={saving === n || !shop}
                  onClick={() => save(n)}
                >
                  {saving === n ? "저장 중…" : saved[n] ? "저장됨 ✓" : !shop ? "가게명을 입력하세요" : "저장"}
                </button>
              </div>
            );
          })}
        </div>

        {warn && (
          <p className="mt-3 text-[13px]" style={{ color: "var(--red)" }}>
            {warn}
          </p>
        )}
      </div>
    </div>
  );
}
