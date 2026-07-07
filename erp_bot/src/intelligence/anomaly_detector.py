"""Financial anomaly detection for e-Khata entries."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from ..reasoning.accounting_reasoner import JournalEntry


@dataclass
class Anomaly:
    severity: str
    type: str
    message: str
    suggestion: str = ""


_detector: "AnomalyDetector | None" = None


def get_anomaly_detector() -> "AnomalyDetector":
    global _detector
    if _detector is None:
        _detector = AnomalyDetector()
    return _detector


class AnomalyDetector:
    """Background checks after each entry."""

    def scan_sync(self, entry: JournalEntry, all_entries: list[dict[str, Any]]) -> list[Anomaly]:
        """Synchronous wrapper for use from the conversation manager."""
        import asyncio
        import concurrent.futures

        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(self.scan(entry, all_entries))

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(asyncio.run, self.scan(entry, all_entries)).result()

    async def scan(self, entry: JournalEntry, all_entries: list[dict[str, Any]]) -> list[Anomaly]:
        anomalies: list[Anomaly] = []
        for check_name in (
            "duplicate_same_day",
            "amount_outlier",
            "cash_drain",
            "receivable_aging",
        ):
            check_fn = getattr(self, f"_check_{check_name}", None)
            if check_fn:
                result = await check_fn(entry, all_entries)
                if result:
                    anomalies.append(result)
        return anomalies

    async def _check_duplicate_same_day(
        self,
        entry: JournalEntry,
        all_entries: list[dict[str, Any]],
    ) -> Anomaly | None:
        today = datetime.now().strftime("%Y-%m-%d")
        for e in all_entries:
            if (
                e.get("date") == today
                and e.get("party") == entry.party
                and abs(float(e.get("amount", 0)) - float(entry.amount)) < 0.01
                and e.get("intent") == entry.intent
            ):
                return Anomaly(
                    severity="high",
                    type="duplicate",
                    message=(
                        f"Duplicate entry: {entry.party} Rs {entry.amount:,.0f} "
                        f"({entry.intent}) already posted today."
                    ),
                    suggestion="Verify before confirming.",
                )
        return None

    async def _check_amount_outlier(
        self,
        entry: JournalEntry,
        all_entries: list[dict[str, Any]],
    ) -> Anomaly | None:
        if not entry.party:
            return None
        amounts = [
            float(e.get("amount", 0))
            for e in all_entries
            if e.get("party") == entry.party and e.get("amount")
        ]
        if len(amounts) < 3:
            return None
        avg = sum(amounts) / len(amounts)
        if float(entry.amount) > avg * 5:
            return Anomaly(
                severity="medium",
                type="outlier",
                message=f"Amount Rs {entry.amount:,.0f} is unusually high for {entry.party} (avg Rs {avg:,.0f}).",
                suggestion="Double-check the amount.",
            )
        return None

    async def _check_cash_drain(
        self,
        entry: JournalEntry,
        all_entries: list[dict[str, Any]],
    ) -> Anomaly | None:
        del all_entries
        cash_out = sum(l.credit for l in entry.lines if l.account == "KH-CASH")
        if cash_out > 50000:
            return Anomaly(
                severity="medium",
                type="cash_drain",
                message=f"Large cash payment: Rs {cash_out:,.0f}.",
                suggestion="Confirm cash on hand is sufficient.",
            )
        return None

    async def _check_receivable_aging(
        self,
        entry: JournalEntry,
        all_entries: list[dict[str, Any]],
    ) -> Anomaly | None:
        if entry.intent not in ("credit_sale", "khata_credit_sale"):
            return None
        if not entry.party:
            return None
        for e in all_entries:
            if e.get("party") != entry.party:
                continue
            if "credit_sale" not in str(e.get("intent", "")):
                continue
            try:
                entry_date = datetime.fromisoformat(str(e.get("date", ""))[:10])
                age = (datetime.now() - entry_date).days
                if age > 90:
                    return Anomaly(
                        severity="medium",
                        type="aging",
                        message=(
                            f"{entry.party} has receivables older than {age} days. "
                            f"Consider collection before more credit."
                        ),
                    )
            except ValueError:
                continue
        return None
