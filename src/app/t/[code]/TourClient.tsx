"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Bowl, Participant } from "@/lib/types";
import { bowlLabel } from "@/lib/types";
import {
  resolveMembership,
  joinTour,
  startTour,
  advanceBowl,
  prevBowl,
  finishTour,
  setCount,
  skipBowl,
  unskipBowl,
} from "@/lib/api";
import { useTourData, bowlSubmitCount } from "@/lib/useTour";
import { RatingSheet } from "./RatingSheet";
import { RevealSheet } from "./RevealSheet";
import { RankingsTab } from "./RankingsTab";
import { DexTab } from "./DexTab";
import { Finale } from "./Finale";

type Phase = "loading" | "onboarding" | "ready";
type TabKey = "eval" | "rank" | "dex";

export function TourClient({ code }: { code: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [tourId, setTourId] = useState<string | null>(null);
  const [me, setMe] = useState<Participant | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const m = await resolveMembership(code);
        if (!active) return;
        if (m) {
          setTourId(m.tour.id);
          setMe(m.me);
          setPhase("ready");
        } else {
          setPhase("onboarding");
        }
      } catch {
        if (active) setPhase("onboarding");
      }
    })();
    return () => {
      active = false;
    };
  }, [code]);

  if (phase === "loading") return <Splash />;
  if (phase === "onboarding")
    return (
      <Onboarding
        code={code}
        notFound={notFound}
        onJoin={async (name) => {
          try {
            const p = await joinTour(code, name);
            setTourId(p.tour_id);
            setMe(p);
            setPhase("ready");
            return true;
          } catch {
            setNotFound(true);
            return false;
          }
        }}
      />
    );

  return <TourInner tourId={tourId!} me={me!} setMe={setMe} code={code} />;
}

