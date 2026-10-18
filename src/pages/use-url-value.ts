import type { SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
export function useUrlValue<T extends string | number>(
  key: string,
  initial: T,
  allowed?: readonly T[],
): [T, (value: SetStateAction<T>) => void] {
  const [search, setSearch] = useSearchParams();
  const raw = search.get(key);
  const candidate = (
    typeof initial === "number" ? Number(raw ?? initial) : (raw ?? initial)
  ) as T;
  const value =
    (allowed && !allowed.includes(candidate)) ||
    (typeof candidate === "number" &&
      (!Number.isInteger(candidate) || candidate < 1 || candidate > 500))
      ? initial
      : candidate;
  return [
    value,
    (next) =>
      setSearch((prev) => {
        const result = new URLSearchParams(prev);
        if (key !== "page") result.delete("page");
        const resolved = typeof next === "function" ? next(value) : next;
        if (resolved === initial) result.delete(key);
        else result.set(key, String(resolved));
        return result;
      }),
  ];
}
