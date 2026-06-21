"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "./supabase";
import type { Tour, Participant, Bowl, Rating, Skip } from "./types";

export type TourState = {
  tour: Tour | null;
  participants: Participant[];
  bowls: Bowl[];
  ratings: Rating[];
  skips: Skip[];
};

/** tourId가 정해지면 모든 데이터를 로드하고 Realtime으로 구독한다. */
export function useTourData(tourId: string | null) {
  const [state, setState] = useState<TourState>({
    tour: null,
    participants: [],
    bowls: [],
    ratings: [],
    skips: [],
  });
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (!tourId) return;
    const sb = getSupabase();
    const [t, p, b, r, s] = await Promise.all([
      sb.from("tours").select("*").eq("id", tourId).single(),
      sb.from("participants").select("*").eq("tour_id", tourId).order("created_at"),
      sb.from("bowls").select("*").eq("tour_id", tourId).order("n"),
      sb.from("ratings").select("*").eq("tour_id", tourId),
      sb.from("skips").select("*").eq("tour_id", tourId),
    ]);
    setState({
      tour: (t.data as Tour) ?? null,
      participants: (p.data as Participant[]) ?? [],
      bowls: (b.data as Bowl[]) ?? [],
      ratings: (r.data as Rating[]) ?? [],
      skips: (s.data as Skip[]) ?? [], // 마이그레이션 0006 전이면 null → []
    });
    setReady(true);
  }, [tourId]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    if (!tourId) return;
    let active = true;
    reload();

    const sb = getSupabase();
    const ch = sb
      .channel(`tour:${tourId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tours", filter: `id=eq.${tourId}` },
        () => active && reloadRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `tour_id=eq.${tourId}` },
        () => active && reloadRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bowls", filter: `tour_id=eq.${tourId}` },
        () => active && reloadRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ratings", filter: `tour_id=eq.${tourId}` },
        () => active && reloadRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "skips", filter: `tour_id=eq.${tourId}` },
        () => active && reloadRef.current(),
      )
      .subscribe();

    return () => {
      active = false;
      sb.removeChannel(ch);
    };
  }, [tourId, reload]);

  return { ...state, ready, reload };
}

/** 현재 그릇을 평가했거나 패스한 distinct 참여자 수(게이트 기준) */
export function bowlSubmitCount(ratings: Rating[], skips: Skip[], bowlN: number): number {
  const set = new Set<string>();
  for (const r of ratings) if (r.bowl_n === bowlN) set.add(r.participant_id);
  for (const s of skips) if (s.bowl_n === bowlN) set.add(s.participant_id);
  return set.size;
}
