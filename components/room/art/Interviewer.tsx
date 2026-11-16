import type { CSSProperties } from "react";
import { VIEW_BOX } from "./geometry";
import s from "./room.module.css";

/*
 * The interviewer: slick, bored, in charge. A navy suit, a red tie,
 * slicked-back hair, leaning back in a big chair with one hand behind his
 * head, the other drumming on the desk, and his shoes up on the desk,
 * soles toward you. His character is the silhouette: the raised elbow,
 * the soles, the chair a head taller than him. Moods change the pose and
 * the face; the parts glide between them (head tilt, brows, lids,
 * sitting up) or fade (arms, feet, mouth).
 *
 * He is drawn centred on x = 400 and stands at x = 320 on the stage
 * (OFFSET_X), left of centre, so the space right of his head is open for
 * what he says.
 */

export type Mood = "idle" | "listening" | "unimpressed" | "verdict";

export const OFFSET_X = -80;

const C = {
  suit: "#2f3b72",
  suitShade: "#232c5a",
  suitDeep: "#1c2349",
  suitLight: "#3a4886",
  shirt: "#f3efe7",
  tie: "#e4485d",
  tieShade: "#bf3550",
  skin: "#f2b48a",
  skinShade: "#d58c66",
  skinDeep: "#c27a58",
  hair: "#1b1626",
  hairShine: "#3f3558",
  mouth: "#7a2a3a",
  mouthIn: "#4f1726",
  chair: "#17142b",
  chairPanel: "#221d3d",
  rim: "#ffa184",
  gold: "#f2b544",
  shoe: "#14111d",
  sole: "#a9714b",
  soleShade: "#7e4f35",
  soleWorn: "#c28a60",
  heel: "#382827",
  shadow: "#08061a",
} as const;

type Pose = {
  body: string;
  head: string;
  browL: string;
  browR: string;
  eyes: string;
  lid: number;
  arms: "lean" | "crossed" | "door";
  feet: boolean;
  mouth: "smug" | "smirk" | "frown" | "flat";
};

const POSES: Record<Mood, Pose> = {
  idle: {
    body: "translate(0px, 0px) scale(1)",
    head: "rotate(5deg)",
    browL: "translate(0px, 3px) rotate(0deg)",
    browR: "translate(0px, 3px) rotate(0deg)",
    eyes: "translate(-6px, 2px)",
    lid: 0.5,
    arms: "lean",
    feet: true,
    mouth: "smug",
  },
  listening: {
    body: "translate(0px, 0px) scale(1)",
    head: "rotate(-8deg)",
    browL: "translate(0px, 4px) rotate(5deg)",
    browR: "translate(0px, -14px) rotate(-9deg)",
    eyes: "translate(0px, 0px)",
    lid: 0.12,
    arms: "lean",
    feet: true,
    mouth: "smirk",
  },
  unimpressed: {
    body: "translate(0px, 0px) scale(1)",
    head: "rotate(0deg)",
    browL: "translate(3px, 6px) rotate(14deg)",
    browR: "translate(-3px, 6px) rotate(-14deg)",
    eyes: "translate(0px, 2px)",
    lid: 0.36,
    arms: "crossed",
    feet: true,
    mouth: "frown",
  },
  verdict: {
    body: "translate(0px, -22px) scale(1.03)",
    head: "rotate(0deg)",
    browL: "translate(2px, 5px) rotate(9deg)",
    browR: "translate(-2px, 5px) rotate(-9deg)",
    eyes: "translate(0px, 0px)",
    lid: 0.24,
    arms: "door",
    feet: false,
    mouth: "flat",
  },
};

/*
 * The crown of his head per pose, in his own drawing (before OFFSET_X):
 * the hair's top at (404, 392) carried through the pose's head tilt about
 * (400, 640) and, for the verdict, the body's lift about (400, 1000).
 */
const CROWN: Record<Mood, { x: number; y: number }> = {
  idle: { x: 426, y: 393 },
  listening: { x: 370, y: 394 },
  unimpressed: { x: 404, y: 392 },
  verdict: { x: 404, y: 352 },
};