function TourInner({
  tourId,
  me,
  setMe,
  code,
}: {
  tourId: string;
  me: Participant;
  setMe: (p: Participant) => void;
  code: string;
}) {
  const { tour, participants, bowls, ratings, skips, ready } = useTourData(tourId);
  const [tab, setTab] = useState<TabKey>("eval");
  const [sheetBowl, setSheetBowl] = useState<number | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [showFinale, setShowFinale] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 내 최신 participant 동기화(이름/host)
  useEffect(() => {
    const mine = participants.find((p) => p.id === me.id);
    if (mine && (mine.name !== me.name || mine.is_host !== me.is_host)) setMe(mine);
  }, [participants, me, setMe]);

  useEffect(() => {
    if (tour?.finished) setShowFinale(true);
  }, [tour?.finished]);

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  }

  if (!ready || !tour) return <Splash />;

  const isHost = me.is_host;
  const cur = tour.current_bowl;
  const submitted = cur > 0 ? bowlSubmitCount(ratings, skips, cur) : 0;
  const need = tour.participant_count;
  const gateOpen = submitted >= need;
  const myRating = (n: number) => ratings.find((r) => r.participant_id === me.id && r.bowl_n === n) ?? null;
  const mySkipped = (n: number) => skips.some((s) => s.participant_id === me.id && s.bowl_n === n);
  const servedBowls = Math.max(
    tour.max_bowl ?? 0,
    cur,
    ...bowls.map((b) => b.n),
    ...ratings.filter((r) => r.participant_id === me.id).map((r) => r.bowl_n),
    0,
  );
  const bowlByN = (n: number): Bowl =>
    bowls.find((b) => b.n === n) ?? { id: `tmp-${n}`, tour_id: tourId, n, menu: null, shop_name: null, map_url: null };
  const sheetBowlObj = sheetBowl != null ? bowlByN(sheetBowl) : null;

  return (
    <main className="min-h-dvh pb-24">
      <Header tour={tour} code={code} isHost={isHost} myName={me.name} onShare={flash} />

      <div className="px-5">
        <Tabs tab={tab} setTab={setTab} />
      </div>

      {tab === "eval" ? (
        <EvalTab
          tour={tour}
          bowls={bowls}
          isHost={isHost}
          cur={cur}
          submitted={submitted}
          need={need}
          gateOpen={gateOpen}
          myRating={myRating}
          mySkippedCur={mySkipped(cur)}
          onSkip={async () => {
            try {
              await skipBowl(tourId, me.id, cur);
            } catch (e) {
              flash(errMsg(e));
            }
          }}
          onUnskip={async () => {
            try {
              await unskipBowl(me.id, cur);
            } catch (e) {
              flash(errMsg(e));
            }
          }}
          onOpenBowl={(n) => setSheetBowl(n)}
          onStart={async () => {
            try {
              await startTour(tourId);
            } catch (e) {
              flash(errMsg(e));
            }
          }}
          onNext={async () => {
            try {
              await advanceBowl(tourId);
            } catch (e) {
              flash(errMsg(e));
            }
          }}
          onPrev={async () => {
            try {
              await prevBowl(tourId);
            } catch (e) {
              flash(errMsg(e));
            }
          }}
          onSetCount={async (c) => {
            try {
              await setCount(tourId, c);
            } catch (e) {
              flash(errMsg(e));
            }
          }}
          onReveal={() => setRevealOpen(true)}
          onFinish={async () => {
            try {
              await finishTour(tourId, true);
              setShowFinale(true); // 다시 눌러도 항상 결산이 열리도록
            } catch (e) {
              flash(errMsg(e));
            }
          }}
        />
      ) : tab === "rank" ? (
        <RankingsTab bowls={bowls} ratings={ratings} participants={participants} meId={me.id} />
      ) : (
        <DexTab
          bowls={bowls}
          ratings={ratings}
          meId={me.id}
          myName={me.name}
          team={tour.team_name}
          totalSlots={servedBowls}
          tripStart={tour.trip_start}
          tripEnd={tour.trip_end}
          onOpenBowl={(n) => setSheetBowl(n)}
          onToast={flash}
        />
      )}

      {sheetBowlObj && (
        <RatingSheet
          tourId={tourId}
          participantId={me.id}
          bowl={sheetBowlObj}
          existing={myRating(sheetBowlObj.n)}
          onClose={() => setSheetBowl(null)}
          onSaved={() => {
            flash("저장했어요!");
            if (sheetBowl != null && mySkipped(sheetBowl)) unskipBowl(me.id, sheetBowl).catch(() => {});
          }}
        />
      )}

      {revealOpen && (
        <RevealSheet
          tourId={tourId}
          bowls={bowls}
          maxBowl={Math.max(tour.max_bowl, 1)}
          onClose={() => setRevealOpen(false)}
        />
      )}

      {showFinale && (
        <Finale
          bowls={bowls}
          ratings={ratings}
          participants={participants}
          meId={me.id}
          onClose={() => setShowFinale(false)}
        />
      )}

      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] px-4 py-2.5 rounded-full text-[14px] font-bold text-white"
          style={{ background: "rgba(43,33,24,0.92)" }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}

/* ---------------- sub views ---------------- */

function Header({
  tour,
  code,
  isHost,
  myName,
  onShare,
}: {
  tour: { team_name: string };
  code: string;
  isHost: boolean;
  myName: string;
  onShare: (m: string) => void;
}) {
  async function share() {
    const url = `${location.origin}/t/${code}`;
    try {
      if (navigator.share) await navigator.share({ title: "모리 우동투어", url });
      else {
        await navigator.clipboard.writeText(url);
        onShare("링크를 복사했어요!");
      }
    } catch {
      /* canceled */
    }
  }
  return (
    <header className="px-5 pt-5 pb-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-[22px]">
          🍜
        </Link>
        <button className="chip" onClick={share}>
          {code} · 공유
        </button>
      </div>
      <h1 className="mt-2 text-[24px] font-extrabold">{tour.team_name}</h1>
      <p className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
        {myName} {isHost && "· 호스트"}
      </p>
    </header>
  );
}

function Tabs({ tab, setTab }: { tab: TabKey; setTab: (t: TabKey) => void }) {
  const labels: Record<TabKey, string> = { eval: "평가", rank: "순위", dex: "도감" };
  return (
    <div className="flex gap-1 p-1 rounded-full mb-3" style={{ background: "var(--bg-2)" }}>
      {(["eval", "rank", "dex"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className="flex-1 py-2.5 rounded-full text-[14px] font-extrabold transition"
          style={{
            background: tab === t ? "var(--surface)" : "transparent",
            color: tab === t ? "var(--ink)" : "var(--ink-soft)",
            boxShadow: tab === t ? "var(--shadow)" : "none",
          }}
        >
          {labels[t]}
        </button>
      ))}
    </div>
  );
}

