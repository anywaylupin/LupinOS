// Snake with rivals, as pure rules so they can be tested. Every snake moves one cell per tick.
// A head that runs into another snake's body bites off that cell and everything behind it, and
// the biter grows by one. The first ARMOUR cells of every snake cannot be bitten: the player loses
// on running into them, or on meeting any rival head on. Rivals that meet head on fight, and the
// longer one lives (a tie is a coin toss). Walls and your own body are fatal. There is always one
// honey fewer than there are snakes.

export const COLS = 24;
export const ROWS = 18;
/** The head and the cells right behind it, which cannot be bitten through. */
export const ARMOUR = 3;
/** How long a beaten rival stays gone, in ms. */
export const RESPAWN = 2500;

export type P = { x: number; y: number };
export type Snake = { body: P[]; dir: P; grow: number; alive: boolean; wait: number };
export type Death = "wall" | "self" | "armour" | "head";
/** snakes[0] is the player. */
export type World = { snakes: Snake[]; food: P[]; score: number; over: Death | null };

const DIRS: P[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];
const key = (p: P) => p.y * COLS + p.x;
const eq = (a?: P, b?: P) => !!a && !!b && a.x === b.x && a.y === b.y;
const inside = (p: P) => p.x >= 0 && p.y >= 0 && p.x < COLS && p.y < ROWS;
const add = (a: P, b: P) => ({ x: a.x + b.x, y: a.y + b.y });
/** A straight snake of `n` cells with its head at (x, y), facing `dir`. */
const line = (x: number, y: number, dir: P, n = 3): P[] => Array.from({ length: n }, (_, i) => ({ x: x - dir.x * i, y: y - dir.y * i }));
const snake = (body: P[], dir: P): Snake => ({ body, dir, grow: 0, alive: true, wait: 0 });

/** The player on the left heading right, one or two rivals on the right heading left. */
export function newWorld(rivals: number, rand = Math.random): World {
  const left = { x: -1, y: 0 };
  const snakes = [snake(line(5, 9, { x: 1, y: 0 }), { x: 1, y: 0 }), snake(line(18, 4, left), left)];
  if (rivals > 1) snakes.push(snake(line(18, 14, left), left));
  const w: World = { snakes, food: [], score: 0, over: null };
  fillFood(w, rand);
  return w;
}

function taken(w: World) {
  const used = new Set<number>();
  for (const s of w.snakes) for (const p of s.body) used.add(key(p));
  for (const f of w.food) used.add(key(f));
  return used;
}

function fillFood(w: World, rand: () => number) {
  const used = taken(w);
  while (w.food.length < w.snakes.length - 1 && used.size < COLS * ROWS) {
    const p = { x: Math.floor(rand() * COLS), y: Math.floor(rand() * ROWS) };
    if (used.has(key(p))) continue;
    used.add(key(p));
    w.food.push(p);
  }
}

/** Brings a beaten rival back somewhere free, away from the player's head. */
function respawn(w: World, s: Snake, rand: () => number) {
  const head = w.snakes[0].body[0];
  const used = taken(w);
  for (let tries = 0; tries < 200; tries++) {
    const dir = DIRS[Math.floor(rand() * 4)];
    const x = 4 + Math.floor(rand() * (COLS - 8));
    const y = 4 + Math.floor(rand() * (ROWS - 8));
    const body = line(x, y, dir);
    if (Math.abs(x - head.x) + Math.abs(y - head.y) < 8 || body.some((p) => used.has(key(p)))) continue;
    Object.assign(s, snake(body, dir));
    return;
  }
}

/** Breadth first from one cell: steps to the nearest honey, and how much room there is around it. */
function explore(from: P, wall: Set<number>, food: Set<number>, need: number) {
  const seen = new Set([key(from)]);
  let frontier = [from];
  let dist = food.has(key(from)) ? 0 : Infinity;
  for (let steps = 1; frontier.length && (dist === Infinity || seen.size < need * 2); steps++) {
    const next: P[] = [];
    for (const p of frontier)
      for (const d of DIRS) {
        const q = add(p, d);
        const k = key(q);
        if (!inside(q) || wall.has(k) || seen.has(k)) continue;
        seen.add(k);
        next.push(q);
        if (dist === Infinity && food.has(k)) dist = steps;
      }
    frontier = next;
  }
  return { dist: dist === Infinity ? COLS + ROWS : dist, room: seen.size };
}

