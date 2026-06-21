"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "./supabase";
import type { Tour, Participant, Bowl, Rating } from "./types";

export type TourState = {
  tour: Tour | null;
  participants: Participant[];
  bowls: Bowl[];
  ratings: Rating[];
};

/** tourId가 정해지면 모든 데이터를 로드하고 Realtime으로 구독한다. */
export function useTourData(tourId: string | null) {
  const [state, setState] = useState<TourState>({
    tour: null,
    participants: [],
    bowls: [],
    ratings: [],
  });
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (!tourId) return;
    const sb = getSupabase();
    const [t, p, b, r] = await Promise.all([
      sb.from("tours").select("*").eq("id", tourId).single(),
      sb.from("participants").select("*").eq("tour_id", tourId).order("created_at"),
      sb.from("bowls").select("*").eq("tour_id", tourId).order("n"),
      sb.from("ratings").select("*").eq("tour_id", tourId),
    ]);
    setState({
      tour: (t.data as Tour) ?? null,
      participants: (p.data as Participant[]) ?? [],
      bowls: (b.data as Bowl[]) ?? [],
      ratings: (r.data as Rating[]) ?? [],
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
      .subscribe();

    return () => {
      active = false;
      sb.removeChannel(ch);
    };
  }, [tourId, reload]);

  return { ...state, ready, reload };
}

/** 현재 그릇을 평가한 distinct 참여자 수 */
export function bowlSubmitCount(ratings: Rating[], bowlN: number): number {
  const set = new Set(ratings.filter((r) => r.bowl_n === bowlN).map((r) => r.participant_id));
  return set.size;
}
