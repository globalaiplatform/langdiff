from typing import Any

from jsonpointer import JsonPointer  # type: ignore[import-untyped]
from pydantic import BaseModel

from .change_tracker import ChangeTracker, TrackedObject, TrackedList, TrackedDict, Path
from .changes import Operation


class JSONPatchChangeTracker(ChangeTracker):
    """Change tracker that collects changes in standard JSON Patch format."""

    def on_object_delete(self, source: "TrackedObject", parent: Path, key: str):
        self._operations.append(
            Operation(op="remove", path=f"{_encode_path(parent)}/{key}")
        )

    def on_object_set(
        self,
        source: "TrackedObject",
        parent: Path,
        key: str,
        value: Any,
        old_value: Any,
    ):
        self._operations.append(
            Operation(
                op="add",
                path=f"{_encode_path(parent)}/{key}",
                value=_dump(value),
            )
        )

    def on_dict_delete(self, source: "TrackedDict", parent: Path, key: str):
        self._operations.append(
            Operation(op="remove", path=f"{_encode_path(parent)}/{key}")
        )

    def on_dict_set(
        self, source: "TrackedDict", parent: Path, key: str, value: Any, old_value: Any
    ):
        self._operations.append(
            Operation(
                op="add",
                path=f"{_encode_path(parent)}/{key}",
                value=_dump(value),
            )
        )

    def on_list_delete(self, source: "TrackedList", parent: Path, index: int):
        assert index >= 0, "Index must be non-negative"
        self._operations.append(
            Operation(op="remove", path=f"{_encode_path(parent)}/{index}")
        )

    def on_list_append(
        self, source: "TrackedList", parent: Path, value: Any, was_empty: bool
    ):
        if was_empty:
            self._operations.append(
                Operation(op="add", path=_encode_path(parent), value=[_dump(value)])
            )
        else:
            self._operations.append(
                Operation(
                    op="add", path=f"{_encode_path(parent)}/-", value=_dump(value)
                )
            )

    def on_list_extend(
        self, source: "TrackedList", parent: Path, values: list[Any], was_empty: bool
    ):
        if was_empty:
            self._operations.append(
                Operation(op="add", path=_encode_path(parent), value=_dump(values))
            )
        else:
            for value in values:
                self._operations.append(
                    Operation(
                        op="add", path=f"{_encode_path(parent)}/-", value=_dump(value)
                    )
                )

    def on_list_insert(
        self, source: "TrackedList", parent: Path, index: int, value: Any
    ):
        assert index >= 0, "Index must be non-negative"
        self._operations.append(
            Operation(
                op="add", path=f"{_encode_path(parent)}/{index}", value=_dump(value)
            )
        )

    def on_list_set(self, source: "TrackedList", parent: Path, index: int, value: Any):
        assert index >= 0, "Index must be non-negative"
        self._operations.append(
            Operation(
                op="add", path=f"{_encode_path(parent)}/{index}", value=_dump(value)
            )
        )


class EfficientJSONPatchChangeTracker(JSONPatchChangeTracker):
    """Change tracker that collects changes in extended JSON Patch format
    with specialized string append operation."""

    def on_object_set(
        self,
        source: "TrackedObject",
        parent: Path,
        key: str,
        value: Any,
        old_value: Any,
    ):
        path = f"{_encode_path(parent)}/{key}"
        if isinstance(value, str):
            # str is immutable in Python, so we can compare identities for quick check
            if value is old_value:
                # no change
                return
            if old_value and isinstance(old_value, str) and value.startswith(old_value):
                if len(old_value) == len(value):
                    # no change
                    return
                self._operations.append(
                    Operation(
                        op="append",
                        path=path,
                        value=value[len(old_value) :],
                    )
                )
            else:
                self._operations.append(
                    Operation(
                        op="add",
                        path=path,
                        value=value,
                    )
                )
        else:
            self._operations.append(
                Operation(
                    op="add",
                    path=path,
                    value=_dump(value),
                )
            )


def _dump(obj: Any) -> Any:
    """Convert the object to a JSON-serializable object"""
    if isinstance(obj, BaseModel):
        return obj.model_dump(mode="json")
    elif isinstance(obj, list):
        return [_dump(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: _dump(value) for key, value in obj.items()}
    else:  # TODO
        return obj


def _encode_path(path: Path) -> str:
    return JsonPointer.from_parts(map(str, path)).path