/** A rival's next direction: the shortest way to honey that avoids walls, armour, dead ends and
 * head-on fights it could lose. Tails on the way are fair game. */
export function rivalDir(w: World, i: number, rand = Math.random): P {
  const me = w.snakes[i];
  const wall = new Set<number>();
  const risky = new Set<number>();
  w.snakes.forEach((t, j) => {
    if (!t.alive) return;
    t.body.forEach((p, k) => {
      if (j === i ? k > 0 && k < t.body.length - 1 : k < ARMOUR) wall.add(key(p));
    });
    if (j !== i && j !== 0 && t.body.length >= me.body.length) for (const d of DIRS) risky.add(key(add(t.body[0], d)));
  });
  const food = new Set(w.food.map(key));
  let best = me.dir;
  let bestScore = Infinity;
  for (const d of DIRS) {
    if (d.x === -me.dir.x && d.y === -me.dir.y) continue;
    const n = add(me.body[0], d);
    if (!inside(n) || wall.has(key(n))) continue;
    const { dist, room } = explore(n, wall, food, me.body.length);
    const score = dist + (room < me.body.length ? 100 : 0) + (risky.has(key(n)) ? 40 : 0) + rand() * 1.5;
    if (score < bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** One tick: every live snake moves along its entry in `dirs`, then bites, fights and deaths are
 * settled, honey is topped up and beaten rivals count down to their return. Mutates `w`. */
export function tick(w: World, dirs: P[], ms: number, rand = Math.random) {
  if (w.over) return;
  const you = w.snakes[0];
  const dead = new Set<Snake>();
  const lose = (why: Death) => {
    w.over ??= why;
  };
  const die = (s: Snake, why: Death) => (s === you ? lose(why) : dead.add(s));

  const live = w.snakes.filter((s) => s.alive);
  for (const s of live) {
    s.dir = dirs[w.snakes.indexOf(s)] ?? s.dir;
    const head = add(s.body[0], s.dir);
    if (!inside(head)) {
      die(s, "wall");
      continue;
    }
    s.body.unshift(head);
    const f = w.food.findIndex((p) => eq(p, head));
    if (f >= 0) {
      w.food.splice(f, 1);
      if (s === you) w.score++;
    } else if (s.grow > 0) s.grow--;
    else s.body.pop();
  }

  const moved = live.filter((s) => !dead.has(s) && !(s === you && w.over));
  // Head to head, including two heads that swap cells.
  for (let a = 0; a < moved.length; a++)
    for (let b = a + 1; b < moved.length; b++) {
      const A = moved[a];
      const B = moved[b];
      if (!eq(A.body[0], B.body[0]) && !(eq(A.body[0], B.body[1]) && eq(B.body[0], A.body[1]))) continue;
      if (A === you || B === you) lose("head");
      else dead.add(A.body.length === B.body.length ? (rand() < 0.5 ? A : B) : A.body.length < B.body.length ? A : B);
    }

  // Bodies: your own is fatal, armour is fatal, anything behind the armour is bitten off.
  for (const s of moved) {
    if (dead.has(s) || (s === you && w.over)) continue;
    for (const t of moved) {
      if (dead.has(t)) continue;
      const k = t.body.findIndex((p, idx) => idx > 0 && eq(p, s.body[0]));
      if (k < 0) continue;
      if (t === s) die(s, "self");
      else if (k < ARMOUR) die(s, "armour");
      else {
        t.body.length = k;
        s.grow++;
        if (s === you) w.score++;
      }
      break;
    }
  }

  for (const s of dead) Object.assign(s, { alive: false, body: [], wait: RESPAWN });
  for (const s of w.snakes) if (!s.alive && (s.wait -= ms) <= 0) respawn(w, s, rand);
  fillFood(w, rand);
}
