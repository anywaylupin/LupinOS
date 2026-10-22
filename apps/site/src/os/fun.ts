// The fun layer: achievements, easter eggs and pranks. Pranks follow strict rules so they stay
// charming: three seconds at most or dismissable at once, never in the first 30 seconds, at
// most one random prank every few minutes, each once per visitor, and none in Serious mode.
// Reduced motion turns off the moving ones.
import { lunarDate } from "@lupinos/ui";
import { panic } from "./actions";
import { apps } from "./apps";
import { emit, on } from "./bus";
import * as os from "./store";

export const ACHIEVEMENTS = [
  { id: "first-steps", name: "First steps", hint: "Open any app." },
  { id: "explorer", name: "Opened every app", hint: "Open every app in the launcher." },
  { id: "read-resume", name: "Read the whole resume", hint: "Turn to the last page of Resume.pdf." },
  { id: "projects", name: "Due diligence", hint: "Read a project to the end." },
  { id: "secret-folder", name: "Found the secret folder", hint: "Some folders hide. Files can show them." },
  { id: "broke-os", name: "Broke the OS", hint: "There is a terminal command you should never run." },
  { id: "flappy", name: "Beat Flappy", hint: "Score 10 in Flappy." },
  { id: "mines", name: "Bomb squad", hint: "Win a game of Minesweeper." },
  { id: "solitaire", name: "Patience", hint: "Solve a game of Solitaire." },
  { id: "konami", name: "Up, up, down, down", hint: "An old cheat code still works here." },
  { id: "tiler", name: "Tiling enjoyer", hint: "Tile every window at once." },
  { id: "logo", name: "Persistent", hint: "Some logos like being clicked. A lot." },
  { id: "guest", name: "Left a mark", hint: "Sign the guestbook." },
  { id: "night", name: "Night shift", hint: "Visit between midnight and five." },
  { id: "sandwich", name: "Root privileges", hint: "Ask the terminal nicely, as root." },
] as const;

const name = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id;
const award = (id: string) => os.unlock(id, name(id));

const EGG_TO_BADGE: Record<string, string> = {
  hive: "secret-folder",
  meltdown: "broke-os",
  konami: "konami",
  logo: "logo",
  sandwich: "sandwich",
  tiling: "tiler",
  guestbook: "guest",
};

const serious = () => !!os.session()?.settings.serious;
const moving = () => !matchMedia("(prefers-reduced-motion: reduce)").matches && os.session()?.settings.motion !== "reduced" && os.session()?.settings.motion !== "none";
/** A prank runs only once per visitor, unless they replay it from Settings. */
const firstTime = (prank: string) => {
  if (serious() || os.seen(`prank:${prank}`)) return false;
  os.markSeen(`prank:${prank}`);
  return true;
};

// ---- pranks that need a place to happen -----------------------------------------------------------

/** The first close of a visit: the close button dodges once. The second click works. */
export function closeDodges(button: HTMLElement) {
  if (!moving() || !firstTime("close")) return false;
  button.animate([{ translate: "0 0" }, { translate: "-34px 6px" }, { translate: "-30px 4px", offset: 0.7 }, { translate: "0 0" }], { duration: 900, easing: "cubic-bezier(.2,.8,.2,1)" });
  os.notify("Not so fast", "The close button needed a moment. Try again.", 2500);
  return true;
}

/** The first confirm dialog of a visit: Yes and No swap places once. Escape still closes it. */
export const dialogSwaps = () => firstTime("swap");

/** A random restart sometimes installs an update. Skip is always there. */
export const fakeUpdate = () => Math.random() < 0.25 && (os.useOS.getState().visits ?? 0) > 1 && firstTime("update");

function shyIcons() {
  const icons = [...document.querySelectorAll<HTMLElement>(".icon")];
  let last = { x: 0, y: 0, t: 0 };
  const move = (e: PointerEvent) => {
    const speed = Math.hypot(e.clientX - last.x, e.clientY - last.y) / Math.max(1, e.timeStamp - last.t);
    last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    for (const el of icons) {
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - e.clientX;
      const dy = r.top + r.height / 2 - e.clientY;
      const d = Math.hypot(dx, dy);
      el.style.translate = d < 110 && speed < 0.6 ? `${(dx / d) * 26}px ${(dy / d) * 26}px` : "";
    }
  };
  addEventListener("pointermove", move);
  setTimeout(() => {
    removeEventListener("pointermove", move);
    for (const el of icons) el.style.translate = "";
  }, 5000);
}

function tiredWindow() {
  const el = [...document.querySelectorAll<HTMLElement>(".ws:not([inert]) .lui-window[data-focused]")][0];
  if (!el) return;
  el.dataset.tired = "";
  el.addEventListener("pointerdown", () => delete el.dataset.tired, { once: true });
}

