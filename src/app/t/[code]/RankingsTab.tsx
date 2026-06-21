"use client";

import type { Bowl, Rating, Participant } from "@/lib/types";
import { bowlStats, ranked, categoryWinner, myRanked, type BowlStat } from "@/lib/aggregate";

export function RankingsTab({
  bowls,
  ratings,
  participants,
  meId,
}: {
  bowls: Bowl[];
  ratings: Rating[];
  participants: Participant[];
  meId: string;
}) {
  const stats = bowlStats(bowls, ratings, participants);
  const order = ranked(stats);
  const mine = myRanked(bowls, ratings, meId).slice(0, 5);
  const total = stats.length; // 비운 그릇 = distinct 그릇 수(평가 개수 아님)

  if (stats.length === 0) {
    return (
      <div className="px-5 py-16 text-center" style={{ color: "var(--ink-faint)" }}>
        아직 집계할 평가가 없어요.
      </div>
    );
  }

  const winner = order[0];
  const cats = [
    { key: "taste" as const, label: "맛", emoji: "😋" },
    { key: "noodle" as const, label: "면발", emoji: "🍜" },
    { key: "price" as const, label: "가성비", emoji: "💸" },
    { key: "visual" as const, label: "비주얼", emoji: "✨" },
  ];
  const maxOverall = Math.max(...stats.map((s) => s.overall), 5);

  return (
    <div className="px-5 pb-28 pt-2">
      {/* 누적 카운터 */}
      <div className="card p-4 flex items-center justify-between">
        <span className="text-[14px] font-bold" style={{ color: "var(--ink-soft)" }}>
          지금까지 비운 그릇
        </span>
        <span className="text-[26px] font-extrabold tabular-nums" style={{ color: "var(--primary-dark)" }}>
          {total}
        </span>
      </div>

      {/* 1위 카드 */}
      <WinnerCard stat={winner} />

      {/* 내 평가 순위 */}
      {mine.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-[15px] font-extrabold">내 평가 순위</h3>
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {mine.map((m, i) => (
              <div key={m.n} className="flex items-center gap-3 p-3.5" style={{ borderColor: "var(--line)" }}>
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-extrabold shrink-0"
                  style={{
                    background: i === 0 ? "var(--broth)" : "var(--bg-2)",
                    color: i === 0 ? "#fff" : "var(--ink-soft)",
                  }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">
                    {m.menu || m.label}
                    {m.revisit && <span className="ml-1.5 text-[12px]">💘</span>}
                  </div>
                  {m.menu && (
                    <div className="text-[12px] truncate" style={{ color: "var(--ink-faint)" }}>
                      📍 {m.label}
                    </div>
                  )}
                </div>
                <div className="font-extrabold tabular-nums shrink-0">{m.score.toFixed(2)}</div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--ink-faint)" }}>
            내가 매긴 점수 기준 · 상위 {mine.length}
          </p>
        </>
      )}

      {/* 종합 순위 */}
      <h3 className="mt-6 mb-2 text-[15px] font-extrabold">종합 순위</h3>
      <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
        {order.map((s, i) => (
          <div key={s.n} className="flex items-center gap-3 p-3.5" style={{ borderColor: "var(--line)" }}>
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-extrabold shrink-0"
              style={{
                background: i === 0 ? "var(--primary)" : "var(--bg-2)",
                color: i === 0 ? "#fff" : "var(--ink-soft)",
              }}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">
                {s.label}
                {s.mapUrl && (
                  <a
                    href={s.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1.5 text-[12px]"
                    style={{ color: "var(--primary-dark)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    📍
                  </a>
                )}
              </div>
              <div className="h-1.5 rounded-full mt-1.5" style={{ background: "var(--bg-2)" }}>
                <div
                  className="h-1.5 rounded-full"
                  style={{ width: `${(s.overall / maxOverall) * 100}%`, background: "var(--primary)" }}
                />
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-extrabold tabular-nums">{s.overall.toFixed(2)}</div>
              <div className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                {s.votes}표
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 부문별 1위 */}
      <h3 className="mt-6 mb-2 text-[15px] font-extrabold">부문별 1위</h3>
      <div className="grid grid-cols-2 gap-2.5">
        {cats.map((c) => {
          const w = categoryWinner(stats, c.key);
          return (
            <div key={c.key} className="card p-3.5">
              <div className="text-[13px] font-bold" style={{ color: "var(--ink-soft)" }}>
                {c.emoji} {c.label}
              </div>
              <div className="font-extrabold mt-1 truncate">{w?.label ?? "—"}</div>
              <div className="text-[13px]" style={{ color: "var(--primary-dark)" }}>
                {w ? w[c.key].toFixed(2) : "—"}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

function WinnerCard({ stat }: { stat: BowlStat }) {
  return (
    <div className="card mt-4 overflow-hidden pop-in">
      {stat.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={stat.photo} alt="" className="w-full h-44 object-cover" />
      )}
      <div className="p-4">
        <div className="text-[12px] font-extrabold tracking-wide" style={{ color: "var(--primary-dark)" }}>
          🏆 현재 1위
        </div>
        <div className="text-[22px] font-extrabold mt-0.5">{stat.label}</div>
        <div className="text-[15px] font-bold" style={{ color: "var(--ink-soft)" }}>
          종합 {stat.overall.toFixed(2)} · {stat.votes}표
        </div>
        {stat.topNote && (
          <p className="mt-2 text-[14px] italic" style={{ color: "var(--ink-soft)" }}>
            “{stat.topNote.note}” — {stat.topNote.name}
          </p>
        )}
        {stat.mapUrl && (
          <a
            className="btn btn-line w-full mt-3"
            href={stat.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            📍 구글맵에서 보기
          </a>
        )}
      </div>
    </div>
  );
}

