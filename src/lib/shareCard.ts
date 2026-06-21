"use client";

// 도감 공유용 포스터 이미지를 Canvas 로 직접 렌더링한다(외부 의존성 없음).
// 결과는 PNG Blob — Web Share API(파일) 또는 다운로드로 내보낸다.

export type ShareSlot = {
  n: number;
  filled: boolean;
  label: string;
  score: number | null;
  photo: string | null;
};

export type ShareCardOpts = {
  team: string; // 팀/투어 이름
  who: string; // "{이름}의 우동 도감"
  slots: ShareSlot[];
  cols: number;
  footer: string; // "2026.06.21 · 12그릇 · 평균 4.21"
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
    setTimeout(() => finish(null), 8000);
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

function blobOf(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 생성 실패"))), "image/png"),
  );
}

export async function renderDexCard(opts: ShareCardOpts): Promise<Blob> {
  await ensureFonts();

  const W = 1080;
  const PAD = 64;
  const GAP = 22;
  const cols = Math.max(1, opts.cols);
  const rows = Math.ceil(opts.slots.length / cols);
  const cell = Math.floor((W - PAD * 2 - GAP * (cols - 1)) / cols);

  const headerH = 300;
  const gridH = rows * cell + (rows - 1) * GAP;
  const footerH = 150;
  const H = headerH + gridH + footerH;

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
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText("모리 우동투어", W / 2, 186);
  ctx.fillStyle = C.ink;
  ctx.font = `900 56px ${FONT}`;
  ctx.fillText(truncate(ctx, opts.who, W - PAD * 2), W / 2, 244);

  // 격자
  const photos = await Promise.all(
    opts.slots.map((s) => (s.photo ? loadImage(s.photo) : Promise.resolve(null))),
  );

  opts.slots.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PAD + col * (cell + GAP);
    const y = headerH + row * (cell + GAP);
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
      // 하단 그라데이션 + 라벨
      const sh = ctx.createLinearGradient(x, y + cell * 0.45, x, y + cell);
      sh.addColorStop(0, "rgba(0,0,0,0)");
      sh.addColorStop(1, "rgba(20,12,4,0.78)");
      ctx.fillStyle = sh;
      ctx.fillRect(x, y + cell * 0.45, cell, cell * 0.55);
      ctx.textAlign = "left";
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${Math.max(20, Math.round(cell * 0.13))}px ${FONT}`;
      ctx.fillText(
        truncate(ctx, s.label, cell - 24),
        x + 14,
        y + cell - 20,
      );
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

  // 푸터
  const fy = headerH + gridH + 64;
  ctx.textAlign = "center";
  ctx.fillStyle = C.inkSoft;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(truncate(ctx, opts.footer, W - PAD * 2), W / 2, fy);
  ctx.fillStyle = C.inkFaint;
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText(truncate(ctx, opts.team, W - PAD * 2), W / 2, fy + 44);

  return blobOf(canvas);
}
