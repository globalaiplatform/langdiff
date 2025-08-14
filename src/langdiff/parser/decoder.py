import functools
from typing import Callable, Any

from pydantic import TypeAdapter


def _build_type_adapter_cache(max_size: int):
    return functools.lru_cache(maxsize=max_size)(lambda t: TypeAdapter(t))


_DEFAULT_CACHE_SIZE = 100
_CACHE = _build_type_adapter_cache(_DEFAULT_CACHE_SIZE)


def set_type_adapter_cache_size(max_size: int):
    """
    Set the maximum size of the TypeAdapter cache.

    Args:
        max_size (int): The new maximum size for the cache.
    """
    global _CACHE
    _CACHE = _build_type_adapter_cache(max_size)


def get_cached_type_adapter(key: type) -> TypeAdapter:
    """
    Get a cached TypeAdapter for the given key type.

    Args:
        key (type): The type for which to get the TypeAdapter.

    Returns:
        TypeAdapter: The cached TypeAdapter for the given type.
    """
    return _CACHE(key)


def get_decoder(type_hint: Any) -> Callable | None:
    # fast path for common types
    if type_hint is str or type_hint is int or type_hint is float or type_hint is bool:
        return None

    return get_cached_type_adapter(type_hint).validate_python
