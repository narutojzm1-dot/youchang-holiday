export type Season = "summer" | "autumn" | "winter";
export type Weather = "sun" | "cloud" | "rain" | "fog";
export type Seat = "pond" | "door" | "slope";
export type Spot = "yard" | "door" | "path" | "watch" | "shade" | "hay" | "pen" | "pond";
export type FaceId = "bored" | "annoyed" | "happy" | "tease" | "spit";
export type ScrapId = "goose" | "lead" | "cow";
export type Phase = "day" | "night";

export const DAY_SECONDS = 68;
export const NIGHT_SECONDS = 18;

export interface World {
  started: boolean;
  day: number;
  elapsed: number;
  phase: Phase;
  season: Season;
  afterSnow: boolean;
  weather: Weather;
  seat: Seat;
  alpaca: Spot;
  lead: Spot;
  follow: Spot;
  cow: Spot;
  goose: "pond" | "path" | "face" | "player";
  gooseStopped: boolean;
  gooseOut: number;
  grain: boolean;
  hayForced: boolean;
  justAte: number;
  staring: number;
  walking: number;
  walkTo: Spot | null;
  sampleAcc: number;
  held: FaceId | null;
  heldLeft: number;
  pending: FaceId[];
  pendingScraps: ScrapId[];
  journal: FaceId[];
  scraps: ScrapId[];
  cowScrapToday: boolean;
  bookOpen: boolean;
  freshPage: boolean;
}

const WEATHER: Weather[] = [
  "sun",
  "sun",
  "cloud",
  "rain",
  "sun",
  "cloud",
  "fog",
  "sun",
  "cloud",
  "sun",
  "cloud",
  "fog",
];

export function createWorld(): World {
  return {
    started: false,
    day: 0,
    elapsed: 0,
    phase: "day",
    season: "summer",
    afterSnow: false,
    weather: "sun",
    seat: "door",
    alpaca: "yard",
    lead: "pen",
    follow: "pen",
    cow: "shade",
    goose: "pond",
    gooseStopped: false,
    gooseOut: 0,
    grain: false,
    hayForced: false,
    justAte: 0,
    staring: 0,
    walking: 0,
    walkTo: null,
    sampleAcc: 0,
    held: null,
    heldLeft: 0,
    pending: [],
    pendingScraps: [],
    journal: ["bored"],
    scraps: [],
    cowScrapToday: false,
    bookOpen: false,
    freshPage: false,
  };
}

export function seasonOf(day: number): { season: Season; afterSnow: boolean } {
  if (day < 4) return { season: "summer", afterSnow: false };
  if (day < 8) return { season: "autumn", afterSnow: false };
  return { season: "winter", afterSnow: day >= 12 };
}

export function weatherOf(day: number): Weather {
  return WEATHER[day] ?? (day % 2 === 0 ? "cloud" : "sun");
}

export function seasonLabel(day: number): string {
  if (day === 0) return "初夏";
  if (day < 3) return "盛夏";
  if (day === 3) return "夏末";
  if (day < 6) return "秋";
  if (day < 8) return "深秋";
  if (day === 8) return "初雪";
  if (day < 12) return "冬";
  return "雪后";
}

export function inLight(world: World): boolean {
  const t = world.elapsed / DAY_SECONDS;
  if (world.season === "summer") return t > 0.18 && t < 0.82;
  if (world.season === "autumn") return t > 0.5 && t < 0.72;
  return t > 0.44 && t < 0.58 && world.day % 5 === 4;
}

function cowSpot(world: World): Spot {
  if (world.weather === "rain") return "pen";
  if (world.hayForced || world.season !== "summer") return "hay";
  return "shade";
}

function leadSpot(world: World): Spot {
  if (world.weather === "rain") return "pen";
  const sun = world.weather === "sun";
  const alpacaHome = world.alpaca === "yard";
  if (sun && inLight(world) && alpacaHome) return "yard";
  return "pen";
}

function gooseWantsOut(world: World): boolean {
  if (world.weather === "rain" || world.grain) return false;
  if (world.season === "summer" && world.weather === "sun") return false;
  if (world.weather === "fog" && world.season !== "winter") return false;
  return world.elapsed > DAY_SECONDS * 0.12;
}

function tooClose(world: World): boolean {
  if (world.staring > 0 || world.walking > 0) return true;
  if (world.seat === "door" && world.alpaca === "door") return true;
  if (world.seat === "pond" && (world.alpaca === "path" || world.alpaca === "pond")) return true;
  return false;
}

function canSee(world: World, face: FaceId): boolean {
  if (world.weather === "fog") return false;
  if (face === "happy") return world.seat === "door" && world.alpaca === "yard";
  if (face === "tease") return world.seat === "slope" && world.alpaca === "watch";
  if (face === "annoyed" || face === "spit") {
    if (world.alpaca === "watch") return world.seat === "slope";
    return world.seat === "door" || world.seat === "pond";
  }
  return false;
}

