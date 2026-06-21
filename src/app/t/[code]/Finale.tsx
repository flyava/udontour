"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { Bowl, Rating, Participant } from "@/lib/types";
import { bowlStats, ranked } from "@/lib/aggregate";

export function Finale({
  bowls,
  ratings,
  participants,
  meId,
  onClose,
}: {
  bowls: Bowl[];
  ratings: Rating[];
  participants: Participant[];
  meId: string;
  onClose: () => void;
}) {
  const stats = bowlStats(bowls, ratings, participants);
  const total = stats.length; // 팀이 비운 그릇 = 평가가 있는 distinct 그릇 수(평가 개수 아님)
  const mine = ratings.filter((r) => r.participant_id === meId).length; // 내가 먹은(평가한) 그릇
  const isGroup = participants.length >= 2;
  const winner = ranked(stats)[0] ?? null;

  const [count, setCount] = useState(0);
  const [showWinner, setShowWinner] = useState(false);
  const [burst, setBurst] = useState<
    {
      id: number;
      kind: "udon" | "confetti";
      tx: number;
      ty: number;
      rot: number;
      size: number;
      delay: number;
      color?: string;
      round?: boolean;
      fall?: number;
    }[]
  >([]);

  // 결산 오픈 시 우동 + 색종이가 폭죽처럼 터지는 인트로
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const COLORS = ["#e8822b", "#f6c453", "#4c9a5a", "#d4503e", "#c96612", "#f59ec0", "#7cc4e8"];
    const parts: typeof burst = [];
    let id = 0;
    // 우동 28개
    for (let i = 0; i < 28; i++) {
      const ang = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const dist = 130 + Math.random() * 210;
      parts.push({
        id: id++,
        kind: "udon",
        tx: Math.round(Math.cos(ang) * dist),
        ty: Math.round(Math.sin(ang) * dist),
        rot: Math.round((Math.random() - 0.5) * 660),
        size: Math.round(20 + Math.random() * 28),
        delay: Math.round(Math.random() * 130),
      });
    }
    // 색종이 48개
    for (let i = 0; i < 48; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 90 + Math.random() * 250;
      parts.push({
        id: id++,
        kind: "confetti",
        tx: Math.round(Math.cos(ang) * dist),
        ty: Math.round(Math.sin(ang) * dist),
        rot: Math.round((Math.random() - 0.5) * 960),
        size: Math.round(7 + Math.random() * 8),
        delay: Math.round(Math.random() * 170),
        color: COLORS[i % COLORS.length],
        round: Math.random() < 0.4,
        fall: Math.round(40 + Math.random() * 170),
      });
    }
    setBurst(parts);
    const t = setTimeout(() => setBurst([]), 1700);
    return () => clearTimeout(t);
  }, []);

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
      {burst.length > 0 && (
        <div className="fixed inset-0 z-[55] pointer-events-none overflow-hidden" aria-hidden>
          {burst.map((p) =>
            p.kind === "udon" ? (
              <span
                key={p.id}
                className="udon-burst"
                style={
                  {
                    left: "50%",
                    top: "46%",
                    fontSize: p.size,
                    animationDelay: `${p.delay}ms`,
                    "--tx": `${p.tx}px`,
                    "--ty": `${p.ty}px`,
                    "--rot": `${p.rot}deg`,
                  } as CSSProperties
                }
              >
                🍜
              </span>
            ) : (
              <i
                key={p.id}
                className="confetti-burst"
                style={
                  {
                    left: "50%",
                    top: "46%",
                    width: p.size,
                    height: Math.round(p.size * 0.6),
                    background: p.color,
                    borderRadius: p.round ? "50%" : "2px",
                    animationDelay: `${p.delay}ms`,
                    "--tx": `${p.tx}px`,
                    "--ty": `${p.ty}px`,
                    "--rot": `${p.rot}deg`,
                    "--fall": `${p.fall}px`,
                  } as CSSProperties
                }
              />
            ),
          )}
        </div>
      )}

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

      {isGroup && count >= total && (
        <div className="mt-2 text-[15px] font-bold" style={{ color: "var(--ink-soft)" }}>
          🍜 그중 내가 <span style={{ color: "var(--primary-dark)" }}>{mine}</span>그릇
        </div>
      )}

      <BowlStack count={count} total={total} />

      {showWinner && winner && (
        <div className="mt-8 pop-in w-full max-w-[340px]">
          <div className="text-[44px]">🏆</div>
          <div className="text-[13px] font-extrabold tracking-widest" style={{ color: "var(--primary-dark)" }}>
            우승 가게
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
