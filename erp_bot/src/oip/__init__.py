"""Orbix Intelligence Platform (OIP) — constitutional implementation."""

from .config.settings import OipSettings, get_oip_settings
from .kernel.facade import IntelligenceKernelFacade

__all__ = [
    "IntelligenceKernelFacade",
    "OipSettings",
    "get_oip_settings",
]

__version__ = "0.1.0"