/**
 * Where the bubble's bottom-left corner sits, as stage fractions, per
 * pose: just over his head, 55 units left of its crown, so the tail (26px
 * in from that corner) points down at him and the bubble has the sky
 * over his chair to grow into, wide enough for two lines rather than
 * five (#475 integration: beside his head it had about 180px at 390
 * wide and 140 at 320).
 */
export const BUBBLE_AT: Record<Mood, { x: number; y: number }> = Object.fromEntries(
  (Object.keys(CROWN) as Mood[]).map((m) => [m, { x: (CROWN[m].x + OFFSET_X - 55) / 900, y: (CROWN[m].y - 22) / 1600 }])
) as Record<Mood, { x: number; y: number }>;

const box: CSSProperties = { transformBox: "fill-box", transformOrigin: "center" };

function cls(...names: Array<string | false | undefined>) {
  return names.filter(Boolean).join(" ");
}

const SLEEVE = {
  fill: "none",
  stroke: C.suit,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/* ---------------------------------------------------------------- arms */

function ArmsLean() {
  return (
    <>
      {/* his right hand behind his head: the raised elbow */}
      <path d="M300 470L352 462" {...SLEEVE} stroke={C.suitShade} strokeWidth="64" />
      <path d="M272 698L238 512L300 476" {...SLEEVE} strokeWidth="72" />
      <path d="M300 706C290 690 284 676 282 660L304 662Z" fill={C.suitDeep} />
      {/* his left arm down beside him; the forearm comes onto the desk */}
      <path d="M530 700L588 892L572 1060" {...SLEEVE} strokeWidth="68" />
    </>
  );
}

function ArmsCrossed() {
  return (
    <>
      <path d="M268 702L252 840" {...SLEEVE} strokeWidth="70" />
      {/* the lower forearm, its hand tucked under the far arm */}
      <path d="M252 844L520 806" {...SLEEVE} stroke={C.suitShade} strokeWidth="60" />
      <path d="M532 702L548 840" {...SLEEVE} strokeWidth="70" />
      {/* the upper forearm, its hand gripping the near arm */}
      <path d="M548 844L318 796" {...SLEEVE} stroke={C.suitLight} strokeWidth="60" />
      <path d="M546 860L330 816" {...SLEEVE} stroke={C.suit} strokeWidth="22" />
      <rect x="300" y="768" width="14" height="50" rx="6" fill={C.shirt} transform="rotate(12 307 793)" />
      <path d="M302 772C282 766 260 774 258 792C256 812 276 822 298 818Z" fill={C.skin} />
      <path d="M266 786h22v6h-22zM264 800h24v6h-24z" fill={C.skinShade} />
    </>
  );
}

function ArmsDoor() {
  return (
    <>
      {/* his right arm down to the desk; the forearm is on the front layer */}
      <path d="M268 702L222 892L246 1040" {...SLEEVE} strokeWidth="68" />
      {/* his left arm out to the side, palm open: the door is that way */}
      <path d="M532 702L632 852L714 784" {...SLEEVE} strokeWidth="66" />
      <g transform="translate(726 776) rotate(-28)">
        <rect x="-16" y="-24" width="16" height="48" rx="6" fill={C.shirt} />
        <rect x="-4" y="-21" width="10" height="42" rx="4" fill={C.gold} />
        <path d="M-2 -18H36C44 -18 46 -16 52 -14H74C82 -14 82 -2 74 -2H46V6H66C74 6 74 18 66 18H-2Z" fill={C.skin} />
        <path d="M12 -18C8 -34 14 -46 24 -44C30 -40 28 -28 24 -18Z" fill={C.skin} />
        <path d="M30 -2h18v4h-18z" fill={C.skinShade} />
      </g>
    </>
  );
}

/* -------------------------------------------------------------- mouths */

const MOUTH: Record<Pose["mouth"], string> = {
  smug: "M382 580Q399 588 419 572",
  smirk: "M384 582Q402 584 419 574",
  frown: "M383 586Q400 574 417 586",
  flat: "M385 581L415 581",
};

/* ---------------------------------------------------------- the person */

export function Interviewer({ mood, talking }: { mood: Mood; talking: boolean }) {
  const p = POSES[mood];
  return (
    <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <g transform={`translate(${OFFSET_X} 0)`}>
        {/* the chair, a head taller than him */}
        <path d="M232 1080V436C232 382 266 348 320 348H480C534 348 568 382 568 436V1080Z" fill={C.chair} />
        <path d="M258 1080V448C258 400 288 374 330 374H470C512 374 542 400 542 448V1080Z" fill={C.chairPanel} />
        <path d="M498 352C540 360 568 392 568 436V1080H562V440C560 398 536 366 498 352Z" fill={C.rim} opacity="0.22" />

        <g className={s.move} style={{ transform: p.body, transformOrigin: "400px 1000px" }}>
          <g className={s.breathe} style={{ transformOrigin: "400px 1000px" }}>
            {/* jacket */}
            <path d="M252 704C254 660 280 642 314 640H486C520 642 546 660 548 704L538 800C530 850 524 880 526 920L532 1100H268L274 920C276 880 270 850 262 800Z" fill={C.suit} />
            <path d="M470 640H486C520 642 546 660 548 704L538 800C530 850 524 880 526 920L532 1100H500C496 960 492 820 470 640Z" fill={C.suitShade} />
            <path d="M314 640H486C510 641 530 650 540 666C520 656 500 652 486 652H314C300 652 280 656 260 666C270 650 290 641 314 640Z" fill={C.suitLight} />
            {/* shirt and tie */}
            <path d="M362 630H438L400 838Z" fill={C.shirt} />
            <path d="M386 640H414L409 664H391Z" fill={C.tieShade} />
            <path d="M391 664H409L420 806L400 830L380 806Z" fill={C.tie} />
            <path d="M400 664H409L420 806L400 830Z" fill={C.tieShade} opacity="0.55" />
            {/* peak lapels */}
            <path d="M362 630L400 838L388 840L334 716L302 704L318 668L344 642Z" fill={C.suitShade} />
            <path d="M438 630L400 838L412 840L466 716L498 704L482 668L456 642Z" fill={C.suitShade} />
            {/* pocket square, buttons */}
            <path d="M460 752L470 738L478 750L486 734L496 752Z" fill={C.shirt} />
            <circle cx="400" cy="880" r="6" fill={C.suitDeep} />
            <circle cx="400" cy="940" r="6" fill={C.suitDeep} />
            {/* neck and collar */}
            <path d="M372 584H428V652H372Z" fill={C.skinShade} />
            <path d="M362 628L398 650L384 676L352 644Z" fill="#ffffff" />
            <path d="M438 628L402 650L416 676L448 644Z" fill="#ffffff" />

            {/* arms, by pose */}
            <g className={cls(s.part, p.arms !== "lean" && s.off)}>
              <ArmsLean />
            </g>
            <g className={cls(s.part, p.arms !== "crossed" && s.off)}>
              <ArmsCrossed />
            </g>
            <g className={cls(s.part, p.arms !== "door" && s.off)}>
              <ArmsDoor />
            </g>

            {/* the head */}
            <g className={s.move} style={{ transform: p.head, transformOrigin: "400px 640px" }}>
              <ellipse cx="326" cy="532" rx="17" ry="26" fill={C.skinShade} />
              <ellipse cx="474" cy="532" rx="17" ry="26" fill={C.skinShade} />
              <ellipse cx="329" cy="534" rx="7" ry="14" fill={C.skinDeep} />
              <ellipse cx="471" cy="534" rx="7" ry="14" fill={C.skinDeep} />
              <path d="M330 482C330 436 358 416 400 416C442 416 470 436 470 482V546C470 580 456 602 428 612C418 616 410 617 400 617C390 617 382 616 372 612C344 602 330 580 330 546Z" fill={C.skin} />
              <path d="M334 560C340 588 352 604 372 612C382 616 390 617 400 617C410 617 418 616 428 612C448 604 460 588 466 560C452 586 430 600 400 600C370 600 348 586 334 560Z" fill={C.skinShade} opacity="0.5" />
              <path d="M462 452C468 464 470 472 470 482V540C470 572 462 594 444 606C458 584 462 560 462 528Z" fill={C.rim} opacity="0.35" />
              {/* slicked back, a hard part on his right */}
              <path d="M326 502C316 440 344 396 404 392C462 392 488 432 476 502C474 478 468 458 454 448C432 440 410 438 386 440C360 444 338 462 326 502Z" fill={C.hair} />
              <path d="M374 441C368 428 370 412 382 400L388 402C378 414 378 428 382 440Z" fill={C.hairShine} />
              <path d="M398 404C426 398 452 406 468 424C448 414 424 410 400 414Z" fill={C.hairShine} />
              {/* brows */}
              <rect x="340" y="482" width="46" height="12" rx="6" fill={C.hair} className={s.move} style={{ ...box, transform: p.browL }} />
              <rect x="414" y="482" width="46" height="12" rx="6" fill={C.hair} className={s.move} style={{ ...box, transform: p.browR }} />
              {/* eyes, then lids over them */}
              <g className={s.move} style={{ transform: p.eyes }}>
                <g className={s.blink}>
                  <ellipse cx="366" cy="518" rx="9.5" ry="11.5" fill={C.hair} />
                  <ellipse cx="434" cy="518" rx="9.5" ry="11.5" fill={C.hair} />
                </g>
                <circle cx="369" cy="513" r="2.6" fill="#ffffff" />
                <circle cx="437" cy="513" r="2.6" fill="#ffffff" />
              </g>
              <rect x="348" y="502" width="38" height="28" fill={C.skin} className={s.move} style={{ transformBox: "fill-box", transformOrigin: "center top", transform: `scaleY(${p.lid})` }} />
              <rect x="414" y="502" width="38" height="28" fill={C.skin} className={s.move} style={{ transformBox: "fill-box", transformOrigin: "center top", transform: `scaleY(${p.lid})` }} />
              {/* nose */}
              <path d="M401 522C398 536 391 547 392 553C395 559 407 559 411 553C411 546 405 535 401 522Z" fill={C.skinShade} opacity="0.8" />
              {/* mouth: the pose's at rest, two frames while he talks */}
              <g className={talking ? s.talking : undefined}>
                <g className={s.mouthRest}>
                  {(Object.keys(MOUTH) as Array<Pose["mouth"]>).map((m) => (
                    <path
                      key={m}
                      d={MOUTH[m]}
                      className={cls(s.part, p.mouth !== m && s.off)}
                      fill="none"
                      stroke={C.mouth}
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                  ))}
                </g>
                <ellipse className={s.mouthA} cx="400" cy="582" rx="12" ry="7" fill={C.mouthIn} />
                <g className={s.mouthB}>
                  <path d="M384 574Q400 569 416 574Q419 598 400 600Q381 598 384 574Z" fill={C.mouthIn} />
                  <path d="M386 575Q400 571 414 575V580H386Z" fill="#ffffff" />
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

/* ------------------------------------------- what of him is on the desk */

function Sole({ x, y, turn, tap }: { x: number; y: number; turn: number; tap?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn})`}>
      <g className={tap ? s.tap : undefined} style={{ transformOrigin: "0px 0px" }}>
        <ellipse cx="0" cy="4" rx="40" ry="8" fill={C.shadow} opacity="0.5" />
        {/* the shoe, seen past its sole */}
        <path d="M-34 -58C-40 -98 -43 -138 -42 -156C-40 -194 -20 -207 0 -207C20 -207 40 -194 42 -156C43 -138 40 -98 34 -58L32 0H-32Z" fill={C.shoe} />
        {/* the sole: forefoot, waist, heel */}
        <path d="M-26 -66C-40 -98 -44 -136 -42 -154C-40 -186 -22 -198 0 -198C22 -198 40 -186 42 -154C44 -136 40 -98 26 -66Z" fill={C.sole} />
        <path d="M26 -66C40 -98 44 -136 42 -154C40 -186 22 -198 0 -198C16 -192 30 -178 32 -152C34 -130 30 -100 18 -68Z" fill={C.soleShade} />
        <ellipse cx="-4" cy="-152" rx="20" ry="26" fill={C.soleWorn} opacity="0.6" />
        <path d="M-22 -70H22L20 -58H-20Z" fill={C.soleShade} />
        <rect x="-30" y="-56" width="60" height="58" rx="12" fill={C.heel} />
        <rect x="-22" y="-46" width="44" height="8" rx="4" fill="#4e3936" />
      </g>
    </g>
  );
}

/* The drumming fingers: four tips that lift in turn while he waits. */
function DeskHand() {
  return (
    <g>
      <path d="M572 1006L600 1050" fill="none" stroke={C.suit} strokeWidth="58" strokeLinecap="round" />
      <path d="M584 1030L612 1056L640 1040L612 1020Z" fill={C.shadow} opacity="0.3" />
      <rect x="578" y="1052" width="50" height="14" rx="6" fill={C.shirt} transform="rotate(-8 603 1059)" />
      <rect x="582" y="1060" width="44" height="9" rx="4" fill={C.gold} transform="rotate(-8 604 1064)" />
      <path d="M582 1066C580 1080 588 1094 606 1096C626 1098 640 1088 640 1072C640 1062 632 1058 618 1058C602 1058 588 1060 582 1066Z" fill={C.skin} />
      <g fill={C.skin}>
        <rect className={s.drum} style={{ animationDelay: "0ms" }} x="586" y="1084" width="11" height="20" rx="5.5" />
        <rect className={s.drum} style={{ animationDelay: "90ms" }} x="599" y="1088" width="11" height="21" rx="5.5" />
        <rect className={s.drum} style={{ animationDelay: "180ms" }} x="612" y="1088" width="11" height="20" rx="5.5" />
        <rect className={s.drum} style={{ animationDelay: "270ms" }} x="625" y="1084" width="10" height="17" rx="5" />
      </g>
      <path d="M580 1068C570 1072 566 1082 572 1088C578 1092 586 1086 588 1078Z" fill={C.skinShade} />
    </g>
  );
}

export function Front({ mood }: { mood: Mood }) {
  const p = POSES[mood];
  return (
    <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <g transform={`translate(${OFFSET_X} 0)`}>
        <g className={cls(s.drop, !p.feet && s.off)} style={{ transform: p.feet ? "translateY(0px)" : "translateY(-40px)" }}>
          {/* long shadows, away from the sun on the right */}
          <path d="M272 1102L322 1104L190 1330L100 1324Z" fill={C.shadow} opacity="0.3" />
          <path d="M332 1090L384 1092L272 1318L180 1314Z" fill={C.shadow} opacity="0.3" />
          {/* his legs, out over the desk from behind its far edge */}
          <path d="M384 966H458L334 1090L272 1078Z" fill={C.suitShade} />
          <path d="M436 966H506L390 1080L330 1068Z" fill={C.suit} />
          <Sole x={294} y={1104} turn={-16} />
          <Sole x={360} y={1092} turn={4} tap />
        </g>
        <g className={cls(s.part, p.arms !== "lean" && s.off)}>
          <DeskHand />
        </g>
        <g className={cls(s.part, p.arms !== "door" && s.off)}>
          {/* the verdict: his forearm comes down on the desk */}
          <path d="M276 1066L356 1080L340 1096L270 1088Z" fill={C.shadow} opacity="0.35" />
          <path d="M250 996L262 1030L332 1058" fill="none" stroke={C.suit} strokeWidth="60" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="326" y="1036" width="16" height="44" rx="6" fill={C.shirt} transform="rotate(-68 334 1058)" />
          <path d="M340 1046C362 1040 380 1048 382 1062C384 1076 368 1084 344 1078Z" fill={C.skin} />
          <path d="M360 1056h16v5h-16zM360 1067h18v5h-18z" fill={C.skinShade} />
        </g>
      </g>
    </svg>
  );
}
