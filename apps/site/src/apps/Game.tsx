// One game in its own window. The window's arg names the game, with ":daily" for today's round.
import { Suspense } from "react";
import type { AppProps } from "../os/apps";
import * as os from "../os/store";
import { gameById } from "../games/list";

export default function Game({ win }: AppProps) {
  const [id, mode] = (win.arg ?? "").split(":");
  const def = gameById(id);
  // Games pause whenever another window is in front.
  const focused = os.useOS((s) => {
    const sess = s.current ? s.sessions[s.current] : undefined;
    return os.topWindow(sess)?.id === win.id && s.overlay === null;
  });
  if (!def) return <p className="empty">This game has not been issued yet.</p>;
  return (
    <Suspense fallback={<div className="app-loading"><div className="spinner" /></div>}>
      <def.Component focused={focused} daily={mode === "daily"} />
    </Suspense>
  );
}