function EvalTab(props: {
  tour: { started: boolean; finished: boolean; participant_count: number; max_bowl: number };
  bowls: Bowl[];
  isHost: boolean;
  cur: number;
  submitted: number;
  need: number;
  gateOpen: boolean;
  myRating: (n: number) => unknown;
  mySkippedCur: boolean;
  onSkip: () => void;
  onUnskip: () => void;
  onOpenBowl: (n: number) => void;
  onStart: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSetCount: (c: number) => void;
  onReveal: () => void;
  onFinish: () => void;
}) {
  const {
    tour,
    bowls,
    isHost,
    cur,
    submitted,
    need,
    gateOpen,
    myRating,
    mySkippedCur,
    onSkip,
    onUnskip,
    onOpenBowl,
    onStart,
    onNext,
    onPrev,
    onSetCount,
    onReveal,
    onFinish,
  } = props;

  if (!tour.started) {
    return (
      <div className="px-5">
        {isHost ? (
          <div className="card p-6 text-center">
            <div className="text-4xl">🥢</div>
            <p className="mt-3 font-bold">준비되면 첫 가게를 여세요.</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--ink-soft)" }}>
              전원이 입력해야 다음 가게가 열려요.
            </p>
            <button className="btn btn-primary w-full mt-5" onClick={onStart}>
              첫 가게 시작 →
            </button>
            <CountAdjust need={need} onSetCount={onSetCount} />
          </div>
        ) : (
          <div className="card p-8 text-center">
            <div className="text-4xl">⏳</div>
            <p className="mt-3 font-bold">호스트가 첫 가게를 열면 시작해요.</p>
          </div>
        )}
      </div>
    );
  }

  const mineCur = !!myRating(cur);

  return (
    <div className="px-5">
      {/* 진행도 */}
      {isHost && (
        <div className="flex items-center gap-2 mb-3">
          {Array.from({ length: need }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-2 rounded-full"
              style={{ background: i < submitted ? "var(--primary)" : "var(--bg-2)" }}
            />
          ))}
          <span className="text-[13px] font-extrabold tabular-nums ml-1">
            {submitted}/{need}
          </span>
        </div>
      )}

      {/* 현재 그릇 카드 */}
      <div className="card p-5 pop-in">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-extrabold tracking-widest" style={{ color: "var(--primary-dark)" }}>
            현재 가게
          </span>
          {!isHost && (
            <span className="text-[13px] font-bold" style={{ color: "var(--ink-soft)" }}>
              {submitted}/{need} 입력
            </span>
          )}
        </div>
        <div className="text-[26px] font-extrabold mt-1">{cur}번째 가게</div>

        {mineCur ? (
          <button className="btn btn-ghost w-full mt-4" onClick={() => onOpenBowl(cur)}>
            ✓ 내 평가 수정
          </button>
        ) : mySkippedCur ? (
          <div className="mt-4 text-center">
            <div className="text-[14px] font-bold" style={{ color: "var(--ink-soft)" }}>
              🥵 이 그릇은 패스했어요
            </div>
            <div className="flex gap-2 mt-2">
              <button className="btn btn-line flex-1" onClick={onUnskip}>
                패스 취소
              </button>
              <button className="btn btn-primary flex-1" onClick={() => onOpenBowl(cur)}>
                그래도 평가
              </button>
            </div>
          </div>
        ) : (
          <>
            <button className="btn btn-primary w-full mt-4" onClick={() => onOpenBowl(cur)}>
              이 가게 평가하기
            </button>
            <button className="btn btn-line w-full mt-2" onClick={onSkip}>
              🥵 배불러서 패스
            </button>
          </>
        )}
      </div>

      {/* 호스트 진행 컨트롤 */}
      {isHost && (
        <div className="flex gap-2 mt-3">
          <button className="btn btn-line flex-1" disabled={cur <= 1} onClick={onPrev}>
            ← 이전
          </button>
          <button className="btn btn-primary flex-1" disabled={!gateOpen} onClick={onNext}>
            {gateOpen ? "다음 가게 →" : `대기 ${submitted}/${need}`}
          </button>
        </div>
      )}

      {/* 그릇 칩 (따라잡기) */}
      <h3 className="mt-6 mb-2 text-[14px] font-extrabold" style={{ color: "var(--ink-soft)" }}>
        가게 목록 (눌러서 따라잡기)
      </h3>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: Math.max(tour.max_bowl, cur) }).map((_, i) => {
          const n = i + 1;
          const b = bowls.find((x) => x.n === n);
          const done = !!myRating(n);
          return (
            <button
              key={n}
              className={`chip ${n === cur ? "chip-on" : done ? "chip-done" : ""}`}
              onClick={() => onOpenBowl(n)}
            >
              {b?.shop_name ? bowlLabel(b) : `${n}번째`}
              {done && n !== cur && " ✓"}
            </button>
          );
        })}
      </div>

      {/* 마무리(host) */}
      {isHost && (
        <div className="card p-4 mt-6">
          <div className="text-[14px] font-extrabold mb-2">마무리</div>
          <div className="flex gap-2">
            <button className="btn btn-line flex-1" onClick={onReveal}>
              가게명 공개
            </button>
            <button className="btn btn-primary flex-1" onClick={onFinish}>
              결과 발표 🎉
            </button>
          </div>
          <p className="text-[12px] mt-2" style={{ color: "var(--ink-soft)" }}>
            전원이 입력하지 않아도, 모든 그릇을 채우지 않아도 언제든 눌러 결산을 볼 수 있어요. 순위 탭은 실시간 중간 집계예요.
          </p>
          <CountAdjust need={need} onSetCount={onSetCount} />
        </div>
      )}
    </div>
  );
}

