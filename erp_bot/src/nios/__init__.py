"""NIOS Platform — Python runtime."""

from .kernel.kernel import NiosKernel, get_kernel

__all__ = ["NiosKernel", "get_kernel", "get_gateway", "NiosGateway"]


def get_gateway():
    from .gateway import get_gateway as _get_gateway

    return _get_gateway()


def __getattr__(name: str):
    if name == "NiosGateway":
        from .gateway import NiosGateway

        return NiosGateway
    raise AttributeError(name)

