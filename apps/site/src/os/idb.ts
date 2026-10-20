// Tiny IndexedDB key-value store: user sessions and uploaded files (Blobs survive structured clone).
const db = () =>
  new Promise<IDBDatabase>((ok, fail) => {
    const req = indexedDB.open("lupinos", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return db().then(
    (d) =>
      new Promise((ok, fail) => {
        const req = fn(d.transaction("kv", mode).objectStore("kv"));
        req.onsuccess = () => ok(req.result);
        req.onerror = () => fail(req.error);
      }),
  );
}

export const idbGet = <T>(key: string) => run<T | undefined>("readonly", (s) => s.get(key));
export const idbSet = (key: string, value: unknown) => run("readwrite", (s) => s.put(value, key));
export const idbDel = (key: string) => run("readwrite", (s) => s.delete(key));
