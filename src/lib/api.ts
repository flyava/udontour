"use client";

import { getSupabase, ensureAnonSession } from "./supabase";
import type { Tour, Participant, Rating } from "./types";

export async function createTour(team: string, count: number): Promise<Tour> {
  await ensureAnonSession();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("create_tour", {
    p_team: team,
    p_count: count,
  });
  if (error) throw error;
  return data as Tour;
}

export async function joinTour(code: string, name: string): Promise<Participant> {
  await ensureAnonSession();
  const sb = getSupabase();
  const { data, error } = await sb.rpc("join_tour", {
    p_code: code.toUpperCase(),
    p_name: name,
  });
  if (error) throw error;
  return data as Participant;
}

/** 현재 기기가 이 코드의 투어에 이미 참여 중이면 멤버십 반환, 아니면 null */
export async function resolveMembership(
  code: string,
): Promise<{ tour: Tour; me: Participant } | null> {
  await ensureAnonSession();
  const sb = getSupabase();
  const { data: tour } = await sb
    .from("tours")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (!tour) return null; // 미가입(또는 미존재) — RLS상 안 보임
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data: me } = await sb
    .from("participants")
    .select("*")
    .eq("tour_id", tour.id)
    .eq("auth_uid", user!.id)
    .maybeSingle();
  if (!me) return null;
  return { tour: tour as Tour, me: me as Participant };
}

export async function setName(tourId: string, name: string) {
  const sb = getSupabase();
  const { error } = await sb.rpc("set_name", { p_tour: tourId, p_name: name });
  if (error) throw error;
}

export async function setCount(tourId: string, count: number) {
  const sb = getSupabase();
  const { error } = await sb.rpc("set_count", { p_tour: tourId, p_count: count });
  if (error) throw error;
}

export async function setMenu(tourId: string, n: number, menu: string) {
  const sb = getSupabase();
  const { error } = await sb.rpc("set_menu", { p_tour: tourId, p_n: n, p_menu: menu });
  if (error) throw error;
}

export async function setShop(tourId: string, n: number, shop: string, mapUrl = "") {
  const sb = getSupabase();
  const { error } = await sb.rpc("set_shop", {
    p_tour: tourId,
    p_n: n,
    p_shop: shop,
    p_map: mapUrl,
  });
  if (error) throw error;
}

export async function startTour(tourId: string) {
  const sb = getSupabase();
  const { error } = await sb.rpc("start_tour", { p_tour: tourId });
  if (error) throw error;
}

export async function advanceBowl(tourId: string): Promise<number> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("advance_bowl", { p_tour: tourId });
  if (error) throw error;
  return data as number;
}

export async function prevBowl(tourId: string): Promise<number> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("prev_bowl", { p_tour: tourId });
  if (error) throw error;
  return data as number;
}

export async function finishTour(tourId: string, finished = true) {
  const sb = getSupabase();
  const { error } = await sb.rpc("finish_tour", {
    p_tour: tourId,
    p_finished: finished,
  });
  if (error) throw error;
}

export type RatingInput = {
  taste: number;
  noodle: number;
  price: number;
  visual: number;
  condition: number | null;
  revisit: boolean | null;
  menu: string | null;
  note: string | null;
  photo_urls: string[];
  photo_kinds: string[];
};

export async function upsertRating(
  tourId: string,
  participantId: string,
  bowlN: number,
  input: RatingInput,
): Promise<Rating> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("ratings")
    .upsert(
      {
        tour_id: tourId,
        participant_id: participantId,
        bowl_n: bowlN,
        ...input,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "participant_id,bowl_n" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as Rating;
}

/** 클라이언트 다운스케일(최대 900px, JPEG q0.6) 후 Storage 업로드 → public URL */
export async function uploadPhoto(
  tourId: string,
  bowlN: number,
  participantId: string,
  kind: string,
  idx: number,
  file: File,
): Promise<string> {
  const blob = await downscale(file, 900, 0.6);
  const sb = getSupabase();
  const path = `tour_${tourId}/bowl_${bowlN}/${participantId}_${kind}_${idx}.jpg`;
  const { error } = await sb.storage
    .from("bowl-photos")
    .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;
  const { data } = sb.storage.from("bowl-photos").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

async function downscale(file: File, max: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))),
      "image/jpeg",
      quality,
    ),
  );
}
