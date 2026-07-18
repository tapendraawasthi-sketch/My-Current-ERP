"""MAI-01 — OIP import/mount smoke after planner relative-import fix."""

from __future__ import annotations


def test_oip_api_router_imports():
    from src.oip.api import router

    assert router.prefix == "/oip/v1"


def test_planner_application_import_resolves():
    from src.oip.modules.planner.application.commands import CreateExecutionPlanCommand

    assert CreateExecutionPlanCommand.__name__ == "CreateExecutionPlanCommand"


def test_constitution_module_imports_pure():
    from src.oip.domain.constitution import POLICY_VERSION, evaluate_policy

    assert POLICY_VERSION.startswith("mai-01")
    assert callable(evaluate_policy)
