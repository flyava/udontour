"use client";

// 도감 공유용 포스터 이미지를 Canvas 로 직접 렌더링한다(외부 의존성 없음).
// 결과는 PNG Blob — Web Share API(파일) 또는 다운로드로 내보낸다.

export type ShareSlot = {
  n: number;
  filled: boolean;
  label: string; // 가게(상호명 또는 'N번째')
  menu: string | null; // 내가 먹은 우동
  score: number | null;
  photo: string | null;
};

export type ShareCardOpts = {
  brand: string; // 헤더 상단(예: "@udon.tour")
  team: string; // 팀/투어 이름(푸터)
  who: string; // "{이름}의 우동 도감"
  slots: ShareSlot[]; // 이 페이지의 슬롯만
  cols: number;
  footer: string; // "2026.06.20 – 06.22 · 18그릇 · 평균 4.10"
  page?: { index: number; count: number }; // 다중 페이지일 때
};

const C = {
  bg: "#fbf6ec",
  bg2: "#f4ead7",
  surface: "#ffffff",
  ink: "#2b2118",
  inkSoft: "#6b5d4f",
  inkFaint: "#a99c8c",
  line: "#ece0cd",
  primary: "#e8822b",
  primaryDark: "#c96612",
  broth: "#f6c453",
};

const FONT = "Pretendard, system-ui, -apple-system, sans-serif";

async function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`900 64px Pretendard`),
      document.fonts.load(`800 44px Pretendard`),
      document.fonts.load(`700 30px Pretendard`),
      document.fonts.load(`800 30px Pretendard`),
    ]);
    await document.fonts.ready;
  } catch {
    /* 폰트 로드 실패 시 시스템 폰트로 진행 */
  }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let done = false;
    const finish = (v: HTMLImageElement | null) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    setTimeout(() => finish(null), 4000); // 빨리 끝내 공유 제스처 만료 방지(실패 사진은 타일 대체)
    img.src = url;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = img.width / img.height;
  const r = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (ir > r) {
    sw = img.height * r;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / r;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

/** 글자 단위로 maxLines 까지 줄바꿈(공백 없는 일본어 상호명도 처리). 넘치면 마지막 줄 말줄임. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of [...text]) {
    if (ctx.measureText(cur + ch).width > maxW && cur) {
      lines.push(cur);
      cur = ch;
      if (lines.length === maxLines) break;
    } else {
      cur += ch;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines) {
    // 마지막 줄에 남은 글자가 더 있으면 말줄임
    const used = lines.join("").length;
    if (used < [...text].length) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = last + "…";
    }
  }
  return lines;
}

function blobOf(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 생성 실패"))), "image/png"),
  );
}

function concatBytes(arrs: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let len = 0;
  for (const a of arrs) len += a.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

let CRC_TABLE: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

/** PNG 여러 장을 무압축(store) ZIP 한 개로 묶는다.
 *  데스크톱은 다중 다운로드를 막으므로 한 번의 다운로드로 안전하게 저장하되,
 *  인스타 공유용 4:5 이미지를 페이지별로 그대로 보존한다(합치지 않음). */
export async function zipImages(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const enc = new TextEncoder();
  const u16 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
  const u32 = (n: number) =>
    new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);

  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = new Uint8Array(await f.blob.arrayBuffer());
    const crc = crc32(data);
    const lfh = concatBytes([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name,
    ]);
    parts.push(lfh, data);
    central.push(
      concatBytes([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
      ]),
    );
    offset += lfh.length + data.length;
  }
  const cd = concatBytes(central);
  const eocd = concatBytes([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(cd.length), u32(offset), u16(0),
  ]);
  const all = concatBytes([...parts, cd, eocd]);
  return new Blob([all], { type: "application/zip" });
}

