#!/usr/bin/env python3
"""Annotate priority review queue with machine suggestions + generate HTML review lab.

Suggestions are assistive only — they never count as human approval.
"""

from __future__ import annotations

import argparse
import csv
import html
import io
import json
import sys
from pathlib import Path
from typing import Any

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from kb_common import (  # noqa: E402
    REPO_ROOT,
    atomic_write_text,
    load_config,
    setup_logging,
    utc_now_iso,
)

logger = setup_logging("build_review_lab")


def suggest(row: dict[str, Any]) -> tuple[str, str]:
    """Return (suggested_decision, rationale). Not human approval."""
    hits = str(row.get("priority_hits") or "").casefold()
    exec_allowed = row.get("execution_allowed") in (True, "true", "True", 1, "1")
    if exec_allowed:
        return "reject", "KB row asserts execution_allowed=true — reject until corrected"
    if any(k in hits for k in ("tenant", "cross-tenant", "legal_hold", "legal hold", "privacy")):
        return "needs_clarification", "High-governance surface — human mandatory"
    if any(k in hits for k in ("destructive", "mutation", "authorization", "maker", "checker")):
        return "needs_clarification", "Mutation/auth risk — human mandatory"
    if any(k in hits for k in ("payroll", "salary", "vat", "tds", "tax")):
        return "needs_clarification", "Statutory/payroll/tax — human mandatory"
    if row.get("safety_correct") == "pass_structural" and row.get("raw_input"):
        return "defer", "Structural safety OK; language/intent still need human judgment"
    return "defer", "Insufficient signals; defer to human"


def build_html(rows: list[dict[str, Any]]) -> str:
    payload = json.dumps(rows, ensure_ascii=False)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>ONLI Priority Review Lab</title>
