"use client";

import { useEffect, useMemo, useState } from "react";
import type { Bowl, Rating } from "@/lib/types";
import { myDex, dexCols, type DexSlot } from "@/lib/aggregate";
import { renderDexCard, type ShareSlot } from "@/lib/shareCard";

export function DexTab({
  bowls,
  ratings,
  meId,
  myName,
  team,
  totalSlots,
  onOpenBowl,
  onToast,
}: {
  bowls: Bowl[];
  ratings: Rating[];
  meId: string;
  myName: string;
  team: string;
  totalSlots: number;
  onOpenBowl: (n: number) => void;
  onToast: (m: string) => void;
}) {
  const slots = useMemo(
    () => myDex(bowls, ratings, meId, totalSlots),
    [bowls, ratings, meId, totalSlots],
  );
  const cols = dexCols(totalSlots);
  const myCount = slots.filter((s) => s.filled).length;
  const complete = totalSlots > 0 && myCount === totalSlots;
  const avg =
    myCount > 0
      ? slots.filter((s) => s.filled).reduce((a, s) => a + (s.score ?? 0), 0) / myCount
      : 0;

  const [detail, setDetail] = useState<DexSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [canFileShare, setCanFileShare] = useState(false);

  useEffect(() => {
    try {
      const f = new File([new Blob([""])], "x.png", { type: "image/png" });
      setCanFileShare(!!navigator.canShare?.({ files: [f] }));
    } catch {
      setCanFileShare(false);
    }
  }, []);

  if (totalSlots === 0) {
    return (
      <div className="px-5 py-16 text-center" style={{ color: "var(--ink-faint)" }}>
        첫 우동이 열리면 도감이 채워져요.
      </div>
    );
  }

  function cellTap(s: DexSlot) {
    if (s.filled) setDetail(s);
    else onOpenBowl(s.n);
  }

  async function doShare(download: boolean) {
    setBusy(true);
    try {
      const shareSlots: ShareSlot[] = slots.map((s) => ({
        n: s.n,
        filled: s.filled,
        label: s.shopRevealed || s.menu ? s.label : `${s.n}번째`,
        score: s.score,
        photo: s.photo,
      }));
      const now = new Date();
      const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(
        now.getDate(),
      ).padStart(2, "0")}`;
      const blob = await renderDexCard({
        team,
        who: `${myName}의 우동 도감`,
        slots: shareSlots,
        cols,
        footer: `${date} · ${myCount}그릇 · 평균 ${avg.toFixed(2)}`,
      });
      const file = new File([blob], "udontour-dex.png", { type: "image/png" });

      if (!download && canFileShare && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "모리 우동투어 도감",
          text: `${myName}의 우동 도감 🍜`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "udontour-dex.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        onToast("이미지를 저장했어요!");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") onToast("공유 이미지를 만들지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 pb-28 pt-2">
      {/* 진행 헤더 */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <h3 className="text-[15px] font-extrabold">내 우동 도감</h3>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
            {complete ? "전부 모았어요! 🎉" : "잠긴 칸을 눌러 평가를 채워요"}
          </p>
        </div>
        <span className="text-[14px] font-extrabold tabular-nums" style={{ color: "var(--primary-dark)" }}>
          {myCount}/{totalSlots}
        </span>
      </div>

      {/* 격자 */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {slots.map((s) => (
          <DexCell key={s.n} slot={s} onTap={() => cellTap(s)} />
        ))}
      </div>

      {/* 공유 */}
      <div className="mt-6">
        {complete ? (
          <div className="flex gap-2">
            <button className="btn btn-line flex-1" disabled={busy} onClick={() => doShare(true)}>
              이미지 저장
            </button>
            {canFileShare && (
              <button className="btn btn-primary flex-1" disabled={busy} onClick={() => doShare(false)}>
                {busy ? "만드는 중…" : "공유하기"}
              </button>
            )}
          </div>
        ) : (
          <button className="btn btn-ghost w-full" disabled>
            🔒 다 모으면 공유할 수 있어요 ({myCount}/{totalSlots})
          </button>
        )}
        {complete && busy && (
          <p className="mt-2 text-center text-[12px]" style={{ color: "var(--ink-faint)" }}>
            도감 이미지를 만드는 중…
          </p>
        )}
      </div>

      {detail && <DexDetail slot={detail} onClose={() => setDetail(null)} onEdit={onOpenBowl} />}
    </div>
  );
}

function DexCell({ slot, onTap }: { slot: DexSlot; onTap: () => void }) {
  const label = slot.shopRevealed || slot.menu ? slot.label : `${slot.n}번째`;
  return (
    <button
      onClick={onTap}
      className="relative rounded-2xl overflow-hidden"
      style={{
        aspectRatio: "1 / 1",
        border: `1.5px solid ${slot.filled ? "transparent" : "var(--line)"}`,
        background: slot.filled ? "var(--bg-2)" : "var(--surface-2)",
      }}
    >
      {slot.filled ? (
        <>
          {slot.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slot.photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center text-[28px]"
              style={{ background: "linear-gradient(160deg, var(--broth), var(--primary))" }}
            >
              🍜
            </div>
          )}
          <div
            className="absolute inset-x-0 bottom-0 px-1.5 pt-5 pb-1.5"
            style={{ background: "linear-gradient(to top, rgba(20,12,4,0.8), transparent)" }}
          >
            <div className="text-[10.5px] font-extrabold text-white truncate leading-tight">
              {label}
            </div>
          </div>
          {slot.score != null && (
            <span
              className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[13px] font-extrabold tabular-nums"
              style={{ background: "rgba(255,255,255,0.95)", color: "var(--primary-dark)" }}
            >
              {slot.score.toFixed(1)}
            </span>
          )}
          {slot.udonPhotos.length > 1 && (
            <span
              className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums"
              style={{ background: "rgba(20,12,4,0.6)", color: "#fff" }}
            >
              📷 {slot.udonPhotos.length}
            </span>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-[24px] font-extrabold" style={{ color: "var(--ink-faint)" }}>
            ?
          </span>
          <span className="text-[10px] font-bold" style={{ color: "var(--ink-faint)" }}>
            {slot.n}번째
          </span>
        </div>
      )}
    </button>
  );
}

function DexDetail({
  slot,
  onClose,
  onEdit,
}: {
  slot: DexSlot;
  onClose: () => void;
  onEdit: (n: number) => void;
}) {
  const axes = [
    { label: "맛", v: slot.taste },
    { label: "면발", v: slot.noodle },
    { label: "가성비", v: slot.price },
    { label: "비주얼", v: slot.visual },
  ];
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="flex items-center justify-between py-2">
          <h2 className="text-[19px] font-extrabold truncate pr-3">
            {slot.shopRevealed || slot.menu ? slot.label : `${slot.n}번째 우동`}
          </h2>
          <button className="text-[14px] font-bold shrink-0" style={{ color: "var(--ink-faint)" }} onClick={onClose}>
            닫기
          </button>
        </div>

        {slot.udonPhotos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 snap-x">
            {slot.udonPhotos.map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={u}
                src={u}
                alt=""
                className={`h-52 shrink-0 object-cover rounded-2xl card snap-center ${
                  slot.udonPhotos.length > 1 ? "w-[78%]" : "w-full"
                }`}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <span className="text-[13px] font-bold" style={{ color: "var(--ink-soft)" }}>
            내 종합 점수
          </span>
          <span className="text-[24px] font-extrabold tabular-nums" style={{ color: "var(--primary-dark)" }}>
            {slot.score?.toFixed(2) ?? "—"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          {axes.map((a) => (
            <div key={a.label} className="card p-3 flex items-center justify-between">
              <span className="text-[13px] font-bold" style={{ color: "var(--ink-soft)" }}>
                {a.label}
              </span>
              <span className="font-extrabold tabular-nums">{a.v.toFixed(1)}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-3">
          {slot.condition != null && (
            <div className="card p-3 flex-1 text-center">
              <div className="text-[12px] font-bold" style={{ color: "var(--ink-soft)" }}>
                컨디션
              </div>
              <div className="font-extrabold mt-0.5">{slot.condition}/5</div>
            </div>
          )}
          {slot.revisit != null && (
            <div className="card p-3 flex-1 text-center">
              <div className="text-[12px] font-bold" style={{ color: "var(--ink-soft)" }}>
                재방문
              </div>
              <div className="font-extrabold mt-0.5">{slot.revisit ? "💘 또 간다" : "한 번이면 충분"}</div>
            </div>
          )}
        </div>

        {slot.note && (
          <p className="mt-3 text-[14px] italic card p-3.5" style={{ color: "var(--ink-soft)" }}>
            “{slot.note}”
          </p>
        )}

        <div className="flex gap-2 mt-5">
          {slot.mapUrl && (
            <a
              className="btn btn-primary flex-1"
              href={slot.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              📍 구글맵
            </a>
          )}
          <button
            className="btn btn-line flex-1"
            onClick={() => {
              onClose();
              onEdit(slot.n);
            }}
          >
            평가 수정
          </button>
        </div>
      </div>
    </div>
  );
}
