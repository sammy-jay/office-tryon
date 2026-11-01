"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  BELTS,
  BOTTOMS,
  DAYS,
  JACKETS,
  LOOKS,
  NONE,
  PATHS,
  SHOES,
  TIES,
  TOPS,
  VESTS,
  WATCHES,
  find,
  findOpt,
  type Item,
  type Look,
} from "@/lib/wardrobe";
import type { Outfit, ShoeStyle } from "./Mannequin";
import styles from "./Wardrobe.module.css";

const Mannequin = dynamic(() => import("./Mannequin"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Setting up the fitting room…</div>,
});

type Slot = keyof Look;

interface State extends Look {
  week: number;
  day: number;
  label: string;
}

const initialState: State = { week: 0, day: 0, label: "Week 1 · Monday", ...LOOKS[0][0] };

// Slots you can take off entirely: tapping the worn item again removes it.
const OPTIONAL: Slot[] = ["layer", "vest", "tie"];

const CLOTHES_COUNT = TOPS.length + JACKETS.length + VESTS.length + BOTTOMS.length;
const ACCESSORY_COUNT = SHOES.length + BELTS.length + WATCHES.length + TIES.length;

const VIEWS = [
  { name: "Front", azimuth: 0 },
  { name: "Side", azimuth: Math.PI / 2 },
  { name: "Back", azimuth: Math.PI },
];

const SHOE_STYLES: Record<string, ShoeStyle> = {
  "shoe-black": "formal",
  "shoe-loafer": "loafer",
};