<style>
  :root {{ font-family: Segoe UI, sans-serif; color: #1f2937; }}
  body {{ margin: 0; background: #f5f6fa; }}
  header {{ background:#1e2433; color:#fff; padding:12px 16px; }}
  header h1 {{ margin:0; font-size:15px; }}
  header p {{ margin:4px 0 0; font-size:11px; opacity:.85; }}
  .bar {{ display:flex; gap:8px; padding:10px 16px; background:#fff; border-bottom:1px solid #e5e7eb; align-items:center; flex-wrap:wrap; }}
  .bar button, .bar select {{ height:32px; font-size:12px; }}
  .primary {{ background:#1557b0; color:#fff; border:0; padding:0 12px; border-radius:6px; cursor:pointer; }}
  .outline {{ background:#fff; border:1px solid #d1d5db; padding:0 12px; border-radius:6px; cursor:pointer; }}
  main {{ display:grid; grid-template-columns: 280px 1fr; min-height: calc(100vh - 110px); }}
  .list {{ overflow:auto; background:#fff; border-right:1px solid #e5e7eb; }}
  .item {{ padding:8px 10px; border-bottom:1px solid #f3f4f6; cursor:pointer; font-size:12px; }}
  .item.active {{ background:#eef2ff; }}
  .item .rid {{ font-family: ui-monospace, monospace; font-size:10px; color:#6b7280; }}
  .pane {{ padding:16px; overflow:auto; }}
  .card {{ background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:14px; }}
  label {{ display:block; font-size:11px; font-weight:600; color:#4b5563; margin-top:10px; }}
  input, select, textarea {{ width:100%; box-sizing:border-box; margin-top:4px; font-size:12px; padding:6px 8px; border:1px solid #d1d5db; border-radius:6px; }}
  textarea {{ min-height:70px; }}
  .warn {{ background:#fffbeb; border:1px solid #fde68a; color:#92400e; padding:8px 10px; border-radius:6px; font-size:11px; margin-bottom:10px; }}
  .meta {{ font-size:12px; color:#374151; white-space:pre-wrap; background:#f9fafb; padding:8px; border-radius:6px; }}
</style>
</head>
<body>
<header>
  <h1>ONLI Priority Review Lab</h1>
  <p>Machine suggestions are assistive only. Filling a decision here does not equal production approval.</p>
</header>
<div class="bar">
  <button class="outline" id="prev">Prev</button>
  <button class="outline" id="next">Next</button>
  <span id="progress" style="font-size:12px"></span>
  <select id="filter">
    <option value="all">All</option>
    <option value="undecided">Undecided</option>
    <option value="decided">Decided</option>
  </select>
  <button class="primary" id="export">Export decisions CSV</button>
  <button class="outline" id="acceptSug">Accept suggestion</button>
</div>
<main>
  <div class="list" id="list"></div>
  <div class="pane">
    <div class="warn">Not human language / accounting / legal / production approval. Export CSV → import_human_reviews.py → apply_review_overlays.py</div>
    <div class="card" id="detail"></div>
  </div>
</main>
<script>
const ROWS = {payload};
let idx = 0;
const decisions = {{}}; // record_id -> decision fields

function visible() {{
  const f = document.getElementById('filter').value;
  return ROWS.map((r,i)=>({{r,i}})).filter(({{r}}) => {{
    const d = decisions[r.record_id]?.review_decision || r.review_decision || '';
    if (f==='undecided') return !d;
    if (f==='decided') return !!d;
    return true;
  }});
}}

function renderList() {{
  const list = document.getElementById('list');
  list.innerHTML = '';
  for (const {{r,i}} of visible()) {{
    const d = decisions[r.record_id]?.review_decision || r.review_decision || '';
    const el = document.createElement('div');
    el.className = 'item' + (i===idx?' active':'');
    el.innerHTML = `<div><b>#${{r.priority_rank||''}}</b> ${{escapeHtml((r.raw_input||r.record_id||'').toString().slice(0,60))}}</div>
      <div class="rid">${{escapeHtml(r.record_id||'')}} · ${{d||'—'}}</div>`;
    el.onclick = () => {{ idx=i; render(); }};
    list.appendChild(el);
  }}
  document.getElementById('progress').textContent = `${{Object.keys(decisions).length}} decisions / ${{ROWS.length}} rows`;
}}

function escapeHtml(s) {{
  return s.replace(/[&<>"']/g, c => ({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}}[c]));
}}

function current() {{ return ROWS[idx]; }}

function renderDetail() {{
  const r = current();
  if (!r) return;
  const cur = decisions[r.record_id] || {{}};
  const sug = r.machine_suggested_decision || '';
  document.getElementById('detail').innerHTML = `
    <div class="meta"><b>record_id</b>: ${{escapeHtml(r.record_id||'')}}
source_file_id: ${{escapeHtml(String(r.source_file_id||''))}}
priority_hits: ${{escapeHtml(r.priority_hits||'')}}
suggestion: ${{escapeHtml(sug)}} — ${{escapeHtml(r.machine_suggestion_rationale||'')}}

raw_input:
${{escapeHtml(String(r.raw_input||''))}}

intent: ${{escapeHtml(String(r.intent||''))}}
operation_class: ${{escapeHtml(String(r.operation_class||''))}}
execution_allowed: ${{escapeHtml(String(r.execution_allowed))}}
</div>
    <label>review_decision</label>
    <select id="decision">
      <option value="">(undecided)</option>
      ${{['approve','approve_with_edit','reject','needs_clarification','defer','promote_to_gold'].map(v=>`<option value="${{v}}" ${{(cur.review_decision||r.review_decision||'')===v?'selected':''}}>${{v}}</option>`).join('')}}
    </select>
    <label>language_naturalness (1-5 or note)</label>
    <input id="lang" value="${{escapeHtml(cur.language_naturalness||r.language_naturalness||'')}}" />
    <label>intent_correct (yes/no/unsure)</label>
    <input id="intentc" value="${{escapeHtml(cur.intent_correct||r.intent_correct||'')}}" />
    <label>accounting_correct (yes/no/unsure)</label>
    <input id="acct" value="${{escapeHtml(cur.accounting_correct||r.accounting_correct||'')}}" />
    <label>safety_correct</label>
    <input id="safe" value="${{escapeHtml(cur.safety_correct||r.safety_correct||'')}}" />
    <label>reviewer_notes</label>
    <textarea id="notes">${{escapeHtml(cur.reviewer_notes||r.reviewer_notes||'')}}</textarea>
    <label>reviewer_name</label>
    <input id="name" value="${{escapeHtml(cur.reviewer_name||r.reviewer_name||'')}}" />
    <div style="margin-top:10px; display:flex; gap:8px;">
      <button class="primary" id="save">Save decision</button>
    </div>
  `;
  document.getElementById('save').onclick = saveCurrent;
}}

function saveCurrent() {{
  const r = current();
  decisions[r.record_id] = {{
    review_id: r.review_id,
    record_id: r.record_id,
    source_file_id: r.source_file_id,
    review_decision: document.getElementById('decision').value,
    language_naturalness: document.getElementById('lang').value,
    intent_correct: document.getElementById('intentc').value,
    accounting_correct: document.getElementById('acct').value,
    safety_correct: document.getElementById('safe').value,
    reviewer_notes: document.getElementById('notes').value,
    reviewer_name: document.getElementById('name').value,
    reviewed_at: new Date().toISOString(),
    review_status: document.getElementById('decision').value || 'pending'
  }};
  renderList();
}}

function render() {{ renderList(); renderDetail(); }}

document.getElementById('prev').onclick = () => {{ idx=Math.max(0,idx-1); render(); }};
document.getElementById('next').onclick = () => {{ idx=Math.min(ROWS.length-1,idx+1); render(); }};
document.getElementById('filter').onchange = () => renderList();
document.getElementById('acceptSug').onclick = () => {{
  const r = current();
  if (!r.machine_suggested_decision) return;
  document.getElementById('decision').value = r.machine_suggested_decision;
  saveCurrent();
}};
document.getElementById('export').onclick = () => {{
  const fields = ['review_id','record_id','source_file_id','review_decision','language_naturalness','intent_correct','accounting_correct','safety_correct','reviewer_notes','reviewer_name','reviewed_at','review_status'];
  const lines = [fields.join(',')];
  for (const d of Object.values(decisions)) {{
    if (!d.review_decision) continue;
    lines.push(fields.map(f => csvEsc(d[f]||'')).join(','));
  }}
  const blob = new Blob([lines.join('\\n')], {{type:'text/csv'}});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'priority_review_decisions.csv';
  a.click();
}};
function csvEsc(v) {{
  const s = String(v).replace(/"/g,'""');
  return /[",\\n]/.test(s) ? `"${{s}}"` : s;
}}
render();
</script>
</body>
</html>
"""


def main(argv: list[str] | None = None) -> int:
    cfg = load_config()
    p = argparse.ArgumentParser(description="Build review lab + suggestions")
    p.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    args = p.parse_args(argv)
    repo = args.repo_root.resolve()
    out_dir = repo / cfg["paths"]["review_ready_dir"]
    src = out_dir / "priority_review_queue.jsonl"
    if not src.exists():
        logger.error("Missing %s — run export_priority_review_queue.py first", src)
        return 1

    rows: list[dict[str, Any]] = []
    for line in src.open(encoding="utf-8"):
        if not line.strip():
            continue
        row = json.loads(line)
        sug, rationale = suggest(row)
        row["machine_suggested_decision"] = sug
        row["machine_suggestion_rationale"] = rationale
        # Never auto-fill review_decision
        row.setdefault("review_decision", "")
        rows.append(row)

    with src.open("w", encoding="utf-8", newline="\n") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")

    # refresh CSV with suggestion columns
    fields = [
        "priority_rank",
        "priority_hits",
        "machine_suggested_decision",
        "machine_suggestion_rationale",
        "review_id",
        "source_file_id",
        "record_id",
        "domain",
        "language_form",
        "raw_input",
        "intent",
        "operation_class",
        "execution_allowed",
        "quality_score",
        "safety_correct",
        "language_naturalness",
        "intent_correct",
        "accounting_correct",
        "review_decision",
        "review_status",
        "reviewer_notes",
        "reviewer_name",
        "reviewed_at",
    ]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for row in rows:
        w.writerow(row)
    atomic_write_text(out_dir / "priority_review_queue.csv", buf.getvalue())

    lab = out_dir / "priority_review_lab.html"
    atomic_write_text(lab, build_html(rows))

    summary = {
        "generated_at": utc_now_iso(),
        "rows": len(rows),
        "suggestion_counts": {},
        "lab": str(lab.relative_to(repo).as_posix()),
        "disclaimer": "Suggestions are assistive only; not human approval.",
    }
    from collections import Counter

    summary["suggestion_counts"] = dict(
        Counter(r["machine_suggested_decision"] for r in rows)
    )
    atomic_write_text(
        out_dir / "priority_review_lab_summary.json",
        json.dumps(summary, indent=2) + "\n",
    )
    logger.info("Lab ready: %s", lab)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
