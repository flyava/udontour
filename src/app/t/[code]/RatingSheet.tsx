"use client";

import { useEffect, useState } from "react";
import type { Bowl, Rating } from "@/lib/types";
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
  const [photos, setPhotos] = useState<string[]>(existing?.photo_urls ?? []);
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  // 호스트 announce 메뉴가 바뀌고 내가 아직 안 건드렸으면 프리필
  useEffect(() => {
    if (!existing && !menu && bowl.menu) setMenu(bowl.menu);
  }, [bowl.menu, existing, menu]);

  const allAxes = taste > 0 && noodle > 0 && price > 0 && visual > 0;

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    const slots = Math.min(2 - photos.length, files.length);
    setWarn(null);
    for (let i = 0; i < slots; i++) {
      try {
        const url = await uploadPhoto(tourId, bowl.n, participantId, photos.length + i, files[i]);
        setPhotos((p) => [...p, url]);
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
      photo_urls: photos,
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

        <label className="label mt-5">사진 (최대 2장)</label>
        <div className="flex gap-2">
          {photos.map((u, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="w-20 h-20 rounded-xl object-cover" />
              <button
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/70 text-white text-xs"
                onClick={() => setPhotos((p) => p.filter((_, k) => k !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          {photos.length < 2 && (
            <label className="w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center text-2xl cursor-pointer"
              style={{ borderColor: "var(--line)", color: "var(--ink-faint)" }}>
              +
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPick(e.target.files)}
              />
            </label>
          )}
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
