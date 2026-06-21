"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTour } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [team, setTeam] = useState("");
  const [count, setCount] = useState(3);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onCreate() {
    if (!team.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const tour = await createTour(team.trim(), count);
      router.push(`/t/${tour.code}`);
    } catch (e) {
      setErr(msg(e));
      setBusy(false);
    }
  }

  function onJoin() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    router.push(`/t/${c.startsWith("UDON-") ? c : `UDON-${c}`}`);
  }

  return (
    <main className="px-5 pt-14 pb-10">
      <div className="text-center rise">
        <div className="text-[56px] leading-none">🍜</div>
        <h1 className="mt-3 text-[28px] font-extrabold tracking-tight">모리 우동투어</h1>
        <p className="mt-2 text-[15px]" style={{ color: "var(--ink-soft)" }}>
          블라인드로 그릇을 평가하고, 끝나고 우승 우동을 공개해요.
        </p>
      </div>

      <section className="card mt-8 p-5 pop-in">
        <h2 className="text-[17px] font-extrabold">투어 시작하기</h2>
        <p className="text-[13px] mt-1" style={{ color: "var(--ink-soft)" }}>
          호스트로 새 투어를 만들고 링크를 공유하세요.
        </p>

        <label className="label mt-4">팀 이름</label>
        <input
          className="field"
          placeholder="예: 우동원정대"
          maxLength={20}
          value={team}
          onChange={(e) => setTeam(e.target.value)}
        />

        <label className="label mt-4">참여 인원</label>
        <div className="flex items-center gap-3">
          <button
            className="btn btn-ghost w-12 h-12 text-xl"
            onClick={() => setCount((c) => Math.max(1, c - 1))}
          >
            −
          </button>
          <div className="flex-1 text-center text-[22px] font-extrabold">{count}명</div>
          <button
            className="btn btn-ghost w-12 h-12 text-xl"
            onClick={() => setCount((c) => Math.min(8, c + 1))}
          >
            +
          </button>
        </div>

        <button
          className="btn btn-primary w-full mt-5"
          disabled={!team.trim() || busy}
          onClick={onCreate}
        >
          {busy ? "만드는 중…" : "투어 만들기 →"}
        </button>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-[17px] font-extrabold">코드로 입장</h2>
        <div className="flex gap-2 mt-3">
          <input
            className="field tracking-widest"
            placeholder="UDON-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && onJoin()}
          />
          <button className="btn btn-line px-5" disabled={!code.trim()} onClick={onJoin}>
            입장
          </button>
        </div>
      </section>

      {err && (
        <p className="mt-4 text-center text-[14px]" style={{ color: "var(--red)" }}>
          {err}
        </p>
      )}
    </main>
  );
}

function msg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: string }).message);
  return "오류가 발생했어요.";
}
