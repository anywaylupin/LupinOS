// @lupinos/ui: macOS-style desktop components for React.
// Import the styles once: import "@lupinos/ui/styles.css";

export { Calendar, type CalendarProps, lunarDate } from "./Calendar.tsx";
export { CommandPalette, type CommandPaletteProps, type PaletteItem } from "./CommandPalette.tsx";
export { Button, Segmented, SidebarItem, SidebarSection, Switch } from "./Controls.tsx";
export { Drawer, type DrawerProps } from "./Drawer.tsx";
export { Dock, type DockItem, type DockProps, dockRect } from "./Dock.tsx";
export { clamp, dockScale, type Frac, fracRect, type Rect, type SnapZone, tileRects, type Zone, zoneAt, zoneRect } from "./geometry.ts";
export { AppIcon, type AppIconProps, appIconNames, UiIcon, type UiIconProps, uiIconNames } from "./icons.tsx";
export { Menu, MenuButton, type MenuItem, type MenuProps, useContextMenu } from "./Menu.tsx";
export { MenuBar, type MenuBarMenu, type MenuBarProps, StatusCapsule } from "./MenuBar.tsx";
export { LupinRoot, type LupinRootProps, type Motion, usePortalTarget } from "./Root.tsx";
export { isThemeId, type Mode, type Theme, type ThemeId, themeFontsHref, themeList, themes } from "./themes.ts";
export { type Toast, Toasts, type ToastsProps } from "./Toasts.tsx";
export { Wallpaper, type WallpaperProps } from "./Wallpaper.tsx";
export { Lights, type RectChange, Window, WindowControls, type WindowProps } from "./Window.tsx";
