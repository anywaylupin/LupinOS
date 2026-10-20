// The desktop background: the theme gradient, or a picture or short video the user uploaded.
// Uploads stay in this browser (IndexedDB) and are never sent anywhere.
import { Wallpaper } from "@lupinos/ui";
import { useEffect, useState } from "react";
import { idbGet } from "./idb";
import { notify, setSettings, upload } from "./store";
import type { VNode } from "./vfs";

export function useBlobUrl(blobKey?: string) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blobKey) return setUrl(undefined);
    let u: string | undefined;
    idbGet<Blob>(blobKey).then((b) => b && setUrl((u = URL.createObjectURL(b))));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [blobKey]);
  return url;
}

export function DesktopWallpaper({ id, nodes }: { id: string; nodes: VNode[] }) {
  const node = id === "theme" ? undefined : nodes.find((n) => n.id === id && !n.trashedAt);
  const url = useBlobUrl(node?.blob);
  const video = node?.mime?.startsWith("video");
  return <Wallpaper image={url && !video ? url : undefined} video={url && video ? url : undefined} />;
}

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 30;

const videoSeconds = (file: Blob) =>
  new Promise<number>((ok) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      ok(v.duration);
    };
    v.onerror = () => ok(Number.POSITIVE_INFINITY);
    v.src = URL.createObjectURL(file);
  });

/** Checks an upload, shrinks images to the screen size, stores it locally and sets it as wallpaper. */
export async function uploadWallpaper(file: File) {
  const image = file.type.startsWith("image/");
  const video = file.type.startsWith("video/");
  if (!image && !video) return notify("Unsupported file", "Wallpapers must be an image or a short video.");
  if (file.size > MAX_BYTES) return notify("File too large", "Wallpapers can be up to 10 MB.");
  let blob: Blob = file;
  if (video && (await videoSeconds(file)) > MAX_VIDEO_SECONDS) return notify("Video too long", `Keep it under ${MAX_VIDEO_SECONDS} seconds.`);
  if (image && file.type !== "image/gif") {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, (Math.max(innerWidth, innerHeight) * devicePixelRatio) / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
      blob = (await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/webp", 0.88))) ?? file;
    } catch {
      return notify("Could not read that image", "The file may be damaged.");
    }
  }
  const id = await upload(blob, file.name);
  if (id) {
    setSettings({ wallpaper: id });
    notify("Wallpaper set", "Stored in this browser only. Nothing was sent anywhere.");
  }
}
