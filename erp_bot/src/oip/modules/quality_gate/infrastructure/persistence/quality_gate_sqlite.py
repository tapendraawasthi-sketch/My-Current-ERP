"""SQLite quality gate repository."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import aiosqlite

from ...application.ports.quality_repository_port import QualityRepositoryPort, QualityRuleRepositoryPort
from ...application.read_models.quality_gate_read_models import QualityMetricsReadModel
from ...domain.entities import QualityEvaluation
from ...domain.value_objects import (
    EvaluationStatus,
    ExecutionResultSnapshot,
    FindingSeverity,
    GateRunStatus,
    QualityBudget,
    QualityDecision,
    QualityDecisionOutcome,
    QualityEvidence,
    QualityFinding,
    QualityGateRun,
    QualityLevel,
    QualityRecommendation,
    QualityRisk,
    QualityRule,
    QualityScore,
    QualityViolation,
    ViolationKind,
)


def _utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _parse_dt(value: str | None):
    if not value:
        return None
    return datetime.fromisoformat(value)


DEFAULT_RULES: tuple[QualityRule, ...] = (
    QualityRule(rule_id="r-l0-tenant", rule_code="l0.tenant_exists", level=QualityLevel.L0, name="Tenant Exists", mandatory=True),
    QualityRule(rule_id="r-l0-company", rule_code="l0.company_exists", level=QualityLevel.L0, name="Company Exists", mandatory=True),
    QualityRule(rule_id="r-l0-branch", rule_code="l0.branch_exists", level=QualityLevel.L0, name="Branch Exists", mandatory=True),
    QualityRule(rule_id="r-l0-currency", rule_code="l0.currency_exists", level=QualityLevel.L0, name="Currency Exists", mandatory=True),
    QualityRule(rule_id="r-l0-fiscal", rule_code="l0.fiscal_period_open", level=QualityLevel.L0, name="Fiscal Period Open", mandatory=True),
    QualityRule(rule_id="r-l0-account", rule_code="l0.account_exists", level=QualityLevel.L0, name="Account Exists", mandatory=True),
    QualityRule(rule_id="r-l0-journal", rule_code="l0.journal_balance", level=QualityLevel.L0, name="Journal Balance", mandatory=True),
    QualityRule(rule_id="r-l0-schema", rule_code="l0.schema_validation", level=QualityLevel.L0, name="Schema Validation", mandatory=True),
    QualityRule(rule_id="r-l0-required", rule_code="l0.required_fields", level=QualityLevel.L0, name="Required Fields", mandatory=True),
    QualityRule(rule_id="r-l1-vat", rule_code="l1.vat_rules", level=QualityLevel.L1, name="VAT Rules", mandatory=True),
    QualityRule(rule_id="r-l1-tds", rule_code="l1.tds_rules", level=QualityLevel.L1, name="TDS Rules", mandatory=True),
    QualityRule(rule_id="r-l1-ssf", rule_code="l1.ssf_rules", level=QualityLevel.L1, name="SSF Rules", mandatory=True),
    QualityRule(rule_id="r-l1-inventory", rule_code="l1.inventory_availability", level=QualityLevel.L1, name="Inventory Availability", mandatory=True),
    QualityRule(rule_id="r-l1-payroll", rule_code="l1.payroll_constraints", level=QualityLevel.L1, name="Payroll Constraints", mandatory=True),
    QualityRule(rule_id="r-l1-approval", rule_code="l1.approval_matrix", level=QualityLevel.L1, name="Approval Matrix", mandatory=True),
    QualityRule(rule_id="r-l1-budget", rule_code="l1.budget_limits", level=QualityLevel.L1, name="Budget Limits", mandatory=True),
    QualityRule(rule_id="r-l1-policy", rule_code="l1.accounting_policy", level=QualityLevel.L1, name="Accounting Policy", mandatory=True),
    QualityRule(rule_id="r-l1-jurisdiction", rule_code="l1.jurisdiction_rules", level=QualityLevel.L1, name="Jurisdiction Rules", mandatory=True),
    QualityRule(rule_id="r-l2-snapshot", rule_code="l2.snapshot_ttl", level=QualityLevel.L2, name="Snapshot TTL", mandatory=True),
    QualityRule(rule_id="r-l2-authority", rule_code="l2.knowledge_authority", level=QualityLevel.L2, name="Knowledge Authority", mandatory=True),
    QualityRule(rule_id="r-l2-freshness", rule_code="l2.knowledge_freshness", level=QualityLevel.L2, name="Knowledge Freshness", mandatory=True),
    QualityRule(rule_id="r-l2-evidence", rule_code="l2.evidence_completeness", level=QualityLevel.L2, name="Evidence Completeness", mandatory=True),
    QualityRule(rule_id="r-l2-hash", rule_code="l2.hash_verification", level=QualityLevel.L2, name="Hash Verification", mandatory=True),
    QualityRule(rule_id="r-l3-hallucination", rule_code="l3.hallucination_detection", level=QualityLevel.L3, name="Hallucination Detection", mandatory=False),
    QualityRule(rule_id="r-l3-consistency", rule_code="l3.consistency", level=QualityLevel.L3, name="Consistency", mandatory=False),
    QualityRule(rule_id="r-l3-reasoning", rule_code="l3.reasoning_completeness", level=QualityLevel.L3, name="Reasoning Completeness", mandatory=False),
    QualityRule(rule_id="r-l3-tools", rule_code="l3.tool_result_agreement", level=QualityLevel.L3, name="Tool Result Agreement", mandatory=False),
    QualityRule(rule_id="r-l3-confidence", rule_code="l3.response_confidence", level=QualityLevel.L3, name="Response Confidence", mandatory=False),
)


class SqliteQualityRepositoryAdapter(QualityRepositoryPort, QualityRuleRepositoryPort):
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn
        self._rules_seeded = False

    async def _ensure_rules(self) -> None:
        if self._rules_seeded:
            return
        now = datetime.now(timezone.utc).isoformat()
        for rule in DEFAULT_RULES:
            await self._conn.execute(
                """
                INSERT OR IGNORE INTO oip_quality_rules (
                    rule_id, rule_code, level, name, description, mandatory, enabled,
                    jurisdiction, metadata_json, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rule.rule_id,
                    rule.rule_code,
                    rule.level.value,
                    rule.name,
                    rule.description,
                    int(rule.mandatory),
                    int(rule.enabled),
                    rule.jurisdiction,
                    json.dumps(rule.metadata),
                    now,
                    now,
                ),
            )
        await self._conn.commit()
        self._rules_seeded = True

    async def save(self, evaluation: QualityEvaluation) -> None:
        await self._conn.execute(
            """
            INSERT INTO oip_quality_evaluations (
                evaluation_id, execution_id, route_id, plan_id, request_id, tenant_id,
                company_id, branch_id, conversation_id, correlation_id, status,
                minimum_gate, l3_enabled, execution_result_json, gate_runs_json,
                rules_json, findings_json, violations_json, evidence_json, budget_json,
                risk_json, score_json, recommendations_json, decision_json, metadata_json,
                created_at, updated_at, approved_at, rejected_at, archived_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(evaluation_id) DO UPDATE SET
                status = excluded.status,
                gate_runs_json = excluded.gate_runs_json,
                rules_json = excluded.rules_json,
                findings_json = excluded.findings_json,
                violations_json = excluded.violations_json,
                evidence_json = excluded.evidence_json,
                budget_json = excluded.budget_json,
                risk_json = excluded.risk_json,
                score_json = excluded.score_json,
                recommendations_json = excluded.recommendations_json,
                decision_json = excluded.decision_json,
                metadata_json = excluded.metadata_json,
                updated_at = excluded.updated_at,
                approved_at = excluded.approved_at,
                rejected_at = excluded.rejected_at,
                archived_at = excluded.archived_at
            """,
            (
                evaluation.evaluation_id,
                evaluation.execution_id,
                evaluation.route_id,
                evaluation.plan_id,
                evaluation.request_id,
                evaluation.tenant_id,
                evaluation.company_id,
                evaluation.branch_id,
                evaluation.conversation_id,
                evaluation.correlation_id,
                evaluation.status.value,
                evaluation.minimum_gate,
                int(evaluation.l3_enabled),
                json.dumps(evaluation.execution_result.model_dump(mode="json")),
                json.dumps([g.model_dump(mode="json") for g in evaluation.gate_runs]),
                json.dumps([r.model_dump(mode="json") for r in evaluation.rules_evaluated]),
                json.dumps([f.model_dump(mode="json") for f in evaluation.findings]),
                json.dumps([v.model_dump(mode="json") for v in evaluation.violations]),
                json.dumps([e.model_dump(mode="json") for e in evaluation.evidence]),
                json.dumps(evaluation.budget.model_dump(mode="json")) if evaluation.budget else None,
                json.dumps(evaluation.risk.model_dump(mode="json")) if evaluation.risk else None,
                json.dumps(evaluation.score.model_dump(mode="json")) if evaluation.score else None,
                json.dumps([r.model_dump(mode="json") for r in evaluation.recommendations]),
                json.dumps(evaluation.decision.model_dump(mode="json")) if evaluation.decision else None,
                json.dumps(evaluation.metadata),
                evaluation.created_at.isoformat(),
                evaluation.updated_at.isoformat(),
                evaluation.approved_at.isoformat() if evaluation.approved_at else None,
                evaluation.rejected_at.isoformat() if evaluation.rejected_at else None,
                evaluation.archived_at.isoformat() if evaluation.archived_at else None,
            ),
        )
        await self._conn.execute(
            "DELETE FROM oip_quality_findings WHERE evaluation_id = ?",
            (evaluation.evaluation_id,),
        )
        for finding in evaluation.findings:
            await self._conn.execute(
                """
                INSERT INTO oip_quality_findings (
                    finding_id, evaluation_id, tenant_id, rule_id, level, severity,
                    code, message, field_path, violation_kind, metadata_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    finding.finding_id,
                    finding.evaluation_id,
                    evaluation.tenant_id,
                    finding.rule_id,
                    finding.level.value,
                    finding.severity.value,
                    finding.code,
                    finding.message,
                    finding.field_path,
                    finding.violation_kind.value,
                    json.dumps(finding.metadata),
                    finding.created_at,
                ),
            )
        await self._conn.execute(
            "DELETE FROM oip_quality_evidence WHERE evaluation_id = ?",
            (evaluation.evaluation_id,),
        )
        for evidence in evaluation.evidence:
            await self._conn.execute(
                """
                INSERT INTO oip_quality_evidence (
                    evidence_id, evaluation_id, tenant_id, source, authority, content_hash,
                    snapshot_version, effective_date, ttl_seconds, age_seconds, complete,
                    verified, metadata_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    evidence.evidence_id,
                    evidence.evaluation_id,
                    evaluation.tenant_id,
                    evidence.source,
                    evidence.authority,
                    evidence.content_hash,
                    evidence.snapshot_version,
                    evidence.effective_date,
                    evidence.ttl_seconds,
                    evidence.age_seconds,
                    int(evidence.complete),
                    int(evidence.verified),
                    json.dumps(evidence.metadata),
                    evaluation.created_at.isoformat(),
                ),
            )
        if evaluation.risk:
            await self._conn.execute(
                """
                INSERT INTO oip_quality_risks (
                    risk_id, evaluation_id, tenant_id, score, level, factors_json,
                    escalated, metadata_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(evaluation_id) DO UPDATE SET
                    score = excluded.score,
                    level = excluded.level,
                    factors_json = excluded.factors_json,
                    escalated = excluded.escalated,
                    metadata_json = excluded.metadata_json
                """,
                (
                    evaluation.risk.risk_id,
                    evaluation.evaluation_id,
                    evaluation.tenant_id,
                    evaluation.risk.score,
                    evaluation.risk.level,
                    json.dumps(list(evaluation.risk.factors)),
                    int(evaluation.risk.escalated),
                    json.dumps(evaluation.risk.metadata),
                    evaluation.updated_at.isoformat(),
                ),
            )
        await self._conn.commit()

    async def get_by_id(self, *, tenant_id: str, evaluation_id: str) -> QualityEvaluation | None:
        cursor = await self._conn.execute(
            "SELECT * FROM oip_quality_evaluations WHERE tenant_id = ? AND evaluation_id = ?",
            (tenant_id, evaluation_id),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return self._row_to_evaluation(row)

    async def get_by_execution_id(self, *, tenant_id: str, execution_id: str) -> QualityEvaluation | None:
        cursor = await self._conn.execute(
            """
            SELECT * FROM oip_quality_evaluations
            WHERE tenant_id = ? AND execution_id = ?
            ORDER BY created_at DESC LIMIT 1
            """,
            (tenant_id, execution_id),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return self._row_to_evaluation(row)

    async def search(
        self,
        *,
        tenant_id: str,
        request_id: str | None = None,
        conversation_id: str | None = None,
        company_id: str | None = None,
        decision: str | None = None,
        limit: int = 50,
    ) -> tuple[QualityEvaluation, ...]:
        clauses = ["tenant_id = ?"]
        params: list = [tenant_id]
        if request_id:
            clauses.append("request_id = ?")
            params.append(request_id)
        if conversation_id:
            clauses.append("conversation_id = ?")
            params.append(conversation_id)
        if company_id:
            clauses.append("company_id = ?")
            params.append(company_id)
        if decision:
            clauses.append("json_extract(decision_json, '$.outcome') = ?")
            params.append(decision)
        params.append(limit)
        sql = f"""
            SELECT * FROM oip_quality_evaluations
            WHERE {' AND '.join(clauses)}
            ORDER BY created_at DESC
            LIMIT ?
        """
        cursor = await self._conn.execute(sql, params)
        rows = await cursor.fetchall()
        return tuple(self._row_to_evaluation(row) for row in rows)

    async def increment_metrics(
        self,
        *,
        tenant_id: str,
        metric: str,
        decision: str | None = None,
    ) -> None:
        metric_date = _utc_today()
        column_map = {
            "evaluations_started": "evaluations_started",
            "pass": "evaluations_passed",
            "pass_with_warning": "evaluations_pass_with_warning",
            "review_required": "evaluations_review_required",
            "fail": "evaluations_failed",
            "block": "evaluations_blocked",
            "approved": "evaluations_approved",
            "rejected": "evaluations_rejected",
        }
        column = column_map.get(metric, metric)
        await self._conn.execute(
            f"""
            INSERT INTO oip_quality_metrics (tenant_id, metric_date, {column})
            VALUES (?, ?, 1)
            ON CONFLICT(tenant_id, metric_date) DO UPDATE SET
                {column} = {column} + 1
            """,
            (tenant_id, metric_date),
        )
        if decision:
            dec_column = column_map.get(decision)
            if dec_column and dec_column != column:
                await self._conn.execute(
                    f"""
                    INSERT INTO oip_quality_metrics (tenant_id, metric_date, {dec_column})
                    VALUES (?, ?, 1)
                    ON CONFLICT(tenant_id, metric_date) DO UPDATE SET
                        {dec_column} = {dec_column} + 1
                    """,
                    (tenant_id, metric_date),
                )
        await self._conn.commit()

    async def get_metrics(self, *, tenant_id: str, metric_date: str | None = None) -> QualityMetricsReadModel:
        date = metric_date or _utc_today()
        cursor = await self._conn.execute(
            "SELECT * FROM oip_quality_metrics WHERE tenant_id = ? AND metric_date = ?",
            (tenant_id, date),
        )
        row = await cursor.fetchone()
        if row is None:
            return QualityMetricsReadModel(tenant_id=tenant_id, metric_date=date)
        return QualityMetricsReadModel(
            tenant_id=row[0],
            metric_date=row[1],
            evaluations_started=row[2],
            evaluations_passed=row[3],
            evaluations_pass_with_warning=row[4],
            evaluations_review_required=row[5],
            evaluations_failed=row[6],
            evaluations_blocked=row[7],
            evaluations_approved=row[8],
            evaluations_rejected=row[9],
            total_findings=row[10],
            total_warnings=row[11],
            avg_risk_score=row[12],
        )

    async def list_rules(self, *, level: str | None = None, enabled_only: bool = True) -> tuple[QualityRule, ...]:
        await self._ensure_rules()
        clauses = []
        params: list = []
        if level:
            clauses.append("level = ?")
            params.append(level)
        if enabled_only:
            clauses.append("enabled = 1")
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        cursor = await self._conn.execute(
            f"SELECT rule_id, rule_code, level, name, description, mandatory, enabled, jurisdiction, metadata_json FROM oip_quality_rules {where}",
            params,
        )
        rows = await cursor.fetchall()
        return tuple(
            QualityRule(
                rule_id=row[0],
                rule_code=row[1],
                level=QualityLevel(row[2]),
                name=row[3],
                description=row[4],
                mandatory=bool(row[5]),
                enabled=bool(row[6]),
                jurisdiction=row[7],
                metadata=json.loads(row[8] or "{}"),
            )
            for row in rows
        )

    async def get_rule(self, *, rule_code: str) -> QualityRule | None:
        await self._ensure_rules()
        cursor = await self._conn.execute(
            "SELECT rule_id, rule_code, level, name, description, mandatory, enabled, jurisdiction, metadata_json FROM oip_quality_rules WHERE rule_code = ?",
            (rule_code,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return QualityRule(
            rule_id=row[0],
            rule_code=row[1],
            level=QualityLevel(row[2]),
            name=row[3],
            description=row[4],
            mandatory=bool(row[5]),
            enabled=bool(row[6]),
            jurisdiction=row[7],
            metadata=json.loads(row[8] or "{}"),
        )

    async def save_rule(self, rule: QualityRule) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self._conn.execute(
            """
            INSERT INTO oip_quality_rules (
                rule_id, rule_code, level, name, description, mandatory, enabled,
                jurisdiction, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(rule_id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                mandatory = excluded.mandatory,
                enabled = excluded.enabled,
                jurisdiction = excluded.jurisdiction,
                metadata_json = excluded.metadata_json,
                updated_at = excluded.updated_at
            """,
            (
                rule.rule_id,
                rule.rule_code,
                rule.level.value,
                rule.name,
                rule.description,
                int(rule.mandatory),
                int(rule.enabled),
                rule.jurisdiction,
                json.dumps(rule.metadata),
                now,
                now,
            ),
        )
        await self._conn.commit()

    def _row_to_evaluation(self, row) -> QualityEvaluation:
        cols = [
            "evaluation_id", "execution_id", "route_id", "plan_id", "request_id", "tenant_id",
            "company_id", "branch_id", "conversation_id", "correlation_id", "status",
            "minimum_gate", "l3_enabled", "execution_result_json", "gate_runs_json",
            "rules_json", "findings_json", "violations_json", "evidence_json", "budget_json",
            "risk_json", "score_json", "recommendations_json", "decision_json", "metadata_json",
            "created_at", "updated_at", "approved_at", "rejected_at", "archived_at",
        ]
        data = dict(zip(cols, row))
        exec_result = ExecutionResultSnapshot(**json.loads(data["execution_result_json"]))
        gate_runs = tuple(
            QualityGateRun(**{**g, "level": QualityLevel(g["level"]), "status": GateRunStatus(g["status"])})
            for g in json.loads(data["gate_runs_json"])
        )
        rules = tuple(
            QualityRule(**{**r, "level": QualityLevel(r["level"])})
            for r in json.loads(data["rules_json"])
        )
        findings = tuple(
            QualityFinding(
                **{
                    **f,
                    "level": QualityLevel(f["level"]),
                    "severity": FindingSeverity(f["severity"]),
                    "violation_kind": ViolationKind(f["violation_kind"]),
                }
            )
            for f in json.loads(data["findings_json"])
        )
        violations = tuple(
            QualityViolation(
                **{
                    **v,
                    "level": QualityLevel(v["level"]),
                    "kind": ViolationKind(v["kind"]),
                }
            )
            for v in json.loads(data["violations_json"])
        )
        evidence = tuple(QualityEvidence(**e) for e in json.loads(data["evidence_json"]))
        budget = QualityBudget(**json.loads(data["budget_json"])) if data["budget_json"] else None
        risk = QualityRisk(**json.loads(data["risk_json"])) if data["risk_json"] else None
        score = QualityScore(**json.loads(data["score_json"])) if data["score_json"] else None
        recommendations = tuple(
            QualityRecommendation(**r) for r in json.loads(data["recommendations_json"])
        )
        decision = None
        if data["decision_json"]:
            d = json.loads(data["decision_json"])
            decision = QualityDecision(
                **{
                    **d,
                    "outcome": QualityDecisionOutcome(d["outcome"]),
                    "minimum_gate": QualityLevel(d["minimum_gate"]),
                    "highest_gate_reached": QualityLevel(d["highest_gate_reached"]),
                }
            )
        return QualityEvaluation(
            evaluation_id=data["evaluation_id"],
            execution_id=data["execution_id"],
            route_id=data["route_id"],
            plan_id=data["plan_id"],
            request_id=data["request_id"],
            tenant_id=data["tenant_id"],
            company_id=data["company_id"],
            branch_id=data["branch_id"],
            conversation_id=data["conversation_id"],
            correlation_id=data["correlation_id"],
            status=EvaluationStatus(data["status"]),
            minimum_gate=data["minimum_gate"],
            l3_enabled=bool(data["l3_enabled"]),
            execution_result=exec_result,
            gate_runs=gate_runs,
            rules_evaluated=rules,
            findings=findings,
            violations=violations,
            evidence=evidence,
            budget=budget,
            risk=risk,
            score=score,
            recommendations=recommendations,
            decision=decision,
            metadata=json.loads(data["metadata_json"] or "{}"),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            approved_at=_parse_dt(data["approved_at"]),
            rejected_at=_parse_dt(data["rejected_at"]),
            archived_at=_parse_dt(data["archived_at"]),
        )
