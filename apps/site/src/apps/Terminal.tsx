// Terminal: commands for every section, on the same virtual file system as Files and search.
import { useEffect, useRef, useState } from "react";
import { owner, projects } from "../content/owner";
import { effectiveMode, openNode } from "../os/actions";
import { apps } from "../os/apps";
import * as os from "../os/store";
import { type ThemeId, themes } from "@lupinos/ui";
import { children, HOME, pathOf, resolve } from "../os/vfs";
import { aboutText } from "./About";

type Out = { text: string; cls?: string };

const COMMANDS = ["help", "ls", "cd", "cat", "open", "clear", "pwd", "whoami", "neofetch", "beesay", "theme", "sudo", "rm", "matrix", "hire"];

const HELP = `Commands
  ls [path]        list a folder (ls -a shows hidden files)
  cd <path>        change folder. ~ is Home, .. goes up
  cat <file>       print a file
  open <path|app>  open a file, folder or app
  pwd              print the current folder
  clear            clear the screen
  whoami           who is the owner
  neofetch         system information
  beesay <text>    a bee says it
  theme <name>     switch theme: ${Object.keys(themes).join(", ")}
  hire             start a message to the owner
  matrix           glyph rain
Tab completes commands and paths. Up and Down walk the history.`;

const LOGO = String.raw`   __    __
  /  \__/  \
  \__/##\__/
  /  \__/  \
  \__/  \__/`;

const beesay = (text: string) => {
  const t = text || "Bzz. Please remain productive.";
  const bar = "-".repeat(t.length + 2);
  return ` ${bar}\n< ${t} >\n ${bar}\n      \\\n       \\   _  _\n        \\ ( \\/ )\n      __(o_o)\\/____\n     (__=====)>  bzz`;
};

