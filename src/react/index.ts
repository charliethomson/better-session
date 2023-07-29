import { useCallback, useEffect, useState } from "react";
import { SessionAccessor } from "../session";

export const useSession = <T, K extends string>(
  accessor: SessionAccessor<K, T>,
  refreshIntervalMs = 100,
): [T | null, (value: T) => void] => {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const newValue = accessor.get();
      if (newValue === value) return;
      setValue(newValue);
    }, refreshIntervalMs);

    return () => {
      interval !== null && clearInterval(interval);
    };
  });

  const setter = useCallback(
    (newValue: T) => {
      accessor.set(newValue);
      setValue(newValue);
    },
    [accessor],
  );

  return [value, setter];
};