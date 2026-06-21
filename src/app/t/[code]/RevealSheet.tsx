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
  const [saving, setSaving] = useState<number | null>(null);

  async function save(n: number) {
    setSaving(n);
    try {
      await setShop(tourId, n, draft[n] ?? "");
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
          그릇 번호에 실제 가게명을 매핑하세요. 저장하면 순위·결과에 바로 반영돼요.
        </p>

        <div className="flex flex-col gap-2.5">
          {ns.map((n) => {
            const b = byN.get(n);
            return (
              <div key={n} className="card p-3.5">
                <div className="text-[13px] font-bold mb-2" style={{ color: "var(--ink-soft)" }}>
                  {n}번째{b?.menu ? ` · ${b.menu}` : ""} →
                </div>
                <div className="flex gap-2">
                  <input
                    className="field"
                    placeholder="가게명"
                    maxLength={30}
                    value={draft[n] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [n]: e.target.value }))}
                  />
                  <button className="btn btn-primary px-5" disabled={saving === n} onClick={() => save(n)}>
                    {saving === n ? "…" : "저장"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
