import React, { useMemo } from "react";
import { CATEGORIES, LINKS, NODES } from "./data/graph.js";
import { STATUSES } from "./useProgress.js";

const STATUS_LABEL = {
  "not-started": "Not started",
  "learning": "Learning",
  "understood": "Understood",
};

export default function SidePanel({
  node,
  onClose,
  getStatus,
  setStatus,
  onShowLearningPath,
}) {
  if (!node) return null;

  const cat = CATEGORIES[node.category];
  const status = getStatus(node.id);

  // Compute incoming / outgoing relationships
  const { incoming, outgoing } = useMemo(() => {
    const inc = [];
    const out = [];
    LINKS.forEach((l) => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      if (s === node.id) out.push({ id: t, type: l.type });
      if (t === node.id) inc.push({ id: s, type: l.type });
    });
    return { incoming: inc, outgoing: out };
  }, [node.id]);

  const lookup = (id) => NODES.find((n) => n.id === id);

  return (
    <aside className="side-panel" onClick={(e) => e.stopPropagation()}>
      <button className="close-btn" onClick={onClose} aria-label="Close">×</button>

      <div className="cat-badge" style={{ background: cat?.color }}>
        {cat?.label}
      </div>
      <h2 className="node-title">{node.label}</h2>

      <div className="importance">
        <span className="muted">Importance</span>{" "}
        {"★".repeat(node.importance)}
        <span className="muted">{"★".repeat(5 - node.importance)}</span>
      </div>

      <section>
        <h3>What it is</h3>
        <p>{node.description}</p>
      </section>

      <section>
        <h3>In this project</h3>
        <p>{node.projectUse}</p>
      </section>

      <section>
        <h3>Learning status</h3>
        <div className="status-row">
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`status-btn ${s} ${status === s ? "active" : ""}`}
              onClick={() => setStatus(node.id, s)}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <button
          className="path-btn"
          onClick={() => onShowLearningPath(node.id)}
          title="Highlight all depends-on prerequisites"
        >
          Show learning path to here
        </button>
      </section>

      {(incoming.length > 0 || outgoing.length > 0) && (
        <section>
          <h3>Connections</h3>
          {incoming.length > 0 && (
            <>
              <h4>Depends on / feeds in</h4>
              <ul className="conn-list">
                {incoming.map((c) => {
                  const n = lookup(c.id);
                  return (
                    <li key={`in-${c.id}`}>
                      <span
                        className="conn-dot"
                        style={{ background: CATEGORIES[n?.category]?.color }}
                      />
                      <span>{n?.label || c.id}</span>
                      <span className="rel-tag">{c.type}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {outgoing.length > 0 && (
            <>
              <h4>Leads to / supports</h4>
              <ul className="conn-list">
                {outgoing.map((c) => {
                  const n = lookup(c.id);
                  return (
                    <li key={`out-${c.id}`}>
                      <span
                        className="conn-dot"
                        style={{ background: CATEGORIES[n?.category]?.color }}
                      />
                      <span>{n?.label || c.id}</span>
                      <span className="rel-tag">{c.type}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}
    </aside>
  );
}
