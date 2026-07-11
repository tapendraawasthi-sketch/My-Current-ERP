"""OIP Phase 2.7 — Production ERP connector integration tests."""

from __future__ import annotations

import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.oip.config.settings import OipSettings
from src.oip.infrastructure.di.container import build_container, shutdown_container
from src.oip.integration.contracts.erp_commands import ErpCommandType
from src.oip.modules.oec_runtime.application.commands import ExecuteERPCommandCommand, RegisterConnectorCommand
from src.oip.modules.oec_runtime.domain.value_objects import ConnectorType
from src.oip.modules.oec_runtime.infrastructure.adapters.circuit_breaker_adapter import CircuitBreakerAdapter
from src.oip.modules.oec_runtime.infrastructure.adapters.connectors import (
    GraphQLConnectorDriver,
    RestConnectorDriver,
    SQLiteConnectorDriver,
    SutraConnectorDriver,
)
from src.oip.modules.oec_runtime.infrastructure.adapters.connectors.sutra_erp_service import SutraErpService
from src.oip.modules.oec_runtime.infrastructure.adapters.connectors.sql_executor import AioSqliteExecutor
from src.oip.modules.oec_runtime.infrastructure.factory import build_connector_registry
from src.oip.modules.oec_runtime.infrastructure.persistence.oec_sqlite import TENANT_A
from src.oip.shared.ids import CorrelationId, RequestId, TenantId, new_correlation_id, new_request_id


@pytest.fixture
async def oip_container(tmp_path):
    db_path = tmp_path / "oip_prod_connectors.db"
    settings = OipSettings(
        enabled=True,
        oec_enabled=True,
        database_url=f"sqlite+aiosqlite:///{db_path}",
    )
    container = await build_container(settings)
    yield container
    await container.close()
    await shutdown_container()


def _journal_payload(**kwargs) -> dict:
    return {
        "tenant_id": TENANT_A,
        "company_id": kwargs.get("company_id", "company-prod"),
        "amount": kwargs.get("amount", 1000),
        "idempotency_key": kwargs.get("idempotency_key", f"prod-{uuid.uuid4().hex[:8]}"),
    }


@pytest.mark.asyncio
async def test_sqlite_journal_posting_and_ledger(oip_container):
    driver = SQLiteConnectorDriver(oip_container.connection)
    payload = _journal_payload()
    posted = await driver.execute_command(
        connector_id="sqlite-prod",
        command_type=ErpCommandType.POST_JOURNAL_ENTRY.value,
        payload=payload,
        config={},
    )
    assert posted["status"] == "accepted"
    assert posted["rows_affected"] >= 1

    ledger = await driver.execute_query(
        connector_id="sqlite-prod",
        query_type=ErpCommandType.QUERY_LEDGER_BALANCE.value,
        payload={"tenant_id": TENANT_A, "company_id": payload["company_id"], "account_code": "1000"},
        config={},
    )
    assert ledger["account_code"] == "1000"
    assert ledger["balance"] == -1000.0


@pytest.mark.asyncio
async def test_sutra_connector_journal_and_trial_balance(oip_container):
    driver = SutraConnectorDriver(oip_container.connection)
    company_id = f"sutra-co-{uuid.uuid4().hex[:6]}"
    payload = _journal_payload(company_id=company_id, amount=2500)
    await driver.execute_command(
        connector_id="sutra-prod",
        command_type=ErpCommandType.POST_JOURNAL_ENTRY.value,
        payload=payload,
        config={},
    )
    report = await driver.execute_query(
        connector_id="sutra-prod",
        query_type=ErpCommandType.GENERATE_FINANCIAL_REPORT.value,
        payload={"tenant_id": TENANT_A, "company_id": company_id, "report_type": "trial_balance"},
        config={},
    )
    assert report["report_type"] == "trial_balance"
    assert report["row_count"] >= 2


