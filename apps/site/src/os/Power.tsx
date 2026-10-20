// Power screens: boot, the welcome greeting, the user picker (lock and switch user), the phone
// lock screen, the screensaver, the rare kernel panic, and shut down.
import { Button, UiIcon } from "@lupinos/ui";
import { type CSSProperties, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useT } from "./i18n";
import * as os from "./store";
import { Avatar, clock, day, LupinMark, useNow } from "./ui";

/** Plays an exit animation for `ms`, then calls `then`. Calling it twice does nothing more. */
function useLeave(ms: number, then: () => void) {
  const [leaving, setLeaving] = useState(false);
  const started = useRef(false);
  const leave = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setLeaving(true);
    setTimeout(then, ms);
  }, [ms, then]);
  return [leaving, leave] as const;
}

const BOOT_MS = { first: 2800, returning: 1700 };

export function Boot({ onDone }: { onDone: () => void }) {
  const hydrated = os.useOS((s) => s.hydrated);
  const returning = os.useOS((s) => s.visits > 1);
  const [done, setDone] = useState(false);
  const [leaving, leave] = useLeave(650, onDone);
  const ms = returning ? BOOT_MS.returning : BOOT_MS.first;
  useEffect(() => {
    const t = setTimeout(() => setDone(true), ms);
    const skip = () => setDone(true);
    addEventListener("keydown", skip);
    addEventListener("pointerdown", skip);
    return () => {
      clearTimeout(t);
      removeEventListener("keydown", skip);
      removeEventListener("pointerdown", skip);
    };
  }, [ms]);
  useEffect(() => {
    if (done && hydrated) leave();
  }, [done, hydrated, leave]);
  return (
    <div className="screen boot" data-leaving={leaving || undefined}>
      <div className="boot-glow" aria-hidden="true" />
      <LupinMark size={84} animate />
      <div className="boot-bar" role="progressbar" aria-label="Starting LupinOS">
        <i style={{ animationDuration: `${ms - 200}ms` }} />
      </div>
    </div>
  );
}

export function Greeting({ user, onDone }: { user: os.User; onDone: () => void }) {
  const t = useT();
  const text = user.kind === "guest" ? t("Welcome") : t("Welcome back, {name}", { name: user.name });
  const [leaving, leave] = useLeave(800, onDone);
  useEffect(() => {
    const tm = setTimeout(leave, 2600);
    addEventListener("pointerdown", leave, { once: true });
    addEventListener("keydown", leave, { once: true });
    return () => {
      clearTimeout(tm);
      removeEventListener("pointerdown", leave);
      removeEventListener("keydown", leave);
    };
  }, [leave]);
  return (
    <div className="screen greeting" data-leaving={leaving || undefined}>
      <div className="lui-wallpaper" />
      <div className="greeting-card">
        <Avatar name={user.name} hue={user.hue} size={88} />
        <h1 aria-label={text}>
          {[...text].map((ch, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: letters repeat
            <span key={i} aria-hidden="true" style={{ "--i": i } as CSSProperties}>
              {ch === " " ? " " : ch}
            </span>
          ))}
        </h1>
      </div>
    </div>
  );
}

