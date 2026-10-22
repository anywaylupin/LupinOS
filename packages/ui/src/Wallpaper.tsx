// The desktop background. By default it is the theme's gradient (--lui-wall). Pass an image or a
// short muted video to use your own; it fades in over the old one.
import { type ReactNode, useEffect, useRef, useState } from "react";

export type WallpaperProps = {
  /** An image URL. */
  image?: string;
  /** A video URL, played muted and looped. */
  video?: string;
  className?: string;
  /** Layers drawn over the theme gradient, such as a painted or animated scene. Not shown over an image or video. */
  children?: ReactNode;
};

export function Wallpaper({ image, video, className, children }: WallpaperProps) {
  const key = video ?? image ?? "theme";
  const first = useRef(true);
  const [entering, setEntering] = useState(false);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setEntering(true);
    const t = setTimeout(() => setEntering(false), 650);
    return () => clearTimeout(t);
  }, [key]);
  return (
    <div key={key} className={className ? `lui-wallpaper ${className}` : "lui-wallpaper"} data-entering={entering || undefined} aria-hidden="true">
      {video ? <video src={video} autoPlay muted loop playsInline /> : image ? <img src={image} alt="" /> : children}
    </div>
  );
}
