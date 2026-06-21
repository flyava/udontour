import type { Bowl, Rating, Participant } from "./types";
import { avgScore, bowlLabel } from "./types";

export type MyBowlScore = {
  n: number;
  label: string;
  score: number;
  revisit: boolean | null;
};

/** 나(한 참여자)가 매긴 점수만으로 낸 우동 순위 (내림차순) */
export function myRanked(
  bowls: Bowl[],
  ratings: Rating[],
  participantId: string,
): MyBowlScore[] {
  const blabel = new Map(bowls.map((b) => [b.n, bowlLabel(b)]));
  return ratings
    .filter((r) => r.participant_id === participantId)
    .map((r) => ({
      n: r.bowl_n,
      label: blabel.get(r.bowl_n) ?? `${r.bowl_n}번째 우동`,
      score: avgScore(r),
      revisit: r.revisit,
    }))
    .sort((a, b) => b.score - a.score || a.n - b.n);
}

export type DexSlot = {
  n: number;
  filled: boolean;
  label: string;
  score: number | null;
  photo: string | null;
  menu: string | null;
  shopRevealed: boolean;
  taste: number;
  noodle: number;
  price: number;
  visual: number;
  condition: number | null;
  revisit: boolean | null;
  note: string | null;
};

/** 도감 격자의 열 수: 그릇 수의 제곱근(정사각형에 가깝게), 모바일 고려 최대 5열 */
export function dexCols(n: number): number {
  return Math.min(5, Math.max(1, Math.ceil(Math.sqrt(n))));
}

/** 1..totalSlots 까지의 내 도감 슬롯. 내가 평가한 그릇은 filled=true */
export function myDex(
  bowls: Bowl[],
  ratings: Rating[],
  participantId: string,
  totalSlots: number,
): DexSlot[] {
  const bowlByN = new Map(bowls.map((b) => [b.n, b]));
  const mine = new Map(
    ratings.filter((r) => r.participant_id === participantId).map((r) => [r.bowl_n, r]),
  );
  const slots: DexSlot[] = [];
  for (let n = 1; n <= totalSlots; n++) {
    const b = bowlByN.get(n);
    const r = mine.get(n);
    slots.push({
      n,
      filled: !!r,
      label: b ? bowlLabel(b) : `${n}번째 우동`,
      score: r ? avgScore(r) : null,
      photo: r?.photo_urls?.[0] ?? null,
      menu: r?.menu ?? b?.menu ?? null,
      shopRevealed: !!b?.shop_name,
      taste: r?.taste ?? 0,
      noodle: r?.noodle ?? 0,
      price: r?.price ?? 0,
      visual: r?.visual ?? 0,
      condition: r?.condition ?? null,
      revisit: r?.revisit ?? null,
      note: r?.note ?? null,
    });
  }
  return slots;
}

export type BowlStat = {
  n: number;
  label: string;
  shopRevealed: boolean;
  votes: number;
  taste: number;
  noodle: number;
  price: number;
  visual: number;
  overall: number;
  condition: number | null;
  revisitRate: number; // 0~1, 응답자 기준
  topNote: { note: string; name: string } | null;
  photo: string | null;
};

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function bowlStats(
  bowls: Bowl[],
  ratings: Rating[],
  participants: Participant[],
): BowlStat[] {
  const pname = new Map(participants.map((p) => [p.id, p.name]));
  return bowls
    .map((b) => {
      const rs = ratings.filter((r) => r.bowl_n === b.n);
      if (rs.length === 0) {
        return {
          n: b.n,
          label: bowlLabel(b),
          shopRevealed: !!b.shop_name,
          votes: 0,
          taste: 0,
          noodle: 0,
          price: 0,
          visual: 0,
          overall: 0,
          condition: null,
          revisitRate: 0,
          topNote: null,
          photo: null,
        } satisfies BowlStat;
      }
      const conds = rs.map((r) => r.condition).filter((c): c is number => c != null);
      const revisits = rs.map((r) => r.revisit).filter((v): v is boolean => v != null);
      const best = [...rs].sort((a, b2) => avgScore(b2) - avgScore(a))[0];
      const photo = rs.flatMap((r) => r.photo_urls)[0] ?? null;
      const noteR = rs.find((r) => r.note && r.id === best.id) ?? rs.find((r) => r.note);
      return {
        n: b.n,
        label: bowlLabel(b),
        shopRevealed: !!b.shop_name,
        votes: rs.length,
        taste: mean(rs.map((r) => r.taste)),
        noodle: mean(rs.map((r) => r.noodle)),
        price: mean(rs.map((r) => r.price)),
        visual: mean(rs.map((r) => r.visual)),
        overall: mean(rs.map((r) => avgScore(r))),
        condition: conds.length ? mean(conds) : null,
        revisitRate: revisits.length ? revisits.filter(Boolean).length / revisits.length : 0,
        topNote: noteR?.note ? { note: noteR.note, name: pname.get(noteR.participant_id) ?? "" } : null,
        photo,
      } satisfies BowlStat;
    })
    .filter((s) => s.votes > 0);
}

export function ranked(stats: BowlStat[]): BowlStat[] {
  return [...stats].sort((a, b) => b.overall - a.overall);
}

export function categoryWinner(
  stats: BowlStat[],
  key: "taste" | "noodle" | "price" | "visual",
): BowlStat | null {
  if (stats.length === 0) return null;
  return [...stats].sort((a, b) => b[key] - a[key])[0];
}

export function revisitWinner(stats: BowlStat[]): BowlStat | null {
  if (stats.length === 0) return null;
  return [...stats].sort((a, b) => b.revisitRate - a.revisitRate)[0];
}
