import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "qubit-concept-graph:progress:v1";
export const STATUSES = ["not-started", "learning", "understood"];
export const STATUS_COLORS = {
  "not-started": "#3b4252",
  "learning":    "#f2c037",
  "understood":  "#2dc653",
};

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota errors */
  }
}

export function useProgress() {
  const [map, setMap] = useState(() => read());

  useEffect(() => {
    write(map);
  }, [map]);

  const getStatus = useCallback(
    (id) => map[id] || "not-started",
    [map]
  );

  const setStatus = useCallback((id, status) => {
    setMap((prev) => {
      const next = { ...prev };
      if (!status || status === "not-started") {
        delete next[id];
      } else {
        next[id] = status;
      }
      return next;
    });
  }, []);

  const resetAll = useCallback(() => setMap({}), []);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(map, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "concept-graph-progress.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [map]);

  return { map, getStatus, setStatus, resetAll, exportJson };
}