function CountAdjust({ need, onSetCount }: { need: number; onSetCount: (c: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-3 mt-4 pt-4" style={{ borderTop: "1px solid var(--line)" }}>
      <span className="text-[13px] font-bold" style={{ color: "var(--ink-soft)" }}>
        참여 인원
      </span>
      <button className="btn btn-ghost w-9 h-9" onClick={() => onSetCount(Math.max(1, need - 1))}>
        −
      </button>
      <span className="text-[16px] font-extrabold w-8 text-center">{need}</span>
      <button className="btn btn-ghost w-9 h-9" onClick={() => onSetCount(Math.min(8, need + 1))}>
        +
      </button>
    </div>
  );
}

function Onboarding({
  code,
  notFound,
  onJoin,
}: {
  code: string;
  notFound: boolean;
  onJoin: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    const ok = await onJoin(name.trim());
    if (!ok) setBusy(false);
  }
  return (
    <main className="px-5 pt-20">
      <div className="text-center">
        <div className="text-[48px]">🍜</div>
        <h1 className="mt-2 text-[24px] font-extrabold">우동투어 입장</h1>
        <p className="text-[14px] mt-1" style={{ color: "var(--ink-soft)" }}>
          코드 <b>{code}</b>
        </p>
      </div>
      <div className="card p-5 mt-8">
        <label className="label">이름</label>
        <input
          className="field"
          placeholder="이름 (최대 12자)"
          maxLength={12}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {notFound && (
          <p className="mt-2 text-[13px]" style={{ color: "var(--red)" }}>
            투어를 찾을 수 없어요. 코드를 확인해 주세요.
          </p>
        )}
        <button className="btn btn-primary w-full mt-4" disabled={!name.trim() || busy} onClick={submit}>
          입장하기 →
        </button>
      </div>
    </main>
  );
}

function Splash() {
  return (
    <main className="min-h-dvh flex items-center justify-center">
      <div className="text-[40px] animate-pulse">🍜</div>
    </main>
  );
}

function errMsg(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (raw.startsWith("gate")) return "아직 다 입력하지 않았어요.";
  if (raw.includes("not host")) return "호스트만 진행할 수 있어요.";
  return raw;
}
