// A tiny event channel between features that should not import each other: games, the desktop
// hero, achievements and the visit log all hear the same moments.

export type OsEvent =
  | { type: "app-open"; app: string }
  | { type: "game-won"; game: string; score: number }
  | { type: "game-score"; game: string; score: number; best: boolean }
  | { type: "read-end"; what: string }
  | { type: "egg"; id: string }
  | { type: "resume-download" }
  | { type: "contact-sent" }
  | { type: "focus"; running: boolean };

type Listener = (e: OsEvent) => void;
const listeners = new Set<Listener>();

export function emit(e: OsEvent) {
  for (const l of listeners) l(e);
}

/** Returns the function that stops listening. */
export function on(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
