// Seven themes, red through pink. Each blends three or four related colours, carries a colour
// name the way a phone finish does, and has its own typeface. The CSS tokens live in lupin.css
// under [data-lui-theme][data-lui-mode]; this file is the metadata apps use for pickers.

export type ThemeId = "kova" | "tazu" | "mimo" | "olvi" | "lisen" | "yune" | "peli";
export type Mode = "light" | "dark";

export type Theme = {
  id: ThemeId;
  name: string;
  /** Colour name, like a phone finish. */
  hue: string;
  /** What the theme blends. */
  mood: string;
  /** The mode it looks best in. Both modes are always available. */
  mode: Mode;
  /** The theme's typeface (a Google Fonts family). lupin.css falls back to the system font. */
  font: string;
  /** The gradient behind everything. Also exposed as the CSS variable --lui-wall. */
  wallpaper: string;
  /** Four swatches for pickers: the blend, then the accent. */
  swatches: [string, string, string, string];
};

export const themes: Record<ThemeId, Theme> = {
  kova: {
    id: "kova",
    name: "Kova",
    hue: "Garnet",
    mood: "Akira × cyberpunk",
    mode: "dark",
    font: "Space Grotesk",
    wallpaper:
      "radial-gradient(70% 80% at 88% 10%, #e8956f 0%, transparent 60%), radial-gradient(80% 90% at 8% 95%, #3a1f3d 0%, transparent 65%), linear-gradient(155deg, #c4605a 0%, #9a3a48 42%, #4e2441 78%, #2a1b2e 100%)",
    swatches: ["#c4605a", "#9a3a48", "#4e2441", "#e4745f"],
  },
  tazu: {
    id: "tazu",
    name: "Tazu",
    hue: "Kiln",
    mood: "Wukong × anime",
    mode: "light",
    font: "Lexend",
    wallpaper:
      "radial-gradient(70% 80% at 15% 12%, #f8c99a 0%, transparent 60%), radial-gradient(70% 80% at 92% 85%, #b9667f 0%, transparent 62%), linear-gradient(150deg, #eaa070 0%, #d27c55 45%, #a8594f 100%)",
    swatches: ["#f8c99a", "#d27c55", "#b9667f", "#cc6634"],
  },
  mimo: {
    id: "mimo",
    name: "Mimo",
    hue: "Pollen",
    mood: "Bee × anime",
    mode: "light",
    font: "M PLUS Rounded 1c",
    wallpaper:
      "radial-gradient(65% 75% at 20% 18%, #fdeeb6 0%, transparent 60%), radial-gradient(60% 70% at 95% 95%, #b8c08e 0%, transparent 62%), radial-gradient(55% 60% at 85% 10%, #f4c88c 0%, transparent 60%), linear-gradient(155deg, #f1d68a 0%, #e2b65e 55%, #c49a52 100%)",
    swatches: ["#fdeeb6", "#e2b65e", "#b8c08e", "#b5861b"],
  },
  olvi: {
    id: "olvi",
    name: "Olvi",
    hue: "Moss",
    mood: "Wukong × hanyu",
    mode: "light",
    font: "Outfit",
    wallpaper:
      "radial-gradient(70% 80% at 12% 15%, #d4dcb2 0%, transparent 60%), radial-gradient(60% 70% at 95% 8%, #a7b7bb 0%, transparent 60%), radial-gradient(70% 80% at 85% 95%, #56704f 0%, transparent 65%), linear-gradient(155deg, #a9b885 0%, #7f9767 50%, #5f7652 100%)",
    swatches: ["#d4dcb2", "#7f9767", "#a7b7bb", "#5a7d47"],
  },
  lisen: {
    id: "lisen",
    name: "Lisen",
    hue: "Glacier",
    mood: "Far future × Akira",
    mode: "dark",
    font: "Sora",
    wallpaper:
      "radial-gradient(70% 80% at 12% 10%, #b4cfee 0%, transparent 58%), radial-gradient(70% 80% at 95% 95%, #3a2f63 0%, transparent 65%), linear-gradient(155deg, #7f9fd0 0%, #4b67a3 45%, #263463 80%, #1a2142 100%)",
    swatches: ["#b4cfee", "#4b67a3", "#3a2f63", "#8fb1f2"],
  },
  yune: {
    id: "yune",
    name: "Yune",
    hue: "Dusk Iris",
    mood: "Cyberpunk × anime",
    mode: "dark",
    font: "Chakra Petch",
    wallpaper:
      "radial-gradient(65% 75% at 85% 12%, #c5a5ea 0%, transparent 58%), radial-gradient(65% 75% at 10% 92%, #e08bb8 0%, transparent 60%), linear-gradient(155deg, #6a4ea6 0%, #47367e 48%, #2a2150 100%)",
    swatches: ["#c5a5ea", "#47367e", "#e08bb8", "#b79cf2"],
  },
  peli: {
    id: "peli",
    name: "Peli",
    hue: "Peony",
    mood: "Anime × hanyu",
    mode: "light",
    font: "Zen Maru Gothic",
    wallpaper:
      "radial-gradient(70% 80% at 15% 15%, #ffdcd6 0%, transparent 60%), radial-gradient(60% 70% at 95% 10%, #cdb0e0 0%, transparent 60%), radial-gradient(70% 80% at 85% 95%, #d9708f 0%, transparent 65%), linear-gradient(155deg, #f6c0bf 0%, #ec9fb2 50%, #cf7f9e 100%)",
    swatches: ["#ffdcd6", "#ec9fb2", "#cdb0e0", "#cc4f7a"],
  },
};

export const themeList: Theme[] = Object.values(themes);
export const isThemeId = (v: unknown): v is ThemeId => typeof v === "string" && v in themes;

/** A Google Fonts stylesheet URL that loads every theme's typeface. Optional: put it in a <link>. */
export const themeFontsHref = `https://fonts.googleapis.com/css2?${[...new Set(themeList.map((t) => t.font))]
  .map((f) => `family=${f.replace(/ /g, "+")}:wght@300;400;500;600;700`)
  .join("&")}&display=swap`;
