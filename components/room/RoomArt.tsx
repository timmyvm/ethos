import type { CSSProperties, ReactNode } from "react";

/**
 * PLACEHOLDER for the room's art (#475). Flat rectangles in the layers
 * the real scene has, honouring every prop, so the flow
 * (components/room/Room.tsx) can be built and photographed. The drawn
 * high-rise office (Kurzgesagt-spirited, our own) replaces this file
 * whole at merge; nothing outside it depends on what is inside it.
 *
 * The seam, which both sides build to exactly:
 *  - It fills its parent (absolute, inset 0) and draws no text and no
 *    controls of its own.
 *  - `tilt` (-1 to 1 each way, smoothed by the flow every frame) moves
 *    each layer by tilt times its depth, the opposite way to the tilt:
 *    8 px sky, 16 far towers, 26 near towers, 34 the interviewer and his
 *    chair, 48 the desk, 64 the pen, plus up to 1.5 degrees of roll on
 *    the foreground. Every layer is drawn oversize, so no edge shows.
 *    Transform only. Under `reduceMotion` every offset is 0.
 *  - `who` is who is speaking: his mouth moves while it is "interviewer".
 *  - `mood` is his pose.
 *  - `bubble` is drawn by the flow and placed here, in his own layer,
 *    just beside his head with its tail toward his mouth, so it moves
 *    with him.
 */
export type RoomArtProps = {
  tilt: { x: number; y: number };
  who: "interviewer" | "you" | null;
  mood: "idle" | "listening" | "unimpressed" | "verdict";
  reduceMotion: boolean;
  bubble?: ReactNode;
};

/** px at full tilt, far to near. */
const DEPTH = { sky: 8, far: 16, near: 26, him: 34, desk: 48, pen: 64 } as const;

function layer(depth: number, tilt: { x: number; y: number }, still: boolean, roll = 0): CSSProperties {
  const x = still ? 0 : -tilt.x * depth;
  const y = still ? 0 : -tilt.y * depth;
  const r = still ? 0 : tilt.x * roll;
  return {
    position: "absolute",
    inset: -depth - 8,
    transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${r.toFixed(3)}deg)`,
    willChange: "transform",
  };
}

export default function RoomArt({ tilt, who, mood, reduceMotion, bubble }: RoomArtProps) {
  const still = reduceMotion;
  const lean = mood === "unimpressed" ? -4 : mood === "verdict" ? 3 : mood === "listening" ? -1 : 0;
  return (
    <div
      data-room-art="placeholder"
      data-mood={mood}
      data-who={who ?? "none"}
      style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#2a2b57" }}
    >
      {/* The sky at dusk. */}
      <div style={layer(DEPTH.sky, tilt, still)}>
        <div style={{ position: "absolute", inset: 0, background: "#3b3f86" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: "34%", height: "22%", background: "#e0806d" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: "48%", height: "14%", background: "#f2b36b" }} />
      </div>
      {/* The far towers. */}
      <div style={layer(DEPTH.far, tilt, still)}>
        {[8, 21, 33, 52, 66, 80].map((l, i) => (
          <div
            key={l}
            style={{ position: "absolute", left: `${l}%`, width: "11%", bottom: "38%", height: `${18 + (i % 3) * 7}%`, background: "#5c5aa0" }}
          />
        ))}
      </div>
      {/* The near towers. */}
      <div style={layer(DEPTH.near, tilt, still)}>
        {[2, 27, 61, 86].map((l, i) => (
          <div
            key={l}
            style={{ position: "absolute", left: `${l}%`, width: "16%", bottom: "36%", height: `${26 + (i % 2) * 10}%`, background: "#3c3a78" }}
          />
        ))}
        {/* The glass: floor to ceiling, two mullions. */}
        <div style={{ position: "absolute", left: "33%", width: "1.2%", top: 0, bottom: "34%", background: "#25264d" }} />
        <div style={{ position: "absolute", left: "67%", width: "1.2%", top: 0, bottom: "34%", background: "#25264d" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "36%", background: "#2c2d58" }} />
      </div>
      {/* The interviewer and his chair, and the bubble in his layer. */}
      <div style={layer(DEPTH.him, tilt, still)}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "30%",
            width: 0,
            height: 0,
            transform: `rotate(${lean}deg)`,
            transformOrigin: "50% 100%",
          }}
        >
          <div style={{ position: "absolute", left: -78, bottom: -10, width: 156, height: 200, borderRadius: 28, background: "#1d1e3a" }} />
          <div style={{ position: "absolute", left: -58, bottom: 0, width: 116, height: 150, borderRadius: "40px 40px 6px 6px", background: "#262a4f" }} />
          <div style={{ position: "absolute", left: -10, bottom: 92, width: 20, height: 58, background: "#f0f0f6" }} />
          <div style={{ position: "absolute", left: -6, bottom: 96, width: 12, height: 48, background: "#c4413e" }} />
          <div style={{ position: "absolute", left: -32, bottom: 150, width: 64, height: 72, borderRadius: 30, background: "#d99a74" }} />
          <div style={{ position: "absolute", left: -34, bottom: 198, width: 68, height: 26, borderRadius: "30px 30px 8px 8px", background: "#2a1c18" }} />
          <div
            className={who === "interviewer" && !still ? "room-ph-mouth" : undefined}
            style={{ position: "absolute", left: -10, bottom: 166, width: 20, height: who === "interviewer" ? 7 : 3, borderRadius: 4, background: "#5a2a24" }}
          />
        </div>
        {bubble && (
          /* Just above his head, its tail down to his mouth; in his layer
             but not in his lean, so it never tilts. */
          <div
            data-room-bubble-anchor=""
            style={{ position: "absolute", left: "calc(50% - 6px)", bottom: "calc(30% + 232px)", width: 0, height: 0 }}
          >
            <div style={{ position: "absolute", left: 0, bottom: 0 }}>{bubble}</div>
          </div>
        )}
      </div>
      {/* The desk, his feet on it. */}
      <div style={layer(DEPTH.desk, tilt, still)}>
        <div style={{ position: "absolute", left: "-4%", right: "-4%", bottom: 0, height: "34%", background: "#7a4c3e" }} />
        <div style={{ position: "absolute", left: "-4%", right: "-4%", bottom: "32%", height: "3%", background: "#9a6452" }} />
        <div style={{ position: "absolute", left: "54%", bottom: "33%", width: 74, height: 22, borderRadius: 11, background: "#14152a" }} />
        <div style={{ position: "absolute", left: "36%", bottom: "33%", width: 70, height: 22, borderRadius: 11, background: "#14152a" }} />
      </div>
      {/* The pen, nearest of all. */}
      <div style={layer(DEPTH.pen, tilt, still, 1.5)}>
        <div style={{ position: "absolute", left: "30%", bottom: "14%", width: "46%", height: 14, borderRadius: 7, background: "#f2c14e", transform: "rotate(-9deg)" }} />
      </div>
    </div>
  );
}
