import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
import SpriteText from "three-spritetext";
import { CATEGORIES, LINK_STYLES } from "./data/graph.js";
import { STATUS_COLORS } from "./useProgress.js";

// Build a custom mesh for each node: a colored sphere + a status ring.
// The ring (torus) sits behind the sphere and is colored by learning status,
// giving a glance-readable progress indicator.
function makeNodeObject(node, statusColor, isHighlighted, isDimmed) {
  const group = new THREE.Group();

  const baseColor = new THREE.Color(node._categoryColor || "#cccccc");
  const radius = 3 + (node.importance || 1) * 1.4;

  // Sphere
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 24),
    new THREE.MeshLambertMaterial({
      color: baseColor,
      emissive: isHighlighted ? baseColor : new THREE.Color("#000000"),
      emissiveIntensity: isHighlighted ? 0.6 : 0,
      transparent: true,
      opacity: isDimmed ? 0.15 : 1,
    })
  );
  group.add(sphere);

  // Status ring (torus)
  const ringRadius = radius + 1.8;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(ringRadius, 0.55, 12, 36),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(statusColor),
      transparent: true,
      opacity: isDimmed ? 0.15 : 0.95,
    })
  );
  group.add(ring);

  // Label
  const sprite = new SpriteText(node.label);
  sprite.color = "#f4f7fb";
  sprite.backgroundColor = "rgba(11,15,26,0.55)";
  sprite.padding = 1.5;
  sprite.borderRadius = 2;
  sprite.textHeight = 3.2 + (node.importance || 1) * 0.25;
  sprite.position.set(0, radius + 4.5, 0);
  sprite.material.opacity = isDimmed ? 0.25 : 1;
  group.add(sprite);

  return group;
}

export default function Graph3D({
  data,
  hiddenCategories,
  hiddenStatuses,
  getStatus,
  searchQuery,
  selectedNode,
  onSelectNode,
  highlightPath,
  fgRef,
}) {
  const hoverRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 800,
    height: typeof window !== "undefined" ? window.innerHeight : 600,
  }));

  // Track our container size so ForceGraph3D renders into the available area
  // instead of defaulting to the full window.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      setDims((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Filter graph based on category + status filters
  const filtered = useMemo(() => {
    const nodes = data.nodes.filter((n) => {
      if (hiddenCategories.has(n.category)) return false;
      if (hiddenStatuses.has(getStatus(n.id))) return false;
      return true;
    });
    const ids = new Set(nodes.map((n) => n.id));
    const links = data.links.filter(
      (l) =>
        ids.has(typeof l.source === "object" ? l.source.id : l.source) &&
        ids.has(typeof l.target === "object" ? l.target.id : l.target)
    );
    return { nodes, links };
  }, [data, hiddenCategories, hiddenStatuses, getStatus]);

  // Decorate nodes with category color (for sphere)
  useEffect(() => {
    filtered.nodes.forEach((n) => {
      n._categoryColor = CATEGORIES[n.category]?.color || "#cccccc";
    });
  }, [filtered]);

  // Neighbor lookup for hover / highlight
  const neighborMap = useMemo(() => {
    const m = new Map();
    data.nodes.forEach((n) => m.set(n.id, new Set()));
    data.links.forEach((l) => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      m.get(s)?.add(t);
      m.get(t)?.add(s);
    });
    return m;
  }, [data]);

  // Search: focus the matching node
  useEffect(() => {
    if (!searchQuery || !fgRef.current) return;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    const match = filtered.nodes.find(
      (n) =>
        n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q)
    );
    if (match && match.x !== undefined) {
      const dist = 120;
      const dr = Math.hypot(match.x, match.y, match.z) || 1;
      const k = 1 + dist / dr;
      fgRef.current.cameraPosition(
        { x: match.x * k, y: match.y * k, z: match.z * k },
        match,
        1200
      );
    }
  }, [searchQuery, filtered.nodes, fgRef]);

  // Auto-rotate: rotate camera slowly until user interacts.
  const interactedRef = useRef(false);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const controls = fg.controls?.();
    if (!controls) return;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    const stop = () => {
      controls.autoRotate = false;
      interactedRef.current = true;
      controls.removeEventListener("start", stop);
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [fgRef]);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
    <ForceGraph3D
      ref={fgRef}
      width={dims.width}
      height={dims.height}
      graphData={filtered}
      backgroundColor="#0b0f1a"
      showNavInfo={false}
      nodeRelSize={1}
      nodeThreeObject={(node) => {
        const status = getStatus(node.id);
        const statusColor = STATUS_COLORS[status];

        // Determine highlight / dim relative to hover or selection
        const focusId =
          hoverRef.current || (selectedNode && selectedNode.id) || null;
        let isHighlighted = false;
        let isDimmed = false;
        if (focusId) {
          const neigh = neighborMap.get(focusId);
          if (node.id === focusId) isHighlighted = true;
          else if (neigh && neigh.has(node.id)) isHighlighted = true;
          else isDimmed = true;
        }
        if (highlightPath && highlightPath.size > 0) {
          if (highlightPath.has(node.id)) isHighlighted = true;
          else isDimmed = true;
        }

        return makeNodeObject(node, statusColor, isHighlighted, isDimmed);
      }}
      nodeThreeObjectExtend={false}
      linkColor={(l) => LINK_STYLES[l.type]?.color || "#888"}
      linkOpacity={0.8}
      linkWidth={(l) => {
        const focusId =
          hoverRef.current || (selectedNode && selectedNode.id) || null;
        if (focusId) {
          const s = typeof l.source === "object" ? l.source.id : l.source;
          const t = typeof l.target === "object" ? l.target.id : l.target;
          if (s === focusId || t === focusId) return 2.5;
          return 0.4;
        }
        return l.type === "analogous-to" ? 0.6 : 1.2;
      }}
      linkDirectionalParticles={(l) =>
        LINK_STYLES[l.type]?.particles ?? 0
      }
      linkDirectionalParticleWidth={1.4}
      linkDirectionalParticleSpeed={0.006}
      onNodeHover={(node) => {
        hoverRef.current = node ? node.id : null;
        // force redraw of node objects
        if (fgRef.current) fgRef.current.refresh();
        document.body.style.cursor = node ? "pointer" : "default";
      }}
      onNodeClick={(node) => {
        onSelectNode(node);
        if (fgRef.current && node.x !== undefined) {
          const dist = 100;
          const dr = Math.hypot(node.x, node.y, node.z) || 1;
          const k = 1 + dist / dr;
          fgRef.current.cameraPosition(
            { x: node.x * k, y: node.y * k, z: node.z * k },
            node,
            900
          );
        }
      }}
      onBackgroundClick={() => onSelectNode(null)}
    />
    </div>
  );
}
