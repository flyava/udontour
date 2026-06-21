export type Tour = {
  id: string;
  code: string;
  team_name: string;
  participant_count: number;
  current_bowl: number;
  max_bowl: number;
  started: boolean;
  finished: boolean;
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
  created_at: string;
  updated_at: string;
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
