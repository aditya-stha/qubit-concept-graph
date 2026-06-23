import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

// For a panel anchored to one edge of the viewport, return the inset that
// would push the graph clear of it. The anchored edge is the one OPPOSITE
// the panel's largest empty margin — e.g. a top sheet sits with most of the
// viewport below it, so its largest dist is distBottom and its anchor is top.
function panelInset(el, viewport) {
  const top = el.offsetTop;
  const left = el.offsetLeft;
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  if (!width || !height) return null;

  const distTop = top;
  const distBottom = viewport.height - (top + height);
  const distLeft = left;
  const distRight = viewport.width - (left + width);
  const max = Math.max(distTop, distBottom, distLeft, distRight);

  if (max === distBottom) return { side: "top", value: top + height };
  if (max === distTop) return { side: "bottom", value: viewport.height - top };
  if (max === distRight) return { side: "left", value: left + width };
  return { side: "right", value: viewport.width - left };
}

export default function App() {
  const fgRef = useRef(null);
  const searchInputRef = useRef(null);
  const controlsRef = useRef(null);
  const sidePanelRef = useRef(null);

  const { getStatus, setStatus, resetAll, exportJson, map } = useProgress();

  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenCategories, setHiddenCategories] = useState(() => new Set());
  const [hiddenStatuses, setHiddenStatuses] = useState(() => new Set());
  const [highlightPath, setHighlightPath] = useState(null);
  const [graphInsets, setGraphInsets] = useState({ top: 0, right: 0, bottom: 0, left: 0 });

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

  // On mobile, shrink the graph viewport to the area not covered by the
  // floating panels. Using offsetTop/offsetHeight (not getBoundingClientRect)
  // so the slide-up animation on the side panel doesn't confuse the math.
  useLayoutEffect(() => {
    const mobileMq = window.matchMedia(
      "(max-width: 720px), (pointer: coarse) and (max-width: 900px)"
    );

    const update = () => {
      if (!mobileMq.matches) {
        setGraphInsets((prev) =>
          prev.top === 0 && prev.right === 0 && prev.bottom === 0 && prev.left === 0
            ? prev
            : { top: 0, right: 0, bottom: 0, left: 0 }
        );
        return;
      }

      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const margin = 8;
      const next = { top: 0, right: 0, bottom: 0, left: 0 };

      for (const el of [controlsRef.current, sidePanelRef.current]) {
        if (!el) continue;
        const ins = panelInset(el, viewport);
        if (!ins) continue;
        next[ins.side] = Math.max(next[ins.side], Math.round(ins.value + margin));
      }

      setGraphInsets((prev) =>
        prev.top === next.top &&
        prev.right === next.right &&
        prev.bottom === next.bottom &&
        prev.left === next.left
          ? prev
          : next
      );
    };

    update();

    const ro = new ResizeObserver(update);
    if (controlsRef.current) ro.observe(controlsRef.current);
    if (sidePanelRef.current) ro.observe(sidePanelRef.current);

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    mobileMq.addEventListener?.("change", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      mobileMq.removeEventListener?.("change", update);
    };
  }, [selectedNode]);

  // When the graph viewport changes size (panel open/close), move the camera
  // along its current view vector by the same ratio the canvas changed. This
  // keeps the graph at the same apparent on-screen size in the new visible
  // area instead of zoomToFit-ing the whole bbox into a smaller canvas (which
  // makes nodes tiny).
  const prevInsetsRef = useRef(graphInsets);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg?.cameraPosition) return;

    const prev = prevInsetsRef.current;
    const next = graphInsets;
    prevInsetsRef.current = next;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const oldW = Math.max(1, vw - prev.left - prev.right);
    const oldH = Math.max(1, vh - prev.top - prev.bottom);
    const newW = Math.max(1, vw - next.left - next.right);
    const newH = Math.max(1, vh - next.top - next.bottom);

    const scale = Math.min(newW / oldW, newH / oldH);
    if (Math.abs(scale - 1) < 0.01) return;

    const id = setTimeout(() => {
      try {
        const pos = fg.cameraPosition();
        const controls = fg.controls?.();
        const t = controls?.target || { x: 0, y: 0, z: 0 };
        fg.cameraPosition(
          {
            x: t.x + (pos.x - t.x) * scale,
            y: t.y + (pos.y - t.y) * scale,
            z: t.z + (pos.z - t.z) * scale,
          },
          { x: t.x, y: t.y, z: t.z },
          500
        );
      } catch {
        /* ignore */
      }
    }, 260);
    return () => clearTimeout(id);
  }, [graphInsets.top, graphInsets.right, graphInsets.bottom, graphInsets.left]);

  return (
    <div className="app">
      <div
        className="graph-area"
        style={{
          top: graphInsets.top,
          right: graphInsets.right,
          bottom: graphInsets.bottom,
          left: graphInsets.left,
        }}
      >
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
      </div>

      <Controls
        ref={controlsRef}
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
        ref={sidePanelRef}
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        getStatus={getStatus}
        setStatus={setStatus}
        onShowLearningPath={handleShowLearningPath}
      />
    </div>
  );
}