/** Lock screen and switch user: every profile in this browser, plus Guest and New user. */
export function UserPicker() {
  const users = os.useOS((s) => s.users);
  const all = os.allUsers(users);
  const now = useNow(15_000);
  const [form, setForm] = useState<null | "new" | os.User>(null);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);

  const pick = (u: os.User) => (u.pin ? (setForm(u), setErr("")) : os.login(u.id));
  const submitNew = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pin = String(f.get("pin") ?? "");
    if (pin && !/^\d{4}$/.test(pin)) return setErr("A PIN is four digits.");
    os.login(os.addUser(String(f.get("name") ?? ""), pin).id);
  };
  const submitPin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const u = form as os.User;
    if (new FormData(e.currentTarget).get("pin") === u.pin) return os.login(u.id);
    setErr("Incorrect PIN");
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div className="screen picker">
      <div className="lui-wallpaper" />
      <div className="picker-clock">
        <div className="picker-date">{day(now, { weekday: "long", day: "numeric", month: "long" })}</div>
        <div className="picker-time">{clock(now)}</div>
      </div>
      {!form && (
        <div className="picker-users" role="list" aria-label="Users on this computer">
          {[...all, null].map((u, i) => (
            <div key={u?.id ?? "new"} role="listitem" className="picker-user" style={{ "--i": i } as CSSProperties}>
              <button type="button" onClick={() => (u ? pick(u) : setForm("new"))}>
                {u ? <Avatar name={u.name} hue={u.hue} size={72} /> : <span className="picker-new"><UiIcon name="plus" /></span>}
                <strong>{u ? u.name : "New User"}</strong>
                <small>{u ? (u.kind === "owner" ? "Portfolio owner" : u.kind === "guest" ? "Cleared when you leave" : u.pin ? "PIN protected" : "On this browser") : "Kept in this browser"}</small>
              </button>
              {u?.kind === "local" && (
                <button
                  type="button"
                  className="picker-remove"
                  aria-label={`Remove ${u.name}`}
                  onClick={() => os.confirmDialog(`Remove ${u.name}?`, "Their desktop, files and wallpapers in this browser are deleted.", "Remove", () => os.removeUser(u.id))}
                >
                  <UiIcon name="close" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {form === "new" && (
        <form className="picker-form" onSubmit={submitNew} aria-label="New user">
          <Avatar name="?" hue={210} size={72} />
          <input className="lui-field" name="name" placeholder="Name" aria-label="Name" maxLength={24} required />
          <input className="lui-field" name="pin" placeholder="PIN (optional, 4 digits)" aria-label="PIN, optional" inputMode="numeric" maxLength={4} />
          <small>The PIN only guards this screen. It is not real security.</small>
          {err && <small role="alert">{err}</small>}
          <div className="row">
            <Button onClick={() => setForm(null)}>Cancel</Button>
            <Button type="submit" variant="primary">Create</Button>
          </div>
        </form>
      )}
      {form && form !== "new" && (
        <form className={`picker-form${shake ? " shake" : ""}`} onSubmit={submitPin} aria-label={`PIN for ${form.name}`}>
          <Avatar name={form.name} hue={form.hue} size={72} />
          <strong>{form.name}</strong>
          {/* biome-ignore lint/a11y/noAutofocus: the PIN is the only thing to do here */}
          <input className="lui-field pin" name="pin" type="password" inputMode="numeric" maxLength={4} aria-label="PIN" placeholder="Enter PIN" autoFocus />
          {err && <small role="alert">{err}</small>}
          <Button variant="plain" onClick={() => setForm(null)}>
            Cancel
          </Button>
        </form>
      )}
      <a className="picker-plain" href="/plain">
        Just the portfolio: plain version
      </a>
    </div>
  );
}

/** Phone lock screen: big clock; swipe up (or press Enter) for the user picker. */
export function PhoneLock({ onUnlock }: { onUnlock: () => void }) {
  const now = useNow();
  const [y0, setY0] = useState<number | null>(null);
  return (
    // biome-ignore lint/a11y/useSemanticElements: the whole screen is the unlock gesture
    <div
      className="screen phone-lock"
      role="button"
      tabIndex={0}
      aria-label="Locked. Swipe up or press Enter to unlock."
      onPointerDown={(e) => setY0(e.clientY)}
      onPointerUp={(e) => {
        if (y0 !== null && y0 - e.clientY > 60) onUnlock();
        setY0(null);
      }}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onUnlock()}
      onDoubleClick={onUnlock}
    >
      <div className="lui-wallpaper" />
      <div className="picker-clock">
        <div className="picker-date">{day(now, { weekday: "long", day: "numeric", month: "long" })}</div>
        <div className="picker-time">{clock(now)}</div>
      </div>
      <span className="phone-hint">Swipe up to unlock</span>
    </div>
  );
}

/** The screensaver drifts in over the desktop and lifts away on any input. */
export function Saver({ onWake }: { onWake: () => void }) {
  const [leaving, leave] = useLeave(700, onWake);
  useEffect(() => {
    const t = setTimeout(() => {
      addEventListener("pointermove", leave, { once: true });
      addEventListener("keydown", leave, { once: true });
      addEventListener("pointerdown", leave, { once: true });
    }, 600);
    return () => {
      clearTimeout(t);
      removeEventListener("pointermove", leave);
      removeEventListener("keydown", leave);
      removeEventListener("pointerdown", leave);
    };
  }, [leave]);
  const now = useNow();
  return (
    <div className="screen saver" data-leaving={leaving || undefined} aria-label="Screensaver. Move the mouse to return.">
      <div className="lui-wallpaper" />
      <div className="saver-clock">{clock(now)}</div>
    </div>
  );
}

export function Panic() {
  useEffect(() => {
    const back = () => os.setPower("desktop");
    const t = setTimeout(() => {
      addEventListener("keydown", back, { once: true });
      addEventListener("pointerdown", back, { once: true });
    }, 400);
    return () => {
      clearTimeout(t);
      removeEventListener("keydown", back);
      removeEventListener("pointerdown", back);
    };
  }, []);
  return (
    <div className="screen panic" role="alert">
      <div>
        <p>Your computer restarted because of a problem.</p>
        <p className="muted">LupinOS had a thought it was not licensed to have. Your windows are safe and coming back now.</p>
        <p className="muted">Press any key to hurry it along.</p>
      </div>
    </div>
  );
}

export function Off() {
  return (
    <div className="screen off">
      <button type="button" className="power-on" aria-label="Turn on" onClick={() => os.setPower("boot")}>
        <UiIcon name="power" />
      </button>
      <p>It is now safe to close this tab.</p>
    </div>
  );
}