@pytest.mark.asyncio
async def test_coa_snapshot_and_period_validation(oip_container):
    driver = SQLiteConnectorDriver(oip_container.connection)
    company_id = f"coa-{uuid.uuid4().hex[:6]}"
    await driver.execute_command(
        connector_id="sqlite-coa",
        command_type=ErpCommandType.POST_JOURNAL_ENTRY.value,
        payload=_journal_payload(company_id=company_id),
        config={},
    )
    coa = await driver.execute_query(
        connector_id="sqlite-coa",
        query_type=ErpCommandType.GET_COA_SNAPSHOT.value,
        payload={"tenant_id": TENANT_A, "company_id": company_id},
        config={},
    )
    assert coa["metadata"]["account_count"] >= 7
    period = await driver.execute_query(
        connector_id="sqlite-coa",
        query_type=ErpCommandType.IS_PERIOD_OPEN.value,
        payload={"tenant_id": TENANT_A, "company_id": company_id},
        config={},
    )
    assert period["is_open"] is True


@pytest.mark.asyncio
async def test_journal_idempotency_at_connector(oip_container):
    driver = SQLiteConnectorDriver(oip_container.connection)
    key = f"idem-connector-{uuid.uuid4().hex[:8]}"
    payload = _journal_payload(idempotency_key=key)
    first = await driver.execute_command(
        connector_id="sqlite-idem",
        command_type=ErpCommandType.POST_JOURNAL_ENTRY.value,
        payload=payload,
        config={},
    )
    second = await driver.execute_command(
        connector_id="sqlite-idem",
        command_type=ErpCommandType.POST_JOURNAL_ENTRY.value,
        payload=payload,
        config={},
    )
    assert first["erp_reference"] == second["erp_reference"]
    assert second["status"] == "duplicate"


@pytest.mark.asyncio
async def test_unbalanced_journal_rejected(oip_container):
    service = SutraErpService(AioSqliteExecutor(oip_container.connection))
    with pytest.raises(ValueError, match="not balanced"):
        await service.post_journal_entry(
            {
                "tenant_id": TENANT_A,
                "company_id": "bad-co",
                "lines": [
                    {"account_code": "5100", "debit": 100, "credit": 0},
                    {"account_code": "1000", "debit": 0, "credit": 50},
                ],
            }
        )


@pytest.mark.asyncio
async def test_vat_calculation_query(oip_container):
    driver = SQLiteConnectorDriver(oip_container.connection)
    result = await driver.execute_query(
        connector_id="sqlite-vat",
        query_type=ErpCommandType.CALCULATE_VAT.value,
        payload={"tenant_id": TENANT_A, "company_id": "c1", "amount": 1000, "vat_rate": 0.13},
        config={},
    )
    assert result["vat_amount"] == 130.0
    assert result["total"] == 1130.0


@pytest.mark.asyncio
async def test_approval_workflow(oip_container):
    driver = SutraConnectorDriver(oip_container.connection)
    result = await driver.execute_command(
        connector_id="sutra-apr",
        command_type=ErpCommandType.APPROVE_PENDING_ACTION.value,
        payload={"tenant_id": TENANT_A, "company_id": "c1", "action_ref": "INV-001"},
        config={},
    )
    assert result["status"] == "accepted"
    assert result["action_ref"] == "INV-001"


@pytest.mark.asyncio
async def test_rest_connector_production_http():
    driver = RestConnectorDriver()
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b'{"status":"accepted","erp_reference":"REST-JV-001","rows_affected":1}'
    mock_response.json.return_value = {"status": "accepted", "erp_reference": "REST-JV-001", "rows_affected": 1}

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch(
        "src.oip.modules.oec_runtime.infrastructure.adapters.connectors.production_drivers.httpx.AsyncClient",
        return_value=mock_client,
    ):
        result = await driver.execute_command(
            connector_id="rest-1",
            command_type=ErpCommandType.POST_JOURNAL_ENTRY.value,
            payload={"tenant_id": TENANT_A, "company_id": "c1"},
            config={"base_url": "https://erp.example.com", "api_key": "secret"},
        )
    assert result["erp_reference"] == "REST-JV-001"
    assert "observability" in result


@pytest.mark.asyncio
async def test_graphql_connector_production_http():
    driver = GraphQLConnectorDriver()
    mock_response = MagicMock()
    mock_response.content = b'{"data":{"executeCommand":{"erpReference":"GQL-001","status":"accepted","rowsAffected":2}}}'
    mock_response.json.return_value = {
        "data": {"executeCommand": {"erpReference": "GQL-001", "status": "accepted", "rowsAffected": 2}}
    }

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch(
        "src.oip.modules.oec_runtime.infrastructure.adapters.connectors.production_drivers.httpx.AsyncClient",
        return_value=mock_client,
    ):
        result = await driver.execute_command(
            connector_id="gql-1",
            command_type=ErpCommandType.POST_JOURNAL_ENTRY.value,
            payload={"tenant_id": TENANT_A, "company_id": "c1"},
            config={"base_url": "https://erp.example.com/graphql"},
        )
    assert result["erp_reference"] == "GQL-001"
    assert result["rows_affected"] == 2