export function evaluate(world: World): { face: FaceId; scraps: ScrapId[] } {
  const scraps: ScrapId[] = [];
  const sun = world.weather === "sun";
  const gooseAtFace = world.goose === "face";
  const watchedEat = world.justAte > 0 && tooClose(world);
  const spit =
    (gooseAtFace && world.gooseStopped && !sun) ||
    watchedEat ||
    (world.justAte > 0 && gooseAtFace && world.gooseStopped);
  if (gooseAtFace && world.gooseStopped) scraps.push("goose");
  if (world.lead === "yard" && world.alpaca === "yard") scraps.push("lead");
  if (world.follow === world.cow && world.cow !== "pen") scraps.push("cow");

  if (spit) return { face: "spit", scraps };
  if (!sun && gooseAtFace && !world.gooseStopped) return { face: "annoyed", scraps };
  if (
    sun &&
    inLight(world) &&
    world.alpaca === "yard" &&
    world.lead === "yard" &&
    world.goose === "pond" &&
    !tooClose(world)
  ) {
    return { face: "happy", scraps };
  }
  if (
    world.weather !== "rain" &&
    world.alpaca === "watch" &&
    world.follow === world.cow &&
    (world.cow === "shade" || world.cow === "hay") &&
    !tooClose(world)
  ) {
    return { face: "tease", scraps };
  }
  return { face: "bored", scraps };
}

function remember(world: World, face: FaceId, scraps: ScrapId[]) {
  if (face !== "bored") {
    world.held = face;
    world.heldLeft = 8;
    if (canSee(world, face) && !world.journal.includes(face) && !world.pending.includes(face)) {
      world.pending.push(face);
      world.freshPage = true;
    }
  }
  if (world.weather === "fog") return;
  for (const scrap of scraps) {
    if (scrap === "goose") {
      if (world.goose !== "face") continue;
      if (world.seat !== "pond" && world.seat !== "door") continue;
      if (world.scraps.includes("goose") || world.pendingScraps.includes("goose")) continue;
    } else if (scrap === "lead") {
      if (!(world.seat === "door" && world.lead === "yard")) continue;
      if (world.scraps.includes("lead") || world.pendingScraps.includes("lead")) continue;
    } else {
      if (!(world.seat === "slope" && world.cow !== "pen" && world.follow === world.cow)) continue;
      if (world.cowScrapToday) continue;
      world.cowScrapToday = true;
    }
    world.pendingScraps.push(scrap);
  }
}

export function step(world: World, dt: number) {
  if (!world.started) return;
  if (world.phase === "night") {
    if (world.bookOpen) return;
    world.elapsed += dt;
    if (world.elapsed >= NIGHT_SECONDS) dawn(world);
    return;
  }

  world.elapsed += dt;
  world.justAte = Math.max(0, world.justAte - dt);
  world.staring = Math.max(0, world.staring - dt);
  world.heldLeft = Math.max(0, world.heldLeft - dt);
  if (world.heldLeft === 0) world.held = null;

  if (world.walking > 0) {
    world.walking = Math.max(0, world.walking - dt);
    if (world.walking === 0 && world.walkTo) {
      world.alpaca = world.walkTo;
      world.walkTo = null;
      if (world.alpaca === "watch") world.seat = "slope";
      else if (world.alpaca === "path") world.seat = "pond";
      else world.seat = "door";
    }
    return;
  }

  world.cow = cowSpot(world);
  world.follow = world.weather === "rain" ? "pen" : world.cow;
  world.lead = leadSpot(world);

  if (gooseWantsOut(world)) {
    world.gooseOut += dt;
    const block = world.seat === "pond" && world.alpaca !== "path";
    if (block) {
      world.goose = "player";
      world.gooseStopped = true;
    } else if (world.gooseOut > 7 && (world.weather === "cloud" || world.season === "winter")) {
      world.goose = "face";
      world.gooseStopped = world.gooseOut > 14;
    } else if (world.gooseOut > 3) {
      world.goose = "face";
      world.gooseStopped = false;
    } else {
      world.goose = "path";
      world.gooseStopped = false;
    }
  } else {
    world.goose = "pond";
    world.gooseStopped = false;
    world.gooseOut = 0;
  }

  world.sampleAcc += dt;
  if (world.sampleAcc >= 1.4) {
    world.sampleAcc = 0;
    const result = evaluate(world);
    if (result.face !== "bored" || result.scraps.length) remember(world, result.face, result.scraps);
  }

  if (world.elapsed >= DAY_SECONDS) {
    world.phase = "night";
    world.elapsed = 0;
    for (const face of world.pending) {
      if (!world.journal.includes(face)) world.journal.push(face);
    }
    world.pending = [];
    world.scraps.push(...world.pendingScraps);
    world.pendingScraps = [];
  }
}