function Shelf({
  title,
  items,
  state,
  columns,
  onPick,
  showNote = true,
  wide = false,
  hint,
}: {
  title: string;
  items: { item: Item; slot: Slot }[];
  state: State;
  columns: number;
  onPick: (slot: Slot, id: string) => void;
  showNote?: boolean;
  wide?: boolean;
  hint?: string;
}) {
  return (
    <section className={styles.shelf}>
      <div className={styles.shelfHead}>
        <h3 className={styles.eyebrow}>{title}</h3>
        <div className={styles.rule} />
        {hint && <span className={styles.shelfHint}>{hint}</span>}
      </div>
      <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map(({ item: it, slot }) => (
          <button key={it.id} type="button" className={styles.tile} aria-pressed={state[slot] === it.id} onClick={() => onPick(slot, it.id)}>
            <svg className={wide ? styles.iconWide : styles.icon} viewBox="0 0 48 48" aria-hidden="true">
              <path
                d={PATHS[it.shape]}
                fill={it.color}
                stroke={it.stroke ?? "rgba(0,0,0,0.28)"}
                strokeWidth={1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className={styles.tileName}>{it.name}</span>
            {showNote && <span className={styles.tileNote}>{it.note ?? ""}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

const inSlot = (list: Item[], slot: Slot) => list.map((item) => ({ item, slot }));

export default function Wardrobe() {
  const [s, setS] = useState<State>(initialState);
  const [view, setView] = useState({ azimuth: 0, key: 0, name: "Front" });
  const [spin, setSpin] = useState(false);

  const applyLook = (w: number, d: number) =>
    setS((prev) => ({ ...prev, ...LOOKS[w][d], week: w, day: d, label: "Week " + (w + 1) + " · " + DAYS[d] }));

  const pickItem = (slot: Slot, id: string) =>
    setS((prev) => ({
      ...prev,
      [slot]: OPTIONAL.includes(slot) && prev[slot] === id ? NONE : id,
      day: -1,
      label: "Custom look",
    }));

  const shuffleLook = () => {
    const r = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const t = r(TOPS);
    let b = r(BOTTOMS);
    while (t.family === "purple" && b.family === "purple") b = r(BOTTOMS);
    const sh = r(SHOES);
    const tone = sh.tone === "any" ? "brown" : sh.tone;
    const shirt = t.kind === "shirt";
    const layer = shirt && Math.random() < 0.3 ? "jacket-cream" : NONE;
    const vest = shirt && Math.random() < 0.3 ? r(VESTS).id : NONE;
    const dressy = layer !== NONE || vest !== NONE;
    const tie = shirt && Math.random() < (dressy ? 0.6 : 0.15) ? r(TIES).id : NONE;
    setS((prev) => ({
      ...prev,
      top: t.id,
      bottom: b.id,
      shoes: sh.id,
      belt: "belt-" + tone,
      watch: "watch-" + tone,
      layer,
      vest,
      tie,
      day: -1,
      label: "Shuffled look",
    }));
  };

  const pickView = (name: string, azimuth: number) => {
    setSpin(false);
    setView((v) => ({ name, azimuth, key: v.key + 1 }));
  };

  const top = find(TOPS, s.top);
  const jacket = findOpt(JACKETS, s.layer);
  const vest = findOpt(VESTS, s.vest);
  const tie = findOpt(TIES, s.tie);
  const bottom = find(BOTTOMS, s.bottom);
  const shoe = find(SHOES, s.shoes);
  const belt = find(BELTS, s.belt);
  const watch = find(WATCHES, s.watch);
  const tucked = top.kind === "shirt";

  const checks: { text: string; ok: boolean }[] = [];
  const add = (ok: boolean, text: string) => checks.push({ ok, text });
  if (top.family === "purple" && bottom.family === "purple") add(false, "Purple shirt + purple trousers clash");
  if (jacket && bottom.suit) add(true, "Full cream suit");
  if (vest && !tucked) add(false, "Waistcoats need a collared shirt");
  if (tie && !tucked) add(false, "Ties need a collared shirt");
  if (vest && tie && tucked) add(true, "Waistcoat and tie: sharp");
  if (tucked) {
    if (shoe.tone === "any") add(true, "Sneakers: either belt works");
    else if (belt.tone === shoe.tone) add(true, "Belt matches shoes");
    else add(false, "Swap to the " + shoe.tone + " belt");
  }
  const ref = tucked ? belt.tone : shoe.tone;
  if (ref !== "any") {
    if (watch.tone === ref) add(true, tucked ? "Watch matches belt" : "Watch matches shoes");
    else add(false, "Try the " + ref + " watch");
  }
  if (jacket && shoe.id === "shoe-black") add(false, "Brown loafers suit the cream jacket better");
  if (!checks.length) add(true, "Good to go");

  const casual = !tucked || shoe.tone === "any";
  const level = casual ? "Friday casual" : jacket || vest || tie ? "Formal" : "Office";

  const outfit: Outfit = {
    topColor: top.color,
    topKind: top.kind as Outfit["topKind"],
    sleeve: top.sleeve ?? "long",
    jacketColor: jacket?.color ?? null,
    vestColor: vest?.color ?? null,
    tieColor: tucked && tie ? tie.color : null,
    bottomColor: bottom.color,
    jeans: bottom.kind === "jeans",
    shoeColor: shoe.color,
    soleColor: shoe.sole ?? shoe.color,
    shoeStyle: SHOE_STYLES[shoe.id] ?? "sneaker",
    beltColor: belt.color,
    watchColor: watch.color,
  };

  const wearing = [
    { name: top.name, color: top.color },
    ...(vest ? [{ name: vest.name, color: vest.color }] : []),
    ...(jacket ? [{ name: jacket.name, color: jacket.color }] : []),
    ...(tie && tucked ? [{ name: tie.name, color: tie.color }] : []),
    { name: bottom.kind === "jeans" ? bottom.name : bottom.name + " trousers", color: bottom.color },
    { name: shoe.name, color: shoe.color },
    ...(tucked && !vest ? [{ name: belt.name, color: belt.color }] : []),
    { name: watch.name, color: watch.color },
  ];

  const modelLabel = "3D model wearing " + wearing.map((w) => w.name.toLowerCase()).join(", ");

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true">
              <path d={PATHS.hanger} fill="none" stroke="#EFEEEA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className={styles.title}>Wardrobe</h1>
            <p className={styles.subtitle}>Try on outfits from your office rotation · {CLOTHES_COUNT + ACCESSORY_COUNT} pieces</p>
          </div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btnGhost} onClick={shuffleLook}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7h4l10 10h4M17 21l4-4-4-4M3 17h4l2.5-2.5M14.5 9.5L17 7h4M17 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Shuffle a look
          </button>
          <button type="button" className={styles.btnSolid} onClick={() => applyLook(0, 0)}>
            Back to today&apos;s look
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <aside aria-label="Clothes rack" className={styles.panel}>
          <div className={styles.rackHead}>
            <h2 className={styles.rackTitle}>Clothes</h2>
            <span className={styles.count}>{CLOTHES_COUNT} pieces</span>
          </div>
          <Shelf title="Tops" items={inSlot(TOPS, "top")} state={s} columns={3} onPick={pickItem} />
          <Shelf
            title="Layers"
            hint="Tap again to remove"
            items={[...inSlot(JACKETS, "layer"), ...inSlot(VESTS, "vest")]}
            state={s}
            columns={3}
            onPick={pickItem}
          />
          <Shelf title="Trousers" items={inSlot(BOTTOMS, "bottom")} state={s} columns={3} onPick={pickItem} />
        </aside>

        <section aria-label="Fitting room" className={`${styles.panel} ${styles.room}`}>
          <div className={styles.roomHead}>
            <div className={styles.roomTitle}>
              <span className={styles.eyebrow}>Fitting room</span>
              <h2 className={styles.label}>{s.label}</h2>
            </div>
            <span className={styles.level}>{level}</span>
          </div>

          <div className={styles.viewer}>
            <div className={styles.canvas} role="img" aria-label={modelLabel}>
              <Mannequin outfit={outfit} view={view} autoRotate={spin} />
            </div>
            <ul className={styles.wearing} aria-hidden="true">
              {wearing.map((w) => (
                <li key={w.name} className={styles.wearItem}>
                  <span className={styles.swatch} style={{ background: w.color }} />
                  {w.name}
                </li>
              ))}
            </ul>
            <span className={styles.hint}>Drag to turn · scroll to zoom</span>
            <div className={styles.viewBar} role="group" aria-label="Camera view">
              {VIEWS.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  className={styles.seg}
                  aria-pressed={!spin && view.name === v.name}
                  onClick={() => pickView(v.name, v.azimuth)}
                >
                  {v.name}
                </button>
              ))}
              <button type="button" className={styles.seg} aria-pressed={spin} onClick={() => setSpin((x) => !x)}>
                <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Spin
              </button>
            </div>
          </div>

          <div className={styles.checks} aria-live="polite">
            {checks.map((c) => (
              <div key={c.text} className={`${styles.check} ${c.ok ? styles.ok : styles.warn}`}>
                <span className={styles.dot} />
                <span>{c.text}</span>
              </div>
            ))}
          </div>

          <div className={styles.rotation}>
            <div className={styles.rotHead}>
              <h3 className={styles.rotTitle}>Office rotation</h3>
              <div role="group" aria-label="Choose week" className={styles.weeks}>
                {LOOKS.map((_, i) => (
                  <button key={i} type="button" className={styles.seg} aria-pressed={s.week === i} onClick={() => setS((prev) => ({ ...prev, week: i }))}>
                    Week {i + 1}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.days}>
              {LOOKS[s.week].map((look, i) => {
                const sel = s.day === i && s.label.indexOf("Week " + (s.week + 1)) === 0;
                const lookTop = find(TOPS, look.top);
                const lookBottom = find(BOTTOMS, look.bottom);
                const lookVest = findOpt(VESTS, look.vest);
                const dots = [lookTop.color, ...(lookVest ? [lookVest.color] : []), lookBottom.color, find(SHOES, look.shoes).color];
                return (
                  <button
                    key={i}
                    type="button"
                    className={styles.day}
                    aria-pressed={sel}
                    aria-label={
                      "Week " + (s.week + 1) + " " + DAYS[i] + ": " + lookTop.name + (lookVest ? ", " + lookVest.name.toLowerCase() : "") + " with " + lookBottom.name.toLowerCase() + " trousers"
                    }
                    onClick={() => applyLook(s.week, i)}
                  >
                    <span className={styles.dayName}>{DAYS[i].slice(0, 3)}</span>
                    <span className={styles.dots}>
                      {dots.map((color, j) => (
                        <span key={j} className={styles.dayDot} style={{ background: color }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <aside aria-label="Shoes and accessories rack" className={styles.panel}>
          <div className={styles.rackHead}>
            <h2 className={styles.rackTitle}>Shoes &amp; accessories</h2>
            <span className={styles.count}>{ACCESSORY_COUNT} pieces</span>
          </div>
          <Shelf title="Shoes" items={inSlot(SHOES, "shoes")} state={s} columns={2} onPick={pickItem} wide />
          <Shelf title="Belts" items={inSlot(BELTS, "belt")} state={s} columns={2} onPick={pickItem} wide showNote={false} />
          <Shelf title="Watches" items={inSlot(WATCHES, "watch")} state={s} columns={2} onPick={pickItem} wide showNote={false} />
          <Shelf title="Ties" hint="Tap again to remove" items={inSlot(TIES, "tie")} state={s} columns={3} onPick={pickItem} showNote={false} />
          <div className={styles.ruleBox}>
            <span className={styles.eyebrow}>The rule</span>
            <p className={styles.ruleText}>
              Black shoes take the black belt and watch. Brown loafers take the brown ones. Sneakers are relaxed about it.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
