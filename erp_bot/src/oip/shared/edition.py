"""Edition and deployment mode — capability gating per Constitution."""

from __future__ import annotations

from enum import Enum


class DeploymentMode(str, Enum):
    DEVELOPER = "developer"
    SMB = "smb"
    CLOUD_SAAS = "cloud_saas"
    ENTERPRISE = "enterprise"
    GOVERNMENT = "government"
    OFFLINE = "offline"
    HYBRID = "hybrid"


class OipEdition(str, Enum):
    DEVELOPER = "developer"
    SMB = "smb"
    CLOUD = "cloud"
    ENTERPRISE = "enterprise"
    GOVERNMENT = "government"
    OFFLINE = "offline"
