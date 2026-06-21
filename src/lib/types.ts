export type Tour = {
  id: string;
  code: string;
  team_name: string;
  participant_count: number;
  current_bowl: number;
  max_bowl: number;
  started: boolean;
  finished: boolean;
  trip_start: string | null; // 'YYYY-MM-DD'
  trip_end: string | null;
  created_at: string;
};

export type Participant = {
  id: string;
  tour_id: string;
  auth_uid: string;
  name: string;
  is_host: boolean;
  created_at: string;
};

export type Bowl = {
  id: string;
  tour_id: string;
  n: number;
  menu: string | null;
  shop_name: string | null;
  map_url: string | null;
};

export type Rating = {
  id: string;
  tour_id: string;
  participant_id: string;
  bowl_n: number;
  taste: number;
  noodle: number;
  price: number;
  visual: number;
  condition: number | null;
  revisit: boolean | null;
  menu: string | null;
  note: string | null;
  photo_urls: string[];
  photo_kinds: string[]; // photo_urls[i] 의 분류(PhotoKind). 옛 데이터는 비어있을 수 있음
  created_at: string;
  updated_at: string;
};

export const MAX_PHOTOS = 5;

export type PhotoKind = "sign" | "menu" | "udon";

export const PHOTO_KINDS: { key: PhotoKind; label: string; emoji: string; hint?: string }[] = [
  { key: "sign", label: "가게 외관·간판", emoji: "🏠" },
  { key: "menu", label: "메뉴판", emoji: "📋" },
  { key: "udon", label: "우동", emoji: "🍜", hint: "도감에 모여요" },
];

/** photo_urls + photo_kinds 를 {url, kind} 쌍으로 묶는다. */
export function zipPhotos(
  r: Pick<Rating, "photo_urls" | "photo_kinds">,
): { url: string; kind: PhotoKind }[] {
  return r.photo_urls.map((url, i) => ({
    url,
    kind: (r.photo_kinds?.[i] as PhotoKind) ?? "udon",
  }));
}

/** '우동'으로 태그된 사진 URL만(도감용). */
export function udonPhotos(r: Pick<Rating, "photo_urls" | "photo_kinds">): string[] {
  return zipPhotos(r)
    .filter((p) => p.kind === "udon")
    .map((p) => p.url);
}

export type Skip = {
  id: string;
  tour_id: string;
  participant_id: string;
  bowl_n: number;
  created_at: string;
};

export const AXES = [
  { key: "taste", label: "맛" },
  { key: "noodle", label: "면발" },
  { key: "price", label: "가성비" },
  { key: "visual", label: "비주얼" },
] as const;

export type AxisKey = (typeof AXES)[number]["key"];

export function bowlLabel(b: Pick<Bowl, "n" | "shop_name">): string {
  return b.shop_name ?? `${b.n}번째 우동`;
}

export function avgScore(r: Pick<Rating, "taste" | "noodle" | "price" | "visual">): number {
  return (r.taste + r.noodle + r.price + r.visual) / 4;
}
