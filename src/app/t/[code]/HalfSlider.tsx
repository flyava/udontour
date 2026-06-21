"use client";

export function HalfSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number; // 1.0 ~ 5.0, 0.5 단위. 0이면 미입력.
  onChange: (v: number) => void;
}) {
  const set = value > 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[15px] font-extrabold">{label}</span>
        <span
          className="text-[15px] font-extrabold tabular-nums"
          style={{ color: set ? "var(--primary-dark)" : "var(--ink-faint)" }}
        >
          {set ? value.toFixed(1) : "—"}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={0.5}
        value={set ? value : 1}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="udon-range"
        style={{ opacity: set ? 1 : 0.5 }}
      />
      <style jsx>{`
        .udon-range {
          width: 100%;
          height: 28px;
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          margin: 2px 0;
        }
        .udon-range::-webkit-slider-runnable-track {
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(
            to right,
            var(--primary) 0%,
            var(--primary) ${((value || 1) - 1) / 4 * 100}%,
            var(--bg-2) ${((value || 1) - 1) / 4 * 100}%,
            var(--bg-2) 100%
          );
        }
        .udon-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 26px;
          height: 26px;
          margin-top: -8px;
          border-radius: 50%;
          background: #fff;
          border: 3px solid var(--primary);
          box-shadow: 0 2px 6px rgba(120, 70, 20, 0.3);
        }
        .udon-range::-moz-range-track {
          height: 10px;
          border-radius: 999px;
          background: var(--bg-2);
        }
        .udon-range::-moz-range-progress {
          height: 10px;
          border-radius: 999px;
          background: var(--primary);
        }
        .udon-range::-moz-range-thumb {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #fff;
          border: 3px solid var(--primary);
        }
      `}</style>
    </div>
  );
}
