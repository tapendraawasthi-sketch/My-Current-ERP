"""OEC Runtime projectors."""

from __future__ import annotations

from ..read_models.oec_read_models import ConnectorReadModel, ExecutionReadModel
from ...domain.entities import ERPCommandExecution, ERPConnector


class ConnectorProjector:
    def project(self, connector: ERPConnector) -> ConnectorReadModel:
        return ConnectorReadModel(
            connector_id=connector.connector_id,
            tenant_id=connector.tenant_id,
            name=connector.name,
            connector_type=connector.connector_type.value,
            status=connector.status.value,
            company_id=connector.company_id,
            is_default=connector.is_default,
            capabilities=connector.capabilities,
            created_at=connector.created_at.isoformat(),
            updated_at=connector.updated_at.isoformat(),
        )


class ExecutionProjector:
    def project(self, execution: ERPCommandExecution) -> ExecutionReadModel:
        return ExecutionReadModel(
            execution_id=execution.execution_id,
            connector_id=execution.connector_id,
            command_id=execution.command_id,
            command_type=execution.command_type,
            status=execution.status.value,
            erp_reference=execution.erp_reference,
            retry_count=execution.retry_count,
            created_at=execution.created_at.isoformat(),
            completed_at=execution.completed_at.isoformat() if execution.completed_at else None,
        )
