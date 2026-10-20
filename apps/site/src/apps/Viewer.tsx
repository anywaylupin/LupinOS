// Viewer: text files (editable when they are yours) and uploaded pictures or videos.
import { useEffect, useState } from "react";
import type { AppProps } from "../os/apps";
import { idbGet } from "../os/idb";
import * as os from "../os/store";

export default function Viewer({ win }: AppProps) {
  const sess = os.useSession();
  const node = os.nodesOf(sess).find((n) => n.id === win.arg);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!node?.blob) return;
    let u: string | undefined;
    idbGet<Blob>(node.blob).then((b) => b && setUrl((u = URL.createObjectURL(b))));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [node?.blob]);

  if (!node || node.trashedAt) return <p className="empty">This file is in Trash or no longer exists.</p>;
  if (node.blob) {
    if (!url) return <div className="app-loading"><div className="spinner" /></div>;
    return node.mime?.startsWith("video") ? <video className="viewer-img" src={url} controls muted /> : <img className="viewer-img" src={url} alt={node.name} />;
  }
  if (os.isOwnerFile(node.id)) return <pre className="prose mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{node.text}</pre>;
  return (
    <textarea
      className="field mono"
      style={{ height: "100%", resize: "none", border: 0 }}
      aria-label={node.name}
      defaultValue={node.text ?? ""}
      placeholder="Type here. Saved in this browser when you leave the field."
      onBlur={(e) => e.target.value !== (node.text ?? "") && os.editText(node.id, e.target.value)}
    />
  );
}
