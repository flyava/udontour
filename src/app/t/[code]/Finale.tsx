"use client";

import { useEffect, useState } from "react";
import type { Bowl, Rating, Participant } from "@/lib/types";
import { bowlStats, ranked } from "@/lib/aggregate";

export function Finale({
  bowls,
  ratings,
  participants,
  onClose,
}: {
  bowls: Bowl[];
  ratings: Rating[];
  participants: Participant[];
  onClose: () => void;
}) {
  const total = ratings.length;
  const stats = bowlStats(bowls, ratings, participants);
  const winner = ranked(stats)[0] ?? null;

  const [count, setCount] = useState(0);
  const [showWinner, setShowWinner] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || total === 0) {
      setCount(total);
      setShowWinner(true);
      return;
    }
    const dur = 1600;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * total));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setShowWinner(true), 350);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "radial-gradient(circle at 50% 30%, #fff3df, var(--bg))" }}
    >
      <div className="text-[15px] font-extrabold tracking-widest" style={{ color: "var(--ink-soft)" }}>
        오늘의 우동투어 결산
      </div>

      <div className="mt-6">
        <div className="text-[13px] font-bold" style={{ color: "var(--ink-soft)" }}>
          우리가 비운 그릇
        </div>
        <div
          className="text-[88px] leading-none font-extrabold tabular-nums"
          style={{ color: "var(--primary-dark)" }}
        >
          {count}
        </div>
        <div className="text-[15px] font-bold" style={{ color: "var(--ink-soft)" }}>
          그릇
        </div>
      </div>

      <BowlStack count={count} total={total} />

      {showWinner && winner && (
        <div className="mt-8 pop-in w-full max-w-[340px]">
          <div className="text-[44px]">🏆</div>
          <div className="text-[13px] font-extrabold tracking-widest" style={{ color: "var(--primary-dark)" }}>
            우승 우동
          </div>
          <div className="text-[30px] font-extrabold mt-1">{winner.label}</div>
          <div className="text-[15px] font-bold mt-1" style={{ color: "var(--ink-soft)" }}>
            종합 {winner.overall.toFixed(2)} · {winner.votes}표
          </div>
          {winner.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={winner.photo} alt="" className="w-full h-44 object-cover rounded-2xl mt-4 card" />
          )}
          {winner.topNote && (
            <p className="mt-3 text-[14px] italic" style={{ color: "var(--ink-soft)" }}>
              “{winner.topNote.note}” — {winner.topNote.name}
            </p>
          )}
          {winner.mapUrl && (
            <a
              className="btn btn-line w-full mt-4"
              href={winner.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              📍 구글맵에서 보기
            </a>
          )}
        </div>
      )}

      <button className="btn btn-line mt-8 px-8" onClick={onClose}>
        닫기
      </button>
    </div>
  );
}

const BOWL = 36;
const STEP = 15; // 그릇 간 세로 간격(겹침)
const PER_COL = 9; // 한 열 최대 그릇 수 — 넘으면 옆에 새 열
const COL_GAP = 8;

/** 비운 그릇이 하나씩 떨어져 쌓이는 더미. 열이 차면 옆 열로 — 전체 그릇 수만큼 모두 등장. */
function BowlStack({ count, total }: { count: number; total: number }) {
  if (total === 0) return null;
  const cols = Math.ceil(total / PER_COL);
  const perCol = Math.ceil(total / cols); // 열 균등 분배(예: 18→9+9, 10→5+5)
  const height = BOWL + (perCol - 1) * STEP;
  return (
    <div className="flex items-end justify-center mt-5" style={{ gap: COL_GAP, height }} aria-hidden>
      {Array.from({ length: cols }).map((_, c) => {
        const colCount = Math.min(perCol, total - c * perCol);
        return (
          <div key={c} className="relative" style={{ width: BOWL, height }}>
            {Array.from({ length: colCount }).map((_, r) => {
              const idx = c * perCol + r; // 등장 순서(열을 채우고 다음 열)
              const shown = count > idx;
              const jitter = (idx % 2 === 0 ? 1 : -1) * (2 + (idx % 3));
              return (
                <span
                  key={r}
                  className="absolute leading-none select-none"
                  style={{
                    left: "50%",
                    bottom: r * STEP,
                    fontSize: BOWL,
                    zIndex: r,
                    opacity: shown ? 1 : 0,
                    transform: shown
                      ? `translate(calc(-50% + ${jitter}px), 0) rotate(${jitter * 0.5}deg)`
                      : "translate(-50%, -30px) scale(0.4)",
                    transition:
                      "opacity .18s ease, transform .42s cubic-bezier(0.2, 0.9, 0.3, 1.5)",
                    filter: "drop-shadow(0 4px 3px rgba(120, 70, 20, 0.2))",
                  }}
                >
                  🍜
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
