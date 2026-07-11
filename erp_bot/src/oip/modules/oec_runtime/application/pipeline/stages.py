"""OEC execution pipeline — 12 replaceable stages."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Protocol

from ...domain.capability_registry import CapabilityRegistry
from ...domain.compensation_registry import CompensationRegistry
from ...domain.connector_registry import ConnectorRegistry
from ...domain.execution_intent_registry import ExecutionIntentConnectorRegistry
from ...domain.entities import CompensationRecord, ConnectorTransaction, ERPCommandExecution
from ...domain.snapshot_registry import SnapshotRegistry
from ...domain.transaction_registry import TransactionRegistry
from ...domain.value_objects import CapabilityDomain, ExecutionStatus, TransactionStatus
from ..ports.oec_ports import CircuitBreakerPort, IdempotencyPort, OecRepositoryPort
from .context import ExecutionPipelineContext


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class OecStage(Protocol):
    @property
    def name(self) -> str: ...

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext: ...


class ValidateStage:
    name = "validate"

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if not context.command_id or not context.command_type:
            context.blocked = True
            context.error = "command_required"
        if not context.company_id:
            context.blocked = True
            context.error = "company_required"
        if not context.idempotency_key:
            context.blocked = True
            context.error = "idempotency_required"
        context.events.append({"stage": self.name, "valid": not context.blocked})
        return context


class ResolveConnectorStage:
    name = "resolve_connector"

    def __init__(self, repository: OecRepositoryPort) -> None:
        self._repository = repository

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.blocked:
            return context
        connector = None
        if context.connector_id:
            connector = await self._repository.get_connector(
                tenant_id=context.tenant_id, connector_id=context.connector_id
            )
        if connector is None:
            connector = await self._repository.get_default_connector(
                tenant_id=context.tenant_id, company_id=context.company_id
            )
        if connector is None:
            context.blocked = True
            context.error = "connector_not_found"
            return context
        context.connector = connector
        context.connector_id = connector.connector_id
        context.events.append({"stage": self.name, "connector_id": connector.connector_id})
        return context


class CapabilityCheckStage:
    name = "capability_check"

    def __init__(
        self,
        capability_registry: CapabilityRegistry,
        intent_registry: ExecutionIntentConnectorRegistry,
    ) -> None:
        self._capabilities = capability_registry
        self._intents = intent_registry

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.blocked or context.connector is None:
            return context
        intent_payload = context.payload.get("execution_intent")
        intent = None
        if intent_payload:
            from .....integration.contracts.execution_intent import ExecutionIntent

            intent = ExecutionIntent.from_dict(intent_payload)
        domain = self._intents.resolve_capability_domain(
            command_type=context.command_type,
            intent=intent,
        )
        if not self._capabilities.supports_command(domain, context.command_type):
            context.blocked = True
            context.error = "capability_not_supported"
        context.events.append({"stage": self.name, "domain": domain.value})
        return context


class SnapshotVerifyStage:
    name = "snapshot_verify"

    def __init__(self, snapshot_registry: SnapshotRegistry) -> None:
        self._snapshots = snapshot_registry

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.blocked:
            return context
        if context.snapshot:
            ok, reason = self._snapshots.validate(
                snapshot=context.snapshot,
                company_id=context.company_id,
            )
            if not ok:
                context.blocked = True
                context.error = reason
        context.events.append({"stage": self.name, "verified": not context.blocked})
        return context


class OpenTransactionStage:
    name = "open_transaction"

    def __init__(
        self,
        repository: OecRepositoryPort,
        transaction_registry: TransactionRegistry,
        idempotency: IdempotencyPort,
    ) -> None:
        self._repository = repository
        self._transactions = transaction_registry
        self._idempotency = idempotency

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.blocked or context.connector is None:
            return context
        existing = await self._idempotency.check(
            tenant_id=context.tenant_id, idempotency_key=context.idempotency_key
        )
        if existing and existing.status in (ExecutionStatus.CONFIRMED, ExecutionStatus.DUPLICATE):
            context.duplicate = True
            context.execution = existing
            context.response = dict(existing.response)
            context.response["status"] = "duplicate"
            context.response["erp_reference"] = existing.erp_reference
            context.response["command_id"] = existing.command_id
            context.events.append({"stage": self.name, "duplicate": True})
            return context
        now = _utc_now()
        execution_id = str(uuid.uuid4())
        policy = self._transactions.get("default")
        assert policy is not None
        execution = ERPCommandExecution(
            execution_id=execution_id,
            connector_id=context.connector.connector_id,
            tenant_id=context.tenant_id,
            company_id=context.company_id,
            branch_id=context.branch_id,
            command_id=context.command_id,
            command_type=context.command_type,
            idempotency_key=context.idempotency_key,
            status=ExecutionStatus.RUNNING,
            payload=dict(context.payload),
            request_id=context.request_id,
            correlation_id=context.correlation_id,
            snapshot_id=context.snapshot.get("snapshot_id") if context.snapshot else None,
            created_at=now,
        )
        context.execution = execution
        transaction = ConnectorTransaction(
            transaction_id=str(uuid.uuid4()),
            connector_id=context.connector.connector_id,
            tenant_id=context.tenant_id,
            execution_id=execution_id,
            status=TransactionStatus.OPEN,
            opened_at=now,
            timeout_at=self._transactions.timeout_at(policy, now),
        )
        context.transaction = transaction
        await self._repository.save_execution(execution)
        await self._repository.save_transaction(transaction)
        context.events.append({"stage": self.name, "transaction_id": transaction.transaction_id})
        return context


class ExecuteStage:
    name = "execute"

    def __init__(
        self,
        connector_registry: ConnectorRegistry,
        circuit_breaker: CircuitBreakerPort,
        idempotency: IdempotencyPort,
    ) -> None:
        self._connectors = connector_registry
        self._circuit = circuit_breaker
        self._idempotency = idempotency

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.blocked or context.connector is None or context.execution is None:
            return context
        if context.duplicate:
            context.events.append({"stage": self.name, "duplicate": True})
            return context
        existing = await self._idempotency.check(
            tenant_id=context.tenant_id, idempotency_key=context.idempotency_key
        )
        if existing and existing.status in (ExecutionStatus.CONFIRMED, ExecutionStatus.DUPLICATE):
            context.duplicate = True
            context.response = dict(existing.response)
            context.response["status"] = "duplicate"
            context.response["erp_reference"] = existing.erp_reference
            context.response["command_id"] = existing.command_id
            context.events.append({"stage": self.name, "duplicate": True})
            return context
        if not await self._circuit.allow_request(
            tenant_id=context.tenant_id, connector_id=context.connector.connector_id
        ):
            context.blocked = True
            context.error = "circuit_open"
            return context
        driver = self._connectors.get_driver(context.connector.connector_type)
        if driver is None:
            context.blocked = True
            context.error = "driver_not_found"
            return context
        try:
            context.response = await driver.execute_command(
                connector_id=context.connector.connector_id,
                command_type=context.command_type,
                payload=dict(context.payload),
                config=context.connector.config.model_dump(),
            )
            await self._circuit.record_success(
                tenant_id=context.tenant_id, connector_id=context.connector.connector_id
            )
        except Exception as exc:  # noqa: BLE001
            context.blocked = True
            context.error = str(exc)
            await self._circuit.record_failure(
                tenant_id=context.tenant_id, connector_id=context.connector.connector_id
            )
        context.events.append({"stage": self.name, "success": not context.blocked})
        return context


class ConfirmationStage:
    name = "confirmation"

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.blocked or context.execution is None:
            return context
        if context.duplicate:
            return context
        erp_ref = context.response.get("erp_reference") or f"erp-{context.command_id[:8]}"
        context.response.setdefault("status", "accepted")
        context.response.setdefault("command_id", context.command_id)
        context.response["erp_reference"] = erp_ref
        updated = context.execution.model_copy(
            update={
                "status": ExecutionStatus.CONFIRMED,
                "erp_reference": str(erp_ref),
                "response": dict(context.response),
                "completed_at": _utc_now(),
            }
        )
        context.execution = updated
        context.events.append({"stage": self.name, "erp_reference": erp_ref})
        return context


class CompensationStage:
    name = "compensation"

    def __init__(self, compensation_registry: CompensationRegistry, repository: OecRepositoryPort) -> None:
        self._compensation = compensation_registry
        self._repository = repository

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if not context.blocked or context.execution is None:
            return context
        reversal_payload = self._compensation.build_reversal_payload(
            original_payload=context.payload,
            reason=context.error,
        )
        record = CompensationRecord(
            compensation_id=str(uuid.uuid4()),
            execution_id=context.execution.execution_id,
            connector_id=context.execution.connector_id,
            tenant_id=context.tenant_id,
            reason=context.error,
            reversal_command_id=str(uuid.uuid4()),
            status=ExecutionStatus.FAILED,
            created_at=_utc_now(),
        )
        context.compensation = record
        await self._repository.save_compensation(record)
        context.events.append({"stage": self.name, "reversal_payload": reversal_payload})
        return context


class CommitStage:
    name = "commit"

    def __init__(self, repository: OecRepositoryPort, idempotency: IdempotencyPort) -> None:
        self._repository = repository
        self._idempotency = idempotency

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.execution is None:
            return context
        if context.blocked and not context.duplicate:
            failed = context.execution.model_copy(
                update={"status": ExecutionStatus.FAILED, "error_message": context.error, "completed_at": _utc_now()}
            )
            context.execution = failed
            await self._repository.save_execution(failed)
            if context.transaction:
                rolled = context.transaction.model_copy(update={"status": TransactionStatus.ROLLED_BACK})
                context.transaction = rolled
                await self._repository.save_transaction(rolled)
            await self._repository.increment_metrics(
                tenant_id=context.tenant_id, connector_id=context.execution.connector_id, metric="failures"
            )
            return context
        if context.duplicate:
            context.events.append({"stage": self.name, "duplicate": True})
            return context
        await self._repository.save_execution(context.execution)
        await self._idempotency.record(tenant_id=context.tenant_id, execution=context.execution)
        if context.transaction:
            committed = context.transaction.model_copy(
                update={"status": TransactionStatus.COMMITTED, "committed_at": _utc_now()}
            )
            context.transaction = committed
            await self._repository.save_transaction(committed)
        await self._repository.increment_metrics(
            tenant_id=context.tenant_id, connector_id=context.execution.connector_id, metric="commands"
        )
        context.events.append({"stage": self.name, "committed": True})
        return context


class AuditStage:
    name = "audit"

    def __init__(self, audit_callback) -> None:
        self._audit = audit_callback

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.execution is None:
            return context
        audit_payload: dict = {
            "execution_id": context.execution.execution_id,
            "command_type": context.command_type,
            "status": context.execution.status.value,
        }
        if context.response:
            observability = context.response.get("observability")
            if observability:
                audit_payload["observability"] = observability
        await self._audit(
            tenant_id=context.tenant_id,
            request_id=context.request_id,
            correlation_id=context.correlation_id,
            event_name="oec.command.executed" if not context.blocked else "oec.command.failed",
            payload=audit_payload,
        )
        context.events.append({"stage": self.name})
        return context


class LineageStage:
    name = "lineage"

    def __init__(self, lineage_callback) -> None:
        self._lineage = lineage_callback

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.execution is None or context.blocked:
            return context
        await self._lineage(
            tenant_id=context.tenant_id,
            request_id=context.request_id,
            node_type="ERPConfirmation",
            payload={
                "execution_id": context.execution.execution_id,
                "erp_reference": context.execution.erp_reference,
                "connector_id": context.execution.connector_id,
            },
        )
        context.events.append({"stage": self.name})
        return context


class PublishStage:
    name = "publish"

    def __init__(self, publish_callback) -> None:
        self._publish = publish_callback

    async def run(self, context: ExecutionPipelineContext) -> ExecutionPipelineContext:
        if context.execution is None:
            return context
        await self._publish(context)
        context.events.append({"stage": self.name, "published": True})
        return context
