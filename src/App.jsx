import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Graph3D from "./Graph3D.jsx";
import SidePanel from "./SidePanel.jsx";
import Controls from "./Controls.jsx";
import { NODES, LINKS } from "./data/graph.js";
import { useProgress } from "./useProgress.js";

// Compute all `depends-on` ancestors of a target node (the prerequisite chain).
// Used by the "learning path" highlight.
function ancestorsByDependsOn(targetId) {
  const set = new Set([targetId]);
  const stack = [targetId];
  while (stack.length) {
    const cur = stack.pop();
    LINKS.forEach((l) => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      if (t === cur && (l.type === "depends-on" || l.type === "feeds-into")) {
        if (!set.has(s)) {
          set.add(s);
          stack.push(s);
        }
      }
    });
  }
  return set;
}

export default function App() {
  const fgRef = useRef(null);
  const searchInputRef = useRef(null);

  const { getStatus, setStatus, resetAll, exportJson, map } = useProgress();

  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenCategories, setHiddenCategories] = useState(() => new Set());
  const [hiddenStatuses, setHiddenStatuses] = useState(() => new Set());
  const [highlightPath, setHighlightPath] = useState(null);

  const data = useMemo(
    () => ({
      nodes: NODES.map((n) => ({ ...n })),
      links: LINKS.map((l) => ({ ...l })),
    }),
    []
  );

  const toggleCategory = useCallback((key) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const toggleStatus = useCallback((s) => {
    setHiddenStatuses((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }, []);

  const totals = useMemo(() => {
    let understood = 0;
    let learning = 0;
    NODES.forEach((n) => {
      const s = getStatus(n.id);
      if (s === "understood") understood += 1;
      else if (s === "learning") learning += 1;
    });
    return { all: NODES.length, understood, learning };
  }, [getStatus, map]);

  const handleFit = useCallback(() => {
    if (fgRef.current) fgRef.current.zoomToFit(800, 60);
  }, []);

  const handleReset = useCallback(() => {
    if (
      window.confirm(
        "Reset learning progress on all nodes? This cannot be undone."
      )
    ) {
      resetAll();
    }
  }, [resetAll]);

  const handleShowLearningPath = useCallback((id) => {
    setHighlightPath(ancestorsByDependsOn(id));
  }, []);

  // Keyboard: Esc closes panel / clears path; "/" focuses search
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setSelectedNode(null);
        setHighlightPath(null);
      } else if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Force re-render of the graph when status map changes so node colors update.
  // react-force-graph caches scene objects; calling refresh() rebuilds them.
  useEffect(() => {
    if (fgRef.current?.refresh) fgRef.current.refresh();
  }, [map, selectedNode, highlightPath]);

  return (
    <div className="app">
      <Graph3D
        fgRef={fgRef}
        data={data}
        hiddenCategories={hiddenCategories}
        hiddenStatuses={hiddenStatuses}
        getStatus={getStatus}
        searchQuery={searchQuery}
        selectedNode={selectedNode}
        onSelectNode={setSelectedNode}
        highlightPath={highlightPath}
      />

      <Controls
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchInputRef={searchInputRef}
        hiddenCategories={hiddenCategories}
        toggleCategory={toggleCategory}
        hiddenStatuses={hiddenStatuses}
        toggleStatus={toggleStatus}
        totals={totals}
        onFit={handleFit}
        onReset={handleReset}
        onExport={exportJson}
        onClearPath={() => setHighlightPath(null)}
        pathActive={highlightPath !== null}
      />

      <SidePanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        getStatus={getStatus}
        setStatus={setStatus}
        onShowLearningPath={handleShowLearningPath}
      />
    </div>
  );
}