function dawn(world: World) {
  world.day += 1;
  const s = seasonOf(world.day);
  world.season = s.season;
  world.afterSnow = s.afterSnow;
  world.weather = weatherOf(world.day);
  world.phase = "day";
  world.elapsed = 0;
  world.grain = false;
  world.hayForced = false;
  world.gooseOut = 0;
  world.goose = "pond";
  world.gooseStopped = false;
  world.justAte = 0;
  world.staring = 0;
  world.sampleAcc = 0;
  world.cowScrapToday = false;
  world.held = null;
  world.bookOpen = false;
  world.alpaca = "yard";
  world.seat = "door";
}

export function sit(world: World, seat: Seat) {
  if (world.phase !== "day" || world.walking > 0) return;
  world.seat = seat;
  world.staring = 0;
}

export function feedHay(world: World) {
  if (world.phase !== "day" || world.walking > 0) return;
  world.hayForced = true;
}

export function feedGrain(world: World) {
  if (world.phase !== "day" || world.walking > 0) return;
  world.grain = true;
  world.goose = "pond";
  world.gooseStopped = false;
  world.gooseOut = 0;
}

export function feedHim(world: World) {
  if (world.phase !== "day" || world.walking > 0) return;
  world.justAte = 22;
  world.staring = 10;
}

export function walkTo(world: World, spot: Spot) {
  if (world.phase !== "day" || world.walking > 0) return;
  world.walking = 4.5;
  world.walkTo = spot;
  world.alpaca = spot;
  world.staring = 0;
}

export function posture(world: World): FaceId {
  if (world.held) return world.held;
  return "bored";
}

const SAVE_KEY = "youchang-holiday-v1";

export function saveWorld(world: World) {
  const data = {
    version: 1,
    day: world.day,
    journal: world.journal,
    scraps: world.scraps,
    season: world.season,
    afterSnow: world.afterSnow,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* private mode */
  }
}

export function loadWorld(world: World) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as {
      version?: number;
      day?: number;
      journal?: FaceId[];
      scraps?: ScrapId[];
    };
    if (data.version !== 1 || typeof data.day !== "number") return;
    world.day = data.day;
    const s = seasonOf(world.day);
    world.season = s.season;
    world.afterSnow = s.afterSnow;
    world.weather = weatherOf(world.day);
    if (Array.isArray(data.journal) && data.journal.includes("bored")) world.journal = data.journal;
    if (Array.isArray(data.scraps)) world.scraps = data.scraps;
  } catch {
    /* ignore broken saves */
  }
}

export function selfCheck(): string[] {
  const errors: string[] = [];
  const happy = createWorld();
  happy.started = true;
  happy.elapsed = DAY_SECONDS * 0.4;
  happy.weather = "sun";
  happy.season = "summer";
  happy.seat = "door";
  happy.alpaca = "yard";
  happy.lead = "yard";
  happy.goose = "pond";
  const h = evaluate(happy);
  if (h.face !== "happy") errors.push(`expected happy, got ${h.face}`);
  if (!canSee(happy, "happy")) errors.push("door should see happy");

  const annoyed = createWorld();
  annoyed.weather = "cloud";
  annoyed.goose = "face";
  annoyed.gooseStopped = false;
  annoyed.alpaca = "yard";
  annoyed.seat = "door";
  if (evaluate(annoyed).face !== "annoyed") errors.push("expected annoyed");

  const spit = createWorld();
  spit.weather = "cloud";
  spit.goose = "face";
  spit.gooseStopped = true;
  spit.seat = "pond";
  spit.alpaca = "yard";
  if (evaluate(spit).face !== "spit") errors.push("expected spit");

  const tease = createWorld();
  tease.weather = "sun";
  tease.alpaca = "watch";
  tease.cow = "shade";
  tease.follow = "shade";
  tease.seat = "slope";
  tease.lead = "pen";
  tease.goose = "pond";
  if (evaluate(tease).face !== "tease") errors.push(`expected tease, got ${evaluate(tease).face}`);

  const blocked = createWorld();
  blocked.started = true;
  blocked.weather = "sun";
  blocked.elapsed = DAY_SECONDS * 0.4;
  blocked.seat = "pond";
  blocked.alpaca = "yard";
  blocked.lead = "yard";
  blocked.goose = "pond";
  if (evaluate(blocked).face !== "happy") errors.push("performance should still happen at the pond");
  remember(blocked, "happy", []);
  if (blocked.pending.includes("happy")) errors.push("pond seat must not journal happy");

  const winter = createWorld();
  winter.day = 9;
  winter.season = "winter";
  winter.weather = "sun";
  winter.elapsed = DAY_SECONDS * 0.5;
  winter.goose = "face";
  winter.alpaca = "yard";
  winter.lead = "yard";
  if (evaluate(winter).face === "happy") errors.push("winter goose should block happy");

  return errors;
}
