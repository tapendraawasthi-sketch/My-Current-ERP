"""RBAC permission registry — no switch statements."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PermissionDefinition:
    permission: str
    description: str


@dataclass(frozen=True)
class RoleDefinition:
    role: str
    permissions: tuple[str, ...]
    description: str = ""


class PermissionRegistry:
    def __init__(self) -> None:
        self._permissions: dict[str, PermissionDefinition] = {}
        self._roles: dict[str, RoleDefinition] = {}

    def register_permission(self, definition: PermissionDefinition) -> None:
        self._permissions[definition.permission] = definition

    def register_role(self, definition: RoleDefinition) -> None:
        self._roles[definition.role] = definition

    def permissions_for_role(self, role: str) -> tuple[str, ...]:
        definition = self._roles.get(role)
        if definition is None:
            custom = self._roles.get("custom")
            return custom.permissions if custom else ()
        if role == "system_admin":
            return tuple(self._permissions.keys())
        return definition.permissions

    def resolve_permissions(self, *, role: str, extra: tuple[str, ...] = ()) -> tuple[str, ...]:
        base = set(self.permissions_for_role(role))
        base.update(extra)
        return tuple(sorted(base))

    def is_allowed(self, *, role: str, permissions: tuple[str, ...], required: tuple[str, ...]) -> bool:
        granted = set(self.resolve_permissions(role=role, extra=permissions))
        if not required:
            return True
        for item in required:
            if item in granted:
                continue
            prefix = item.split(":")[0]
            if f"{prefix}:*" in granted or "oip:*" in granted or "erp:*" in granted:
                continue
            return False
        return True

    def list_roles(self) -> tuple[str, ...]:
        return tuple(self._roles.keys())


def create_default_permission_registry() -> PermissionRegistry:
    registry = PermissionRegistry()
    permission_defs = (
        PermissionDefinition("oip:intelligence:submit", "Submit intelligence requests"),
        PermissionDefinition("oip:connector:register", "Register ERP connectors"),
        PermissionDefinition("oip:connector:read", "Read connector metadata"),
        PermissionDefinition("oip:connector:manage", "Archive/retry connector operations"),
        PermissionDefinition("oip:action:propose", "Propose actions"),
        PermissionDefinition("oip:action:approve", "Approve or reject actions"),
        PermissionDefinition("erp:command:execute", "Execute ERP commands"),
        PermissionDefinition("erp:query:execute", "Execute ERP queries"),
        PermissionDefinition("oip:audit:read", "Read audit chains"),
        PermissionDefinition("oip:admin:manage", "Platform administration"),
        PermissionDefinition("oip:read", "Read-only platform access"),
    )
    for definition in permission_defs:
        registry.register_permission(definition)

    read_only = (
        "oip:read",
        "oip:connector:read",
        "erp:query:execute",
        "oip:audit:read",
    )
    role_defs = (
        RoleDefinition("system_admin", ("oip:*", "erp:*"), "Full platform access"),
        RoleDefinition("tenant_admin", ("oip:*", "erp:*"), "Tenant-scoped administration"),
        RoleDefinition(
            "company_admin",
            (
                "oip:intelligence:submit",
                "oip:connector:register",
                "oip:connector:read",
                "oip:connector:manage",
                "oip:action:propose",
                "oip:action:approve",
                "erp:command:execute",
                "erp:query:execute",
                "oip:audit:read",
            ),
            "Company-scoped administration",
        ),
        RoleDefinition(
            "accountant",
            (
                "oip:intelligence:submit",
                "oip:action:propose",
                "erp:command:execute",
                "erp:query:execute",
                "oip:connector:read",
            ),
            "Accounting operations",
        ),
        RoleDefinition(
            "auditor",
            ("oip:read", "erp:query:execute", "oip:audit:read", "oip:connector:read"),
            "Audit and read-only reporting",
        ),
        RoleDefinition(
            "manager",
            (
                "oip:intelligence:submit",
                "oip:action:approve",
                "erp:query:execute",
                "oip:connector:read",
                "oip:read",
            ),
            "Management approvals",
        ),
        RoleDefinition("read_only", read_only, "Read-only access"),
        RoleDefinition("custom", (), "Custom role — permissions supplied explicitly"),
    )
    for definition in role_defs:
        registry.register_role(definition)
    return registry