export default function Terminal({ win }: { win: os.Win }) {
  const user = os.userById(os.useOS((s) => s.current));
  const [out, setOut] = useState<Out[]>([{ text: "LupinOS terminal. Issued by the Hive Corporation. Type help to begin." }]);
  const [cwd, setCwd] = useState(HOME);
  const [input, setInput] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const started = useRef(performance.now());

  useEffect(() => {
    box.current?.scrollTo(0, box.current.scrollHeight);
  });

  const nodes = () => os.nodesOf(os.session());
  const prompt = `${(user?.name ?? "guest").toLowerCase().replace(/\s+/g, "")}@lupinos:${pathOf(nodes(), cwd).replace(/^\/Home/, "~")}$`;

  function run(line: string): Out[] {
    const [cmd = "", ...args] = line.trim().split(/\s+/);
    const arg = args.join(" ");
    const all = nodes();
    const sess = os.session();
    const hiddenIds = sess?.hiddenIds ?? [];
    const err = (text: string): Out[] => [{ text, cls: "err" }];
    switch (cmd) {
      case "":
        return [];
      case "help":
        return [{ text: HELP }];
      case "clear":
        setOut([]);
        return [];
      case "pwd":
        return [{ text: pathOf(all, cwd) }];
      case "ls": {
        const showAll = args.includes("-a");
        const target = args.find((a) => a !== "-a");
        const dir = target ? resolve(all, target, cwd) : all.find((n) => n.id === cwd);
        if (!dir) return err(`ls: ${target}: no such file or folder`);
        if (dir.kind === "file") return [{ text: dir.name }];
        const list = children(all, dir.id, showAll, hiddenIds);
        return [{ text: list.map((n) => (n.kind === "folder" ? `${n.name}/` : n.name)).join("   ") || "(empty)" }];
      }
      case "cd": {
        const dir = resolve(all, arg || "~", cwd);
        if (!dir) return err(`cd: ${arg}: no such folder`);
        if (dir.kind !== "folder") return err(`cd: ${arg}: not a folder`);
        setCwd(dir.id);
        return [];
      }
      case "cat": {
        const n = resolve(all, arg, cwd);
        if (!n) return err(`cat: ${arg}: no such file`);
        if (n.kind === "folder") return err(`cat: ${arg}: is a folder`);
        if (n.open === "about") return [{ text: aboutText() }];
        if (n.open === "project") {
          const p = projects.find((x) => x.slug === n.arg);
          return [{ text: p ? `${p.title} (${p.year})\n${p.summary}\nStack: ${p.stack.join(", ")}\nopen ${pathOf(all, n.id)} for more` : "" }];
        }
        if (n.open === "resume") return [{ text: owner.resume.experience.map((e) => `${e.role}, ${e.org} (${e.when})`).join("\n") }];
        if (n.open === "contact") return [{ text: `Email: ${owner.email}\nOr type hire.` }];
        if (n.blob) return [{ text: "cat: binary honey. Try open instead." }];
        return [{ text: n.text || "(empty file)" }];
      }
      case "open": {
        if (apps[arg] && !apps[arg].hidden) {
          os.open(arg);
          return [{ text: `Opening ${apps[arg].name}` }];
        }
        const n = resolve(all, arg || ".", cwd);
        if (!n) return err(`open: ${arg}: no such file, folder or app`);
        openNode(n);
        return [{ text: `Opening ${n.name || "/"}` }];
      }
      case "whoami":
        return [{ text: `${owner.name}, ${owner.role}\n${owner.bio[0]}` }];
      case "neofetch": {
        const s = sess?.settings;
        const info = [
          `${prompt.split(":")[0]}`,
          "---------------",
          "OS: LupinOS 0.4 (issued)",
          "Kernel: hive 6.6.6-comb",
          "Shell: beesh",
          `Theme: ${s ? `${themes[s.theme].name} (${effectiveMode(s)})` : "unknown"}`,
          "CPU: lorem 9000",
          "Honey: 64 GB",
          `Uptime: ${Math.round((performance.now() - started.current) / 60000)} min`,
        ];
        const logo = LOGO.split("\n");
        return [{ text: info.map((l, i) => `${(logo[i] ?? "").padEnd(16)}${l}`).join("\n") }];
      }
      case "beesay":
        return [{ text: beesay(arg) }];
      case "theme": {
        if (!arg) return [{ text: `Installed: ${Object.keys(themes).join(", ")}` }];
        const id = (Object.keys(themes) as ThemeId[]).find((t) => t === arg.toLowerCase() || themes[t].name.toLowerCase() === arg.toLowerCase());
        if (id) {
          os.switchTheme(id);
          return [{ text: `Switching to ${themes[id].name}` }];
        }
        if (["corporate", "cyberpunk", "broken"].includes(arg)) return err(`theme: ${arg} is still awaiting corporate approval. Try: ${Object.keys(themes).join(", ")}`);
        return err(`theme: ${arg}: not installed`);
      }
      case "sudo":
        return err("This incident will be reported to the hive.");
      case "rm":
        if (/-rf?\s+\/$/.test(arg) || arg === "-rf /") {
          os.playFx("meltdown", 1800);
          setTimeout(() => setOut((o) => [...o, { text: "Just kidding. The hive restored everything. Please do not do that again." }]), 1900);
          return err("Deleting everything... the hive is screaming...");
        }
        return [{ text: "rm: the terminal only removes the whole universe. Use Delete in Files for single items." }];
      case "matrix":
        os.playFx("matrix", 5000);
        return [{ text: "Hex rain started. Click to stop." }];
      case "hire":
        os.open("contact", { arg: `Hi ${owner.name}, we would like to talk to you about a role at our company.` });
        return [{ text: "Opening Contact with a message ready. Good choice." }];
      default:
        return err(`${cmd}: command not found. Type help.`);
    }
  }

  const complete = () => {
    const parts = input.split(" ");
    const last = parts.at(-1) ?? "";
    if (parts.length === 1) {
      const hits = COMMANDS.filter((c) => c.startsWith(last));
      if (hits.length === 1) setInput(`${hits[0]} `);
      else if (hits.length) setOut((o) => [...o, { text: hits.join("   ") }]);
      return;
    }
    const slash = last.lastIndexOf("/");
    const dirPart = slash >= 0 ? last.slice(0, slash + 1) : "";
    const prefix = last.slice(slash + 1).toLowerCase();
    const all = nodes();
    const dir = dirPart ? resolve(all, dirPart, cwd) : all.find((n) => n.id === cwd);
    if (!dir) return;
    const hits = children(all, dir.id, prefix.startsWith("."), os.session()?.hiddenIds).filter((n) => n.name.toLowerCase().startsWith(prefix));
    if (hits.length === 1) {
      parts[parts.length - 1] = dirPart + hits[0].name + (hits[0].kind === "folder" ? "/" : "");
      setInput(parts.join(" "));
    } else if (hits.length) setOut((o) => [...o, { text: hits.map((n) => n.name).join("   ") }]);
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking anywhere focuses the prompt, which takes the keys
    // biome-ignore lint/a11y/noStaticElementInteractions: same
    <div className="terminal" ref={box} onClick={() => window.getSelection()?.isCollapsed && field.current?.focus()}>
      {out.map((o, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: output only grows
        <div key={i} className={o.cls}>
          {o.text}
        </div>
      ))}
      <div>
        <span className="prompt">{prompt}</span>{" "}
        <input
          ref={field}
          value={input}
          aria-label="Terminal command"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          // biome-ignore lint/a11y/noAutofocus: a terminal opens ready to type
          autoFocus={!win.min}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const line = input;
              setOut((o) => [...o, { text: `${prompt} ${line}`, cls: "prompt" }, ...run(line)]);
              if (line.trim()) setHist((h) => [...h, line]);
              setHi(-1);
              setInput("");
            } else if (e.key === "Tab") {
              e.preventDefault();
              complete();
            } else if (e.key === "ArrowUp" && hist.length) {
              e.preventDefault();
              const i = hi < 0 ? hist.length - 1 : Math.max(0, hi - 1);
              setHi(i);
              setInput(hist[i]);
            } else if (e.key === "ArrowDown" && hi >= 0) {
              e.preventDefault();
              const i = hi + 1;
              setHi(i >= hist.length ? -1 : i);
              setInput(i >= hist.length ? "" : hist[i]);
            } else if (e.key === "l" && e.ctrlKey) {
              e.preventDefault();
              setOut([]);
            }
          }}
        />
      </div>
    </div>
  );
}