@pytest.mark.asyncio
async def test_circuit_breaker_blocks_connector(oip_container):
    breaker = CircuitBreakerAdapter(oip_container.oec_repository, failure_threshold=2)
    cid = "conn-test-cb"
    await breaker.record_failure(tenant_id=TENANT_A, connector_id=cid)
    await breaker.record_failure(tenant_id=TENANT_A, connector_id=cid)
    assert await breaker.allow_request(tenant_id=TENANT_A, connector_id=cid) is False


@pytest.mark.asyncio
async def test_concurrent_sqlite_postings(oip_container):
    driver = SQLiteConnectorDriver(oip_container.connection)
    company_id = f"conc-{uuid.uuid4().hex[:6]}"

    async def post(amount: int):
        return await driver.execute_command(
            connector_id="sqlite-conc",
            command_type=ErpCommandType.POST_JOURNAL_ENTRY.value,
            payload=_journal_payload(company_id=company_id, amount=amount),
            config={},
        )

    results = await asyncio.gather(*[post(i * 100) for i in range(1, 6)])
    assert all(r["status"] == "accepted" for r in results)
    assert len({r["erp_reference"] for r in results}) == 5


@pytest.mark.asyncio
async def test_read_after_write_consistency(oip_container):
    driver = SQLiteConnectorDriver(oip_container.connection)
    company_id = f"raw-{uuid.uuid4().hex[:6]}"
    amount = 750
    await driver.execute_command(
        connector_id="sqlite-raw",
        command_type=ErpCommandType.POST_JOURNAL_ENTRY.value,
        payload=_journal_payload(company_id=company_id, amount=amount),
        config={},
    )
    ledger = await driver.execute_query(
        connector_id="sqlite-raw",
        query_type=ErpCommandType.QUERY_LEDGER_BALANCE.value,
        payload={"tenant_id": TENANT_A, "company_id": company_id, "account_code": "5100"},
        config={},
    )
    assert ledger["balance"] == amount


@pytest.mark.asyncio
async def test_register_sutra_connector_via_service(oip_container):
    registered = await oip_container.command_bus.dispatch(
        RegisterConnectorCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            name="Production Sutra",
            connector_type=ConnectorType.SUTRA.value,
            capabilities=("Accounting",),
        )
    )
    assert registered["connector_type"] == "Sutra"
    registry = build_connector_registry(conn=oip_container.connection, repository=oip_container.oec_repository)
    assert registry.get_driver("sutra") is not None


@pytest.mark.asyncio
async def test_oec_pipeline_with_sqlite_connector(oip_container):
    registered = await oip_container.command_bus.dispatch(
        RegisterConnectorCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            name="SQLite Production",
            connector_type=ConnectorType.SQLITE.value,
            is_default=True,
            capabilities=("Accounting",),
        )
    )
    result = await oip_container.command_bus.dispatch(
        ExecuteERPCommandCommand(
            tenant_id=TenantId(TENANT_A),
            correlation_id=CorrelationId(str(new_correlation_id())),
            request_id=RequestId(str(new_request_id())),
            command_id=str(uuid.uuid4()),
            command_type_name=ErpCommandType.POST_JOURNAL_ENTRY.value,
            company_id="pipeline-co",
            idempotency_key=f"pipe-{uuid.uuid4().hex[:8]}",
            payload={"amount": 1200},
            connector_id=registered["connector_id"],
        )
    )
    assert result["status"] == "accepted"
    assert result.get("voucher_id")


@pytest.mark.asyncio
async def test_migration_erp_tables_exist(oip_container):
    conn = oip_container.connection
    for table in (
        "erp_chart_of_accounts",
        "erp_fiscal_periods",
        "erp_vouchers",
        "erp_voucher_lines",
        "erp_ledger_postings",
        "erp_parties",
        "erp_approvals",
    ):
        cursor = await conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        )
        assert await cursor.fetchone() is not None
