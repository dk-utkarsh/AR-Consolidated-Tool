import { useEffect, useState } from "react";

/**
 * Sync a tab value with window.location.hash so refresh + back/forward + share-links work.
 *
 * Usage:
 *   const [tab, setTab] = useHashTab(["tds194q", "cheques", "suspense"] as const, "suspense");
 *   <Tabs value={tab} onValueChange={setTab}>...</Tabs>
 */
export function useHashTab<T extends string>(
  allowed: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const read = (): T => {
    const raw = window.location.hash.replace(/^#/, "");
    return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  };

  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    const onHashChange = () => setValue(read());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (next: T) => {
    if (window.location.hash.replace(/^#/, "") !== next) {
      window.location.hash = next;
    } else {
      setValue(next);
    }
  };

  return [value, set];
}
