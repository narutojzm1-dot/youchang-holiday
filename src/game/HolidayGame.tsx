import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  createWorld,
  DAY_SECONDS,
  feedGrain,
  feedHay,
  feedHim,
  loadWorld,
  posture,
  saveWorld,
  seasonLabel,
  sit,
  step,
  walkTo,
  type FaceId,
  type ScrapId,
  type Seat,
  type World,
} from "./sim";
import { createYardAudio, type YardAudio } from "./audio";

export function HolidayGame() {
  const worldRef = useRef<World>(createWorld());
  const audioRef = useRef<YardAudio | null>(null);
  const [, setFrame] = useState(0);
  const [menu, setMenu] = useState<"none" | "sit" | "feed" | "walk">("none");
  const [page, setPage] = useState(0);

  useEffect(() => {
    loadWorld(worldRef.current);
    const audio = createYardAudio();
    audioRef.current = audio;
    let last = performance.now();
    let acc = 0;
    let raf = 0;
    let lastWeather = worldRef.current.weather;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      const world = worldRef.current;
      while (acc >= 1 / 20) {
        const before = world.goose;
        step(world, 1 / 20);
        if (before === "pond" && world.goose !== "pond") audio.honk();
        acc -= 1 / 20;
      }
      if (world.weather !== lastWeather) {
        audio.setWeather(world.weather);
        lastWeather = world.weather;
      }
      setFrame((n) => (n + 1) % 100000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onVis = () => {
      if (document.visibilityState === "visible") audio.unlock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      audio.stop();
    };
  }, []);

  const world = worldRef.current;
  const night = world.phase === "night";
  const label = seasonLabel(world.day);

  function bump() {
    saveWorld(worldRef.current);
    setMenu("none");
    setFrame((n) => n + 1);
  }

  function begin() {
    audioRef.current?.unlock();
    worldRef.current.started = true;
    audioRef.current?.setWeather(worldRef.current.weather);
    bump();
  }

  function openBook() {
    audioRef.current?.paper();
    worldRef.current.bookOpen = true;
    worldRef.current.freshPage = false;
    setPage(Math.max(0, worldRef.current.journal.length - 1));
    bump();
  }

  function closeBook() {
    worldRef.current.bookOpen = false;
    bump();
  }

  return (
    <main className="mx-auto flex h-dvh max-w-5xl flex-col bg-night text-paper">
      <header className="flex items-end justify-between px-4 pt-4 pb-2">
        <div>
          <p className="font-serif text-lg tracking-wide text-hay">悠长的假期</p>
          <p className="text-sm text-muted">{world.started ? label : "阿尔卑斯，独一户"}</p>
        </div>
        {world.started && world.weather === "fog" ? <p className="text-sm text-pond">雾</p> : null}
        {world.started && world.weather === "rain" ? (
          <p className="text-sm text-pond">{world.season === "winter" ? "雪" : "雨"}</p>
        ) : null}
      </header>

      <div className="relative mx-3 min-h-0 flex-1 overflow-hidden rounded-2xl">
        <Yard world={world} />
        {world.phase === "day" ? (
          <div
            className="pointer-events-none absolute inset-0 bg-night"
            style={{ opacity: Math.max(0, (world.elapsed / DAY_SECONDS - 0.72) / 0.28) * 0.65 }}
          />
        ) : null}
        {world.weather === "fog" && !night ? <div className="pointer-events-none absolute inset-0 bg-wool/35" /> : null}
        {(world.weather === "rain" || (world.season === "winter" && world.weather === "cloud")) && !night ? (
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-40" viewBox="0 0 100 64" aria-hidden>
            {Array.from({ length: 18 }, (_, i) => (
              <line
                key={i}
                x1={6 + (i * 13) % 96}
                y1={(i * 7) % 50}
                x2={4 + (i * 13) % 96}
                y2={8 + (i * 7) % 50}
                stroke="var(--color-wool)"
                strokeWidth="0.4"
              />
            ))}
          </svg>
        ) : null}
      </div>

      <section className="px-3 pt-3 pb-4">
        {!world.started ? (
          <div className="rounded-2xl bg-paper px-4 py-4 text-paper-ink">
            <p className="font-serif text-xl">高压停了。</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              没有目标。喂、溜、坐着。脸是它们自己的事，空页不会告诉你。
            </p>
            <button
              type="button"
              className="mt-4 min-h-11 w-full rounded-xl bg-clay px-4 text-paper"
              onClick={begin}
            >
              {world.day > 0 ? "回到院子" : "走进院子"}
            </button>
          </div>
        ) : night ? (
          <button
            type="button"
            className="min-h-11 w-full rounded-xl bg-paper px-4 text-paper-ink"
            onClick={openBook}
          >
            {world.freshPage ? "本子里多了一页" : "夜里的本子"}
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Verb label="坐着" onClick={() => setMenu(menu === "sit" ? "none" : "sit")} />
            <Verb label="喂" onClick={() => setMenu(menu === "feed" ? "none" : "feed")} />
            <Verb label="溜" onClick={() => setMenu(menu === "walk" ? "none" : "walk")} />
          </div>
        )}
        {menu === "sit" ? (
          <ChoiceRow>
            <Choice label="塘边" onClick={() => { sit(world, "pond"); bump(); }} />
            <Choice label="门口" onClick={() => { sit(world, "door"); bump(); }} />
            <Choice label="草坡" onClick={() => { sit(world, "slope"); bump(); }} />
          </ChoiceRow>
        ) : null}
        {menu === "feed" ? (
          <ChoiceRow>
            <Choice label="干草" onClick={() => { audioRef.current?.hay(); feedHay(world); bump(); }} />
            <Choice label="谷子" onClick={() => { feedGrain(world); bump(); }} />
            <Choice label="给他" onClick={() => { audioRef.current?.hay(); feedHim(world); bump(); }} />
          </ChoiceRow>
        ) : null}
        {menu === "walk" ? (
          <ChoiceRow>
            <Choice label="松在院子" onClick={() => { walkTo(world, "yard"); bump(); }} />
            <Choice label="松在草坡" onClick={() => { walkTo(world, "watch"); bump(); }} />
            <Choice label="松到塘边" onClick={() => { walkTo(world, "path"); bump(); }} />
          </ChoiceRow>
        ) : null}
      </section>

      {world.bookOpen ? (
        <Book
          journal={world.journal}
          scraps={world.scraps}
          page={page}
          onPage={setPage}
          onClose={closeBook}
        />
      ) : null}
    </main>
  );
}

function Verb({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="min-h-11 rounded-xl bg-sage-deep text-paper" onClick={onClick}>
      {label}
    </button>
  );
}

function ChoiceRow({ children }: { children: ReactNode }) {
  return <div className="mt-2 grid grid-cols-3 gap-2">{children}</div>;
}

function Choice({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="min-h-11 rounded-xl bg-paper text-sm text-paper-ink" onClick={onClick}>
      {label}
    </button>
  );
}

function Book({
  journal,
  scraps,
  page,
  onPage,
  onClose,
}: {
  journal: FaceId[];
  scraps: ScrapId[];
  page: number;
  onPage: (n: number) => void;
  onClose: () => void;
}) {
  const total = journal.length + 1;
  const blank = page >= journal.length;
  const face = blank ? null : journal[page];
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-night/80 p-4">
      <div className="flex w-full max-w-3xl flex-col gap-3">
        <div className="grid min-h-80 grid-cols-2 overflow-hidden rounded-2xl bg-paper text-paper-ink shadow-2xl">
          <div className="border-r border-hay/40" />
          <div className="flex items-center justify-center p-4">
            {face ? <FaceCard id={face} /> : <p className="text-sm text-muted">后面还是空白</p>}
          </div>
        </div>
        {scraps.length > 0 && page === journal.length ? (
          <div className="flex gap-2 overflow-x-auto">
            {scraps.map((scrap, i) => (
              <div key={`${scrap}-${i}`} className="shrink-0 rounded-xl bg-paper p-2">
                <ScrapCard id={scrap} />
              </div>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            className="min-h-11 rounded-xl bg-sage-deep text-paper disabled:opacity-40"
            disabled={page <= 0}
            onClick={() => onPage(page - 1)}
          >
            上一页
          </button>
          <button type="button" className="min-h-11 rounded-xl bg-paper text-paper-ink" onClick={onClose}>
            合上
          </button>
          <button
            type="button"
            className="min-h-11 rounded-xl bg-sage-deep text-paper disabled:opacity-40"
            disabled={page >= total - 1 && scraps.length === 0}
            onClick={() => onPage(Math.min(total - 1, page + 1))}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}

function Yard({ world }: { world: World }) {
  const face = posture(world);
  const sky =
    world.phase === "night"
      ? "bg-night"
      : world.weather === "sun"
        ? "bg-hay"
        : world.weather === "rain"
          ? "bg-shirt"
          : "bg-pond";
  return (
    <div className={`absolute inset-0 ${sky}`}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 64" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <filter id="wool">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.2" />
        </filter>
        <path d="M0 28 L18 18 L34 26 L52 14 L70 24 L88 16 L100 26 V64 H0 Z" fill="var(--color-sage-deep)" opacity="0.85" />
        <path d="M0 36 C20 30 30 40 50 34 C70 28 80 38 100 32 V64 H0 Z" fill="var(--color-sage)" />
        <ellipse cx="30" cy="46" rx="14" ry="6" fill="var(--color-pond)" />
        <rect x="68" y="24" width="18" height="14" rx="1" fill="var(--color-wool)" />
        <path d="M66 24 L77 14 L90 24 Z" fill="var(--color-clay)" />
        <rect x="74" y="30" width="4" height="8" fill="var(--color-ink)" />
        {world.season !== "winter" ? (
          <g fill="var(--color-clay)">
            <circle cx="18" cy="40" r="1.1" />
            <circle cx="24" cy="50" r="1.1" />
            <circle cx="58" cy="48" r="1" />
            <circle cx="14" cy="52" r="0.9" />
          </g>
        ) : (
          <g fill="var(--color-wool)" opacity="0.85">
            <ellipse cx="50" cy="48" rx="50" ry="6" />
            <circle cx="20" cy="40" r="2" />
            <circle cx="60" cy="36" r="1.6" />
          </g>
        )}
        {world.season !== "winter" ? (
          <g>
            <rect x="12" y="34" width="1.4" height="10" fill="var(--color-ink)" />
            <circle cx="12.7" cy="32" r="5" fill="var(--color-sage-deep)" />
          </g>
        ) : null}
        <g stroke="var(--color-ink)" strokeWidth="0.6" fill="var(--color-ink)">
          <line x1="76" y1="42" x2="96" y2="42" />
          <line x1="76" y1="46" x2="96" y2="46" />
          <rect x="76" y="40" width="1.2" height="8" />
          <rect x="86" y="40" width="1.2" height="8" />
          <rect x="95" y="40" width="1.2" height="8" />
        </g>
      </svg>
      <Actor spot={world.cow} label="牛">
        <Cow />
      </Actor>
      <Actor spot={world.follow} label="后看的羊">
        <Sheep head="down" />
      </Actor>
      <Actor spot={world.lead} label="先走的羊">
        <Sheep head="up" />
      </Actor>
      <Actor spot={gooseSpot(world)} label="鹅">
        <Goose />
      </Actor>
      <Actor spot={world.alpaca} label="草泥马">
        <Alpaca face={face} />
      </Actor>
      <Actor spot={seatSpot(world.seat)} label="你">
        <Person />
      </Actor>
      <Ducks />
    </div>
  );
}

function gooseSpot(world: World): string {
  if (world.goose === "face") return world.alpaca;
  if (world.goose === "player") return "pondSeat";
  if (world.goose === "path") return "path";
  return "pond";
}

function seatSpot(seat: Seat): string {
  if (seat === "pond") return "pondSeat";
  if (seat === "slope") return "slopeSeat";
  return "doorSeat";
}

const POS: Record<string, [number, number]> = {
  yard: [48, 52],
  door: [70, 46],
  path: [40, 58],
  watch: [46, 40],
  shade: [22, 46],
  hay: [60, 56],
  pen: [84, 50],
  pond: [32, 60],
  pondSeat: [16, 70],
  doorSeat: [62, 62],
  slopeSeat: [34, 30],
};

function Actor({
  spot,
  label,
  children,
}: {
  spot: string;
  label: string;
  children: ReactNode;
}) {
  const base: [number, number] = POS[spot] ?? [50, 50];
  const nudged: [number, number] =
    label === "鹅" && spot !== "pond" ? [base[0] - 7, base[1] + 3] : label === "后看的羊" ? [base[0] + 7, base[1] + 2] : base;
  return (
    <div
      className="absolute transition-all duration-700 ease-out motion-reduce:transition-none"
      style={{ left: `${nudged[0]}%`, top: `${nudged[1]}%`, transform: "translate(-50%, -70%)" }}
      aria-label={label}
    >
      {children}
    </div>
  );
}

function Alpaca({ face }: { face: FaceId }) {
  const ears = face === "happy" ? -20 : face === "annoyed" || face === "spit" ? 28 : face === "tease" ? -8 : 8;
  const mouth = face === "happy" ? "M18 28 Q24 31 30 28" : face === "spit" ? "M20 30 Q24 27 28 30" : face === "tease" ? "M18 29 Q26 27 32 30" : face === "annoyed" ? "M18 30 Q24 28 30 31" : "M18 29 H30";
  return (
    <svg width="72" height="88" viewBox="0 0 48 60" aria-hidden>
      <filter id="felt-alpaca">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" />
        <feDisplacementMap in="SourceGraphic" scale="1.6" />
      </filter>
      <g filter="url(#felt-alpaca)">
      <ellipse cx="24" cy="46" rx="14" ry="12" fill="var(--color-wool)" />
      <rect x="20" y="28" width="8" height="14" rx="3" fill="var(--color-wool)" />
      <ellipse cx="24" cy="24" rx="12" ry="10" fill="var(--color-wool)" />
      <g style={{ transformOrigin: "16px 16px", transform: `rotate(${ears}deg)` }}>
        <ellipse cx="14" cy="14" rx="3" ry="7" fill="var(--color-wool)" />
        <ellipse cx="14" cy="15" rx="1.4" ry="4" fill="var(--color-clay)" opacity="0.45" />
      </g>
      <g style={{ transformOrigin: "32px 16px", transform: `rotate(${face === "tease" ? 16 : -ears}deg)` }}>
        <ellipse cx="34" cy="14" rx="3" ry="7" fill="var(--color-wool)" />
        <ellipse cx="34" cy="15" rx="1.4" ry="4" fill="var(--color-clay)" opacity="0.45" />
      </g>
      {face === "spit" ? (
        <g fill="var(--color-wool)">
          <ellipse cx="16" cy="28" rx="5" ry="4" />
          <ellipse cx="32" cy="28" rx="5" ry="4" />
        </g>
      ) : null}
      <path d={mouth} fill="none" stroke="var(--color-ink)" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="19" cy="24" r={face === "annoyed" ? 1.1 : 1.4} fill="var(--color-ink)" />
      <circle cx="29" cy="24" r={face === "happy" ? 1.3 : 1.4} fill="var(--color-ink)" />
      </g>
    </svg>
  );
}

function Sheep({ head }: { head: "up" | "down" }) {
  return (
    <svg width="58" height="48" viewBox="0 0 40 32" aria-hidden>
      <ellipse cx="22" cy="20" rx="12" ry="8" fill="var(--color-wool)" />
      <circle cx={head === "up" ? 10 : 12} cy={head === "up" ? 14 : 20} r="5" fill="var(--color-wool)" />
      <circle cx={head === "up" ? 8 : 11} cy={head === "up" ? 14 : 20} r="0.8" fill="var(--color-ink)" />
    </svg>
  );
}

function Cow() {
  return (
    <svg width="78" height="48" viewBox="0 0 52 32" aria-hidden>
      <ellipse cx="28" cy="18" rx="16" ry="9" fill="var(--color-wool)" />
      <ellipse cx="16" cy="12" rx="4" ry="3" fill="var(--color-clay)" />
      <ellipse cx="34" cy="14" rx="5" ry="3" fill="var(--color-clay)" opacity="0.8" />
      <ellipse cx="12" cy="20" rx="6" ry="5" fill="var(--color-wool)" />
      <circle cx="10" cy="20" r="0.8" fill="var(--color-ink)" />
    </svg>
  );
}

function Goose() {
  return (
    <svg width="46" height="48" viewBox="0 0 32 36" aria-hidden>
      <ellipse cx="16" cy="24" rx="10" ry="7" fill="var(--color-wool)" />
      <path d="M16 20 C16 10 22 8 22 4" fill="none" stroke="var(--color-wool)" strokeWidth="4" strokeLinecap="round" />
      <path d="M22 4 L28 6 L22 7" fill="var(--color-clay)" />
    </svg>
  );
}

function Person() {
  return (
    <svg width="42" height="56" viewBox="0 0 28 40" aria-hidden>
      <circle cx="14" cy="8" r="6" fill="var(--color-wool)" />
      <path d="M6 38 L8 16 H20 L22 38 Z" fill="var(--color-shirt)" />
    </svg>
  );
}

function Ducks() {
  return (
    <div className="absolute" style={{ left: "26%", top: "60%" }} aria-hidden>
      <svg width="70" height="24" viewBox="0 0 70 24">
        <ellipse cx="12" cy="14" rx="6" ry="3" fill="var(--color-hay)" />
        <ellipse cx="32" cy="16" rx="6" ry="3" fill="var(--color-ink)" opacity="0.35" />
        <ellipse cx="52" cy="13" rx="6" ry="3" fill="var(--color-wool)" />
      </svg>
    </div>
  );
}

function FaceCard({ id }: { id: FaceId }) {
  return (
    <div className="flex flex-col items-center">
      <Alpaca face={id} />
    </div>
  );
}

function ScrapCard({ id }: { id: ScrapId }) {
  if (id === "goose") return <Goose />;
  if (id === "lead") return <Sheep head="up" />;
  return <Cow />;
}
