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

const MAX_STACK = 9;
const BOWL = 38;
const STEP = 15; // 그릇 간 세로 간격(겹침)

/** 비운 그릇이 하나씩 떨어져 쌓이는 더미. count 가 올라갈 때마다 한 그릇씩 등장. */
function BowlStack({ count, total }: { count: number; total: number }) {
  const n = Math.min(total, MAX_STACK);
  if (n === 0) return null;
  return (
    <div
      className="relative mt-5"
      style={{ width: 90, height: BOWL + (n - 1) * STEP }}
      aria-hidden
    >
      {Array.from({ length: n }).map((_, i) => {
        const shown = count > i;
        const jitter = (i % 2 === 0 ? 1 : -1) * (2 + (i % 3)); // 살짝 흔들리는 단정한 스택
        return (
          <span
            key={i}
            className="absolute leading-none select-none"
            style={{
              left: "50%",
              bottom: i * STEP,
              fontSize: BOWL,
              zIndex: i,
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
}
