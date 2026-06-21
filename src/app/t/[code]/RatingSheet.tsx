"use client";

import { useEffect, useState } from "react";
import type { Bowl, Rating, PhotoKind } from "@/lib/types";
import { MAX_PHOTOS, PHOTO_KINDS } from "@/lib/types";
import { upsertRating, uploadPhoto, type RatingInput } from "@/lib/api";
import { HalfSlider } from "./HalfSlider";

export function RatingSheet({
  tourId,
  participantId,
  bowl,
  existing,
  onClose,
  onSaved,
}: {
  tourId: string;
  participantId: string;
  bowl: Bowl;
  existing: Rating | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [taste, setTaste] = useState(existing?.taste ?? 0);
  const [noodle, setNoodle] = useState(existing?.noodle ?? 0);
  const [price, setPrice] = useState(existing?.price ?? 0);
  const [visual, setVisual] = useState(existing?.visual ?? 0);
  const [condition, setCondition] = useState<number | null>(existing?.condition ?? null);
  const [revisit, setRevisit] = useState<boolean | null>(existing?.revisit ?? null);
  const [menu, setMenu] = useState(existing?.menu ?? bowl.menu ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [photos, setPhotos] = useState<{ url: string; kind: PhotoKind }[]>(
    (existing?.photo_urls ?? []).map((url, i) => ({
      url,
      kind: (existing?.photo_kinds?.[i] as PhotoKind) ?? "udon",
    })),
  );
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  // 호스트 announce 메뉴가 바뀌고 내가 아직 안 건드렸으면 프리필
  useEffect(() => {
    if (!existing && !menu && bowl.menu) setMenu(bowl.menu);
  }, [bowl.menu, existing, menu]);

  const allAxes = taste > 0 && noodle > 0 && price > 0 && visual > 0;

  async function onPick(files: FileList | null, kind: PhotoKind) {
    if (!files || files.length === 0) return;
    const room = Math.min(MAX_PHOTOS - photos.length, files.length);
    if (room <= 0) {
      setWarn(`사진은 최대 ${MAX_PHOTOS}장까지예요.`);
      return;
    }
    setWarn(null);
    for (let i = 0; i < room; i++) {
      try {
        const url = await uploadPhoto(tourId, bowl.n, participantId, kind, photos.length + i, files[i]);
        setPhotos((p) => [...p, { url, kind }]);
      } catch {
        setWarn("사진 업로드에 실패했어요. 점수는 저장돼요.");
      }
    }
  }

  async function save() {
    if (!allAxes) return;
    setBusy(true);
    const input: RatingInput = {
      taste,
      noodle,
      price,
      visual,
      condition,
      revisit,
      menu: menu.trim() || null,
      note: note.trim() || null,
      photo_urls: photos.map((p) => p.url),
      photo_kinds: photos.map((p) => p.kind),
    };
    try {
      await upsertRating(tourId, participantId, bowl.n, input);
      onSaved();
      onClose();
    } catch (e) {
      setWarn(e instanceof Error ? e.message : "저장 실패");
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="flex items-center justify-between py-2">
          <h2 className="text-[19px] font-extrabold">{bowl.n}번째 우동</h2>
          <button className="text-[14px] font-bold" style={{ color: "var(--ink-faint)" }} onClick={onClose}>
            닫기
          </button>
        </div>

        <label className="label mt-1">메뉴 (한글)</label>
        <input
          className="field"
          placeholder="예: 가마타마 우동"
          maxLength={24}
          value={menu}
          onChange={(e) => setMenu(e.target.value)}
        />

        <div className="card p-4 mt-4 flex flex-col gap-4">
          <HalfSlider label="맛" value={taste} onChange={setTaste} />
          <HalfSlider label="면발" value={noodle} onChange={setNoodle} />
          <HalfSlider label="가성비" value={price} onChange={setPrice} />
          <HalfSlider label="비주얼" value={visual} onChange={setVisual} />
        </div>

        <label className="label mt-5">컨디션 (피로도)</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`chip flex-1 justify-center ${condition === n ? "chip-on" : ""}`}
              onClick={() => setCondition(condition === n ? null : n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[11px] mt-1" style={{ color: "var(--ink-faint)" }}>
          <span>쌩쌩</span>
          <span>한계</span>
        </div>

        <label className="label mt-5">또 갈래요?</label>
        <div className="flex gap-2">
          <button
            className={`chip flex-1 justify-center ${revisit === true ? "chip-on" : ""}`}
            onClick={() => setRevisit(revisit === true ? null : true)}
          >
            다시 간다
          </button>
          <button
            className={`chip flex-1 justify-center ${revisit === false ? "chip-on" : ""}`}
            onClick={() => setRevisit(revisit === false ? null : false)}
          >
            한 번이면 충분
          </button>
        </div>

        <div className="flex items-baseline justify-between mt-5">
          <label className="label mb-0">사진 (최대 {MAX_PHOTOS}장)</label>
          <span className="text-[12px] font-bold tabular-nums" style={{ color: "var(--ink-faint)" }}>
            {photos.length}/{MAX_PHOTOS}
          </span>
        </div>
        <p className="text-[12px] mb-2" style={{ color: "var(--ink-faint)" }}>
          간판·메뉴·우동을 남겨보세요. 우동 사진은 도감에 모여요.
        </p>
        <div className="flex flex-col gap-3">
          {PHOTO_KINDS.map((k) => {
            const mine = photos.filter((p) => p.kind === k.key);
            return (
              <div key={k.key}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[13px] font-bold" style={{ color: "var(--ink-soft)" }}>
                    {k.emoji} {k.label}
                  </span>
                  {k.hint && (
                    <span
                      className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: "var(--primary-soft)", color: "var(--primary-dark)" }}
                    >
                      {k.hint}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {mine.map((p) => (
                    <div key={p.url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className="w-20 h-20 rounded-xl object-cover" />
                      <button
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/70 text-white text-xs"
                        onClick={() => setPhotos((ps) => ps.filter((x) => x.url !== p.url))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <label
                      className="w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center text-2xl cursor-pointer"
                      style={{ borderColor: "var(--line)", color: "var(--ink-faint)" }}
                    >
                      +
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onPick(e.target.files, k.key)}
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <label className="label mt-5">한줄평 / 별명</label>
        <input
          className="field"
          placeholder="예: 면발이 살아있다"
          maxLength={60}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {warn && (
          <p className="mt-3 text-[13px]" style={{ color: "var(--red)" }}>
            {warn}
          </p>
        )}

        <button className="btn btn-primary w-full mt-6" disabled={!allAxes || busy} onClick={save}>
          {busy ? "저장 중…" : allAxes ? "저장하기" : "4가지 점수를 모두 입력하세요"}
        </button>
      </div>
    </div>
  );
}
