// Trash: deleted items with where they came from and when. Restore, delete for good, or empty.
import { useState } from "react";
import * as os from "../os/store";
import { Icon, nodeIcon } from "../os/ui";
import { DAY, pathOf } from "../os/vfs";

export default function Trash() {
  const sess = os.useSession();
  const nodes = os.nodesOf(sess);
  const items = os.trashed(sess).sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="app">
      <div className="toolbar">
        <span className="muted" style={{ flex: 1, fontSize: 13 }}>
          Items older than 30 days are cleared automatically.
        </span>
        <button
          type="button"
          className="btn"
          disabled={!items.length}
          onClick={() =>
            os.confirmDialog("Empty Trash?", `${items.length} items will be deleted for good.`, "Empty Trash", () => os.destroy(items.map((n) => n.id)))
          }
        >
          Empty Trash
        </button>
      </div>
      <div className="scroll">
        {!items.length ? (
          <p className="empty">Trash is empty. Nothing to forget.</p>
        ) : (
          <table className="list-view">
            <thead>
              <tr>
                <th>Name</th>
                <th>From</th>
                <th>Deleted</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((n) => (
                <tr key={n.id} aria-selected={sel === n.id} onClick={() => setSel(n.id)}>
                  <td>
                    <Icon name={nodeIcon(n)} />
                    {n.name}
                  </td>
                  <td>{n.parent ? pathOf(nodes, n.parent) : "/"}</td>
                  <td title={`Cleared in ${Math.max(0, 30 - Math.floor((Date.now() - (n.trashedAt ?? 0)) / DAY))} days`}>
                    {new Date(n.trashedAt ?? 0).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="btn" onClick={() => os.restore(n.id)}>
                      Restore
                    </button>{" "}
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => os.confirmDialog(`Delete ${n.name} for good?`, "This cannot be undone.", "Delete", () => os.destroy([n.id]))}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