const RANDOM: Record<string, { run: () => void; moves: boolean }> = {
  "shy-icons": { run: shyIcons, moves: true },
  "tired-window": { run: tiredWindow, moves: true },
  "helper-bee": { run: () => os.useOS.setState({ prank: "helper-bee" }), moves: false },
};
export const PRANKS = [
  { id: "close", name: "Runaway close button" },
  { id: "swap", name: "Swapping buttons" },
  { id: "update", name: "Fake update" },
  { id: "copy", name: "Copy joke" },
  { id: "panic", name: "Too many windows" },
  { id: "shy-icons", name: "Shy icons" },
  { id: "tired-window", name: "Tired window" },
  { id: "helper-bee", name: "Helper bee" },
];

/** Lets a prank happen again; the random ones play straight away. */
export function replayPrank(id: string) {
  os.useOS.setState((s) => {
    const sess = s.current ? s.sessions[s.current] : undefined;
    if (!sess || !s.current) return {};
    return { sessions: { ...s.sessions, [s.current]: { ...sess, seen: sess.seen.filter((k) => k !== `prank:${id}`) } } };
  });
  if (RANDOM[id]) {
    os.setOverlay(null);
    setTimeout(() => RANDOM[id].run(), 300);
  }
}

// ---- starting it all --------------------------------------------------------------------------------

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "KeyB", "KeyA"];
let started = false;

export function startFun() {
  if (started) return;
  started = true;

  console.log(
    "%c ▌   %c LupinOS \n%c ▌▄▖ %c You found the console. Want to talk? Open Contact, or type hire in the Terminal.",
    "color:#e5484d;font:700 16px monospace",
    "font:700 16px monospace",
    "color:#e5484d;font:700 16px monospace",
    "font:13px sans-serif",
  );

  on((e) => {
    if (e.type === "app-open") {
      award("first-steps");
      os.markSeen(`app:${e.app}`);
      const visible = Object.values(apps).filter((a) => !a.hidden);
      if (visible.every((a) => os.seen(`app:${a.id}`))) award("explorer");
      const wins = os.session()?.windows.length ?? 0;
      if (wins >= 10 && firstTime("panic")) setTimeout(panic, 400);
    } else if (e.type === "read-end") award(e.what === "resume" ? "read-resume" : "projects");
    else if (e.type === "game-won") {
      if (e.game === "flappy") award("flappy");
      else if (e.game.startsWith("mines")) award("mines");
      else if (e.game.startsWith("klondike")) award("solitaire");
    } else if (e.type === "egg" && EGG_TO_BADGE[e.id]) award(EGG_TO_BADGE[e.id]);
  });

  const h = new Date().getHours();
  if (h < 5) setTimeout(() => award("night"), 3000);

  // the Konami code toggles Akira mode
  let k = 0;
  addEventListener("keydown", (e) => {
    k = e.code === KONAMI[k] ? k + 1 : e.code === KONAMI[0] ? 1 : 0;
    if (k < KONAMI.length) return;
    k = 0;
    const akira = !os.useOS.getState().akira;
    os.useOS.setState({ akira });
    emit({ type: "egg", id: "konami" });
    os.notify(akira ? "Akira mode" : "Akira mode off", akira ? "Red, black and speed. Enter the code again to leave." : "Back to the issued colours.");
  });

  // five quick clicks on the logo start the glyph rain
  let clicks: number[] = [];
  addEventListener(
    "pointerdown",
    (e) => {
      if (!(e.target as Element).closest?.(".lui-menubar > .lui-menubar-item:first-child")) return;
      const now = performance.now();
      clicks = [...clicks.filter((t) => now - t < 2000), now];
      if (clicks.length < 5) return;
      clicks = [];
      os.playFx("matrix", 5000);
      emit({ type: "egg", id: "logo" });
    },
    true,
  );

  addEventListener("copy", () => firstTime("copy") && os.notify("Copied", "The hive remembers.", 2000));

  // random pranks: never in the first 30 seconds, then at most one every few minutes
  const tick = () => {
    const st = os.useOS.getState();
    if (st.power === "desktop" && !serious()) {
      const pool = Object.keys(RANDOM).filter((id) => !os.seen(`prank:${id}`) && (moving() || !RANDOM[id].moves));
      const id = pool[Math.floor(Math.random() * pool.length)];
      if (id && firstTime(id)) RANDOM[id].run();
    }
    setTimeout(tick, (3 + Math.random() * 3) * 60_000);
  };
  setTimeout(tick, 90_000);
}

/** Moments on the calendar: lanterns at Lunar New Year, a cake on the OS birthday. */
export function moment(d = new Date()): "lantern" | "birthday" | null {
  const l = lunarDate(d, "Asia/Ho_Chi_Minh");
  if (l && l.month === "1" && l.day <= 15) return "lantern";
  if (d.getMonth() === 9 && d.getDate() === 20) return "birthday";
  return null;
}
