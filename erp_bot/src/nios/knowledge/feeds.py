"""Structured federation feeds — NEPSE, IRD, NRB, SEBON (cacheable, refreshable)."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# Authoritative bootstrap feeds (replaceable via refresh_feeds or env file)
NEPSE_FEED: dict[str, dict[str, Any]] = {
    "NABIL": {"ltp": 628.0, "pe": 14.3, "eps": 44.0, "sector": "Commercial Bank", "change_pct": 0.48},
    "NICA": {"ltp": 782.0, "pe": 16.0, "eps": 48.8, "sector": "Commercial Bank", "change_pct": 0.26},
    "HIDCL": {"ltp": 298.0, "pe": 22.4, "eps": 13.3, "sector": "Hydropower", "change_pct": 1.02},
    "UPPER": {"ltp": 412.0, "pe": 17.8, "eps": 23.1, "sector": "Hydropower", "change_pct": 0.49},
    "NRIC": {"ltp": 518.0, "pe": 12.9, "eps": 40.2, "sector": "Insurance", "change_pct": -0.38},
    "GBIME": {"ltp": 245.0, "pe": 11.5, "eps": 21.3, "sector": "Development Bank", "change_pct": 0.82},
    "NHPC": {"ltp": 198.0, "pe": 19.2, "eps": 10.3, "sector": "Hydropower", "change_pct": 1.54},
}

GOV_FEED: list[dict[str, Any]] = [
    {
        "authority": "IRD",
        "source": "ird.gov.np",
        "topic": "vat",
        "text": "IRD Nepal: VAT standard rate 13% on taxable supplies (VAT Act 2052, Section 7).",
        "effective": "2080-07-16",
        "jurisdiction": "NP",
    },
    {
        "authority": "IRD",
        "source": "ird.gov.np",
        "topic": "income_tax",
        "text": "IRD: Individual income tax slabs FY 2081/82 — 1% to 39% progressive (Finance Act).",
        "effective": "2081-04-01",
        "jurisdiction": "NP",
    },
    {
        "authority": "NRB",
        "source": "nrb.org.np",
        "topic": "monetary",
        "text": "NRB: Bank rate 6.5%; CRR 4.5%; SLR 10% (Monetary Policy 2081).",
        "effective": "2081-07-01",
        "jurisdiction": "NP",
    },
    {
        "authority": "SEBON",
        "source": "sebon.gov.np",
        "topic": "securities",
        "text": "SEBON: Listed companies must file quarterly reports within 35 days of quarter end.",
        "effective": "2079-01-01",
        "jurisdiction": "NP",
    },
    {
        "authority": "IRD",
        "source": "ird.gov.np",
        "topic": "cbms",
        "text": "IRD CBMS: Real-time invoice reporting mandatory for VAT-registered businesses.",
        "effective": "2080-01-01",
        "jurisdiction": "NP",
    },
]


def _feed_cache_path() -> Path:
    data_dir = Path(os.getenv("NIOS_DATA_DIR", "data"))
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "nios_feeds.json"


def load_feeds() -> dict[str, Any]:
    """Load feeds from cache file or bootstrap."""
    path = _feed_cache_path()
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            pass
    return {"nepse": NEPSE_FEED, "gov": GOV_FEED, "updated_at": _now()}


def save_feeds(feeds: dict[str, Any]) -> None:
    feeds["updated_at"] = _now()
    _feed_cache_path().write_text(json.dumps(feeds, indent=2))


def refresh_feeds(*, live: bool = True) -> dict[str, Any]:
    """Refresh feed cache — tries live URL then merges with bootstrap."""
    nepse = dict(NEPSE_FEED)
    gov = list(GOV_FEED)
    source = "bootstrap"

    if live:
        live_nepse = _fetch_live_nepse()
        if live_nepse:
            nepse.update(live_nepse)
            source = "live+nepse"
        live_gov = _fetch_live_gov()
        if live_gov:
            gov = _merge_gov(gov, live_gov)
            source = "live" if source == "live+nepse" else "live+gov"

    feeds = {"nepse": nepse, "gov": gov, "updated_at": _now(), "source": source}
    save_feeds(feeds)
    return feeds


def _fetch_live_nepse() -> dict[str, dict[str, Any]] | None:
    """Fetch NEPSE quotes from configured JSON endpoint."""
    import urllib.error
    import urllib.request

    url = os.getenv("NIOS_NEPSE_FEED_URL", "").strip()
    if not url:
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NIOS/3.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
        return _normalize_nepse_payload(data)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None


def _normalize_nepse_payload(data: Any) -> dict[str, dict[str, Any]] | None:
    """Accept {SYMBOL: {ltp, pe, ...}} or [{symbol, ltp, ...}]."""
    out: dict[str, dict[str, Any]] = {}
    if isinstance(data, dict):
        for sym, val in data.items():
            if isinstance(val, dict) and "ltp" in val:
                out[str(sym).upper()] = val
    elif isinstance(data, list):
        for row in data:
            if not isinstance(row, dict):
                continue
            sym = str(row.get("symbol") or row.get("scrip") or "").upper()
            ltp = row.get("ltp") or row.get("close") or row.get("lastTradedPrice")
            if sym and ltp is not None:
                out[sym] = {
                    "ltp": float(ltp),
                    "pe": float(row.get("pe", row.get("peRatio", 0)) or 0),
                    "eps": float(row.get("eps", 0) or 0),
                    "sector": str(row.get("sector", "Unknown")),
                    "change_pct": float(row.get("change_pct", row.get("percentageChange", 0)) or 0),
                }
    return out or None


def _fetch_live_gov() -> list[dict[str, Any]] | None:
    """Fetch gov notices from configured JSON endpoint."""
    import urllib.error
    import urllib.request

    url = os.getenv("NIOS_GOV_FEED_URL", "").strip()
    if not url:
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NIOS/3.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
        if isinstance(data, list):
            return [d for d in data if isinstance(d, dict) and d.get("text")]
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None
    return None


def _merge_gov(base: list[dict[str, Any]], live: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = {(g.get("authority"), g.get("topic")) for g in base}
    merged = list(base)
    for item in live:
        key = (item.get("authority"), item.get("topic"))
        if key not in seen:
            merged.append(item)
            seen.add(key)
    return merged


def nepse_quote(symbol: str) -> dict[str, Any] | None:
    feeds = load_feeds()
    quote = feeds.get("nepse", {}).get(symbol.upper())
    if quote:
        return {**quote, "symbol": symbol.upper(), "as_of": feeds.get("updated_at")}
    return None


def gov_search(query: str, *, topic: str | None = None) -> list[dict[str, Any]]:
    feeds = load_feeds()
    q = query.lower()
    results: list[dict[str, Any]] = []
    for item in feeds.get("gov", []):
        if topic and item.get("topic") != topic:
            continue
        if any(tok in item.get("text", "").lower() for tok in q.split() if len(tok) > 2):
            results.append(item)
        elif topic and item.get("topic") == topic:
            results.append(item)
    if not results and ("vat" in q or "tax" in q):
        results = [g for g in feeds.get("gov", []) if g.get("topic") in ("vat", "income_tax")]
    return results