export async function renderDexCard(opts: ShareCardOpts): Promise<Blob> {
  await ensureFonts();

  // 인스타그램 세로(4:5) 고정 캔버스
  const W = 1200;
  const H = 1500;
  const PAD = 80;
  const GAP = 24;
  const cols = Math.max(1, opts.cols);
  const rows = Math.ceil(opts.slots.length / cols);
  const cell = Math.floor((W - PAD * 2 - GAP * (cols - 1)) / cols);

  const headerBottom = 300;
  const footerTop = H - 150;
  const gridW = cols * cell + (cols - 1) * GAP;
  const gridH = rows * cell + (rows - 1) * GAP;
  const gridX = Math.round((W - gridW) / 2);
  const gridTop = Math.round(headerBottom + Math.max(0, (footerTop - headerBottom - gridH) / 2));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 배경
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#fff3df");
  bg.addColorStop(0.4, C.bg);
  bg.addColorStop(1, C.bg);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 헤더
  ctx.textAlign = "center";
  ctx.fillStyle = C.ink;
  ctx.font = `900 86px ${FONT}`;
  ctx.fillText("🍜", W / 2, 132);
  ctx.fillStyle = C.primaryDark;
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText(opts.brand, W / 2, 186);
  ctx.fillStyle = C.ink;
  ctx.font = `900 56px ${FONT}`;
  ctx.fillText(truncate(ctx, opts.who, W - PAD * 2), W / 2, 244);

  // 페이지 표시(다중 페이지)
  if (opts.page && opts.page.count > 1) {
    const txt = `${opts.page.index} / ${opts.page.count}`;
    ctx.font = `800 26px ${FONT}`;
    const pw = ctx.measureText(txt).width + 36;
    const px = W - PAD - pw;
    roundRect(ctx, px, 48, pw, 46, 23);
    ctx.fillStyle = C.bg2;
    ctx.fill();
    ctx.fillStyle = C.inkSoft;
    ctx.textAlign = "center";
    ctx.fillText(txt, px + pw / 2, 79);
  }

  // 격자
  const photos = await Promise.all(
    opts.slots.map((s) => (s.photo ? loadImage(s.photo) : Promise.resolve(null))),
  );

  opts.slots.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridX + col * (cell + GAP);
    const y = gridTop + row * (cell + GAP);
    const rad = Math.max(16, cell * 0.16);

    ctx.save();
    roundRect(ctx, x, y, cell, cell, rad);
    ctx.clip();

    if (s.filled) {
      const img = photos[i];
      if (img) {
        drawCover(ctx, img, x, y, cell, cell);
      } else {
        // 사진 없는 평가칸: 따뜻한 타일 + 면 이모지
        const g = ctx.createLinearGradient(x, y, x, y + cell);
        g.addColorStop(0, C.broth);
        g.addColorStop(1, C.primary);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, cell, cell);
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.font = `400 ${Math.round(cell * 0.42)}px ${FONT}`;
        ctx.fillText("🍜", x + cell / 2, y + cell * 0.56);
      }
      // 라벨 — 개인 도감: 우동(메뉴) 우선, 가게는 아래 작게. 둥근 모서리 회피 여백
      ctx.textAlign = "left";
      const padX = Math.round(cell * 0.085);
      const padB = Math.round(cell * 0.085);
      const fs = Math.max(20, Math.round(cell * 0.092));
      const shopFs = Math.max(15, Math.round(cell * 0.064));
      ctx.font = `800 ${fs}px ${FONT}`;
      const primaryLines = s.menu
        ? [truncate(ctx, s.menu, cell - padX * 2)]
        : wrapLines(ctx, s.label, cell - padX * 2, 2);
      ctx.font = `700 ${shopFs}px ${FONT}`;
      const shopText = s.menu ? truncate(ctx, "📍 " + s.label, cell - padX * 2) : null;
      const lh = Math.round(fs * 1.2);
      const shopLh = shopText ? Math.round(shopFs * 1.3) : 0;
      const blockH = primaryLines.length * lh + shopLh;
      const gTop = Math.min(y + cell - (blockH + padB + 10), y + cell * 0.45);
      const sh = ctx.createLinearGradient(x, gTop, x, y + cell);
      sh.addColorStop(0, "rgba(0,0,0,0)");
      sh.addColorStop(1, "rgba(20,12,4,0.85)");
      ctx.fillStyle = sh;
      ctx.fillRect(x, gTop, cell, cell);
      let cy = y + cell - padB;
      if (shopText) {
        ctx.font = `700 ${shopFs}px ${FONT}`;
        ctx.fillStyle = "rgba(255,255,255,0.82)";
        ctx.fillText(shopText, x + padX, cy);
        cy -= shopLh;
      }
      ctx.font = `800 ${fs}px ${FONT}`;
      ctx.fillStyle = "#fff";
      primaryLines.forEach((ln, li) => {
        ctx.fillText(ln, x + padX, cy - (primaryLines.length - 1 - li) * lh);
      });
      // 점수 배지
      if (s.score != null) {
        const bw = Math.round(cell * 0.36);
        const bh = Math.round(cell * 0.2);
        roundRect(ctx, x + cell - bw - 12, y + 12, bw, bh, bh / 2);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fill();
        ctx.textAlign = "center";
        ctx.fillStyle = C.primaryDark;
        ctx.font = `800 ${Math.round(bh * 0.62)}px ${FONT}`;
        ctx.fillText(s.score.toFixed(1), x + cell - bw / 2 - 12, y + 12 + bh * 0.72);
      }
    } else {
      // 잠긴 칸
      ctx.fillStyle = C.bg2;
      ctx.fillRect(x, y, cell, cell);
      ctx.textAlign = "center";
      ctx.fillStyle = C.inkFaint;
      ctx.font = `900 ${Math.round(cell * 0.4)}px ${FONT}`;
      ctx.fillText("?", x + cell / 2, y + cell * 0.62);
      ctx.font = `700 ${Math.max(16, Math.round(cell * 0.12))}px ${FONT}`;
      ctx.fillText(`${s.n}번째`, x + cell / 2, y + cell - 18);
    }
    ctx.restore();

    // 테두리
    roundRect(ctx, x + 0.5, y + 0.5, cell - 1, cell - 1, rad);
    ctx.strokeStyle = s.filled ? "rgba(40,26,12,0.10)" : C.line;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // 푸터(하단 고정)
  const fy = H - 92;
  ctx.textAlign = "center";
  ctx.fillStyle = C.inkSoft;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(truncate(ctx, opts.footer, W - PAD * 2), W / 2, fy);
  ctx.fillStyle = C.inkFaint;
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(truncate(ctx, opts.team, W - PAD * 2), W / 2, fy + 44);

  return blobOf(canvas);
}
