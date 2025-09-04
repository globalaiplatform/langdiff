from typing import TypedDict, Any, NotRequired

import jsonpatch  # type: ignore[import-untyped]

__all__ = [
    "Operation",
    "apply_change",
]


class Operation(TypedDict):
    op: str
    path: str
    value: NotRequired[Any]


class AppendOperation(jsonpatch.PatchOperation):
    def apply(self, obj):
        try:
            value = self.operation["value"]
        except KeyError:
            raise jsonpatch.InvalidJsonPatch(
                "The operation does not contain a 'value' member"
            )

        subobj, part = self.pointer.to_last(obj)

        if part is None:
            return value

        if part == "-":
            raise jsonpatch.InvalidJsonPatch(
                "'path' with '-' can't be applied to 'append' operation"
            )

        if not isinstance(subobj[part], str):
            raise jsonpatch.InvalidJsonPatch(
                "'append' operation can only be applied to a string"
            )

        subobj[part] += value
        return obj

    def _on_undo_remove(self, path, key):
        return key

    def _on_undo_add(self, path, key):
        return key


class JsonPatchWithAppend(jsonpatch.JsonPatch):
    def __init__(self, patch, pointer_cls=jsonpatch.JsonPointer):
        super().__init__(patch, pointer_cls)

    def _get_operation(self, operation):
        if operation.get("op") == "append":
            return AppendOperation(operation, self.pointer_cls)
        return super()._get_operation(operation)


def apply_change(obj: dict, operations: list[Operation]):
    """
    Apply a JSON Patch to a Python dictionary.

    Args:
        obj: The original dictionary to be patched.
        operations: A list of operations to apply.

    Returns:
        The patched dictionary.
    """
    JsonPatchWithAppend(operations).apply(obj, in_place=True)
