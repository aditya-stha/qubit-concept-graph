import React, { useState } from "react";
import { CATEGORIES } from "./data/graph.js";
import { STATUSES, STATUS_COLORS } from "./useProgress.js";

const STATUS_LABEL = {
  "not-started": "Not started",
  "learning": "Learning",
  "understood": "Understood",
};

export default function Controls({
  searchQuery,
  setSearchQuery,
  searchInputRef,
  hiddenCategories,
  toggleCategory,
  hiddenStatuses,
  toggleStatus,
  totals,
  onFit,
  onReset,
  onExport,
  onClearPath,
  pathActive,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`controls ${open ? "is-open" : ""}`}>
      <header>
        <h1>Quantum Hardware Observatory</h1>
        <p className="subtitle">Concept Graph · learning tracker</p>
        <button
          className="controls-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Collapse controls" : "Expand controls"}
          aria-expanded={open}
        >
          {open ? "▲" : "▼"}
        </button>
      </header>

      <div className="controls-body">
      <div className="control-block">
        <label className="control-label" htmlFor="search">Search</label>
        <input
          id="search"
          ref={searchInputRef}
          className="search"
          placeholder="Try: T1, Marchenko, MST… ( / to focus )"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="control-block">
        <div className="control-label">
          Progress{" "}
          <span className="muted">
            {totals.understood} / {totals.all} understood ·{" "}
            {totals.learning} learning
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill understood"
            style={{ width: `${(totals.understood / totals.all) * 100}%` }}
          />
          <div
            className="progress-fill learning"
            style={{
              width: `${(totals.learning / totals.all) * 100}%`,
              left: `${(totals.understood / totals.all) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="control-block">
        <div className="control-label">Filter by category</div>
        <div className="chip-row">
          {Object.entries(CATEGORIES).map(([key, val]) => {
            const active = !hiddenCategories.has(key);
            return (
              <button
                key={key}
                className={`chip ${active ? "active" : ""}`}
                onClick={() => toggleCategory(key)}
                style={{
                  borderColor: val.color,
                  background: active ? val.color : "transparent",
                  color: active ? "#0b0f1a" : val.color,
                }}
              >
                {val.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="control-block">
        <div className="control-label">Filter by status</div>
        <div className="chip-row">
          {STATUSES.map((s) => {
            const active = !hiddenStatuses.has(s);
            return (
              <button
                key={s}
                className={`chip ${active ? "active" : ""}`}
                onClick={() => toggleStatus(s)}
                style={{
                  borderColor: STATUS_COLORS[s],
                  background: active ? STATUS_COLORS[s] : "transparent",
                  color: active ? "#0b0f1a" : STATUS_COLORS[s],
                }}
              >
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="control-block button-row">
        <button className="action-btn" onClick={onFit}>Fit to view</button>
        {pathActive && (
          <button className="action-btn" onClick={onClearPath}>Clear path</button>
        )}
        <button className="action-btn" onClick={onExport}>Export JSON</button>
        <button className="action-btn danger" onClick={onReset}>Reset progress</button>
      </div>
      </div>
    </div>
  );
}
