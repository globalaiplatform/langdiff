import datetime
from typing import Any, TypeVar, cast, TypeAlias

from langdiff.tracker.changes import Operation

T = TypeVar("T")


class DictKey:
    def __init__(self, key: Any):
        self.key = key

    def __str__(self):
        return str(self.key)


PathElement: TypeAlias = str | int | DictKey
Path = list[PathElement]
NO_WRAPPING_TYPES = (
    int,
    float,
    str,
    bool,
    type(None),
    datetime.datetime,
    datetime.date,
    datetime.time,
)


class DiffBuffer:
    _operations: list[Operation]

    def __init__(self):
        self._operations = []

    def flush(self) -> list[Operation]:
        operations = self._operations
        self._operations = []
        return operations


class ChangeTracker(DiffBuffer):
    def on_object_delete(self, source: "TrackedObject", parent: Path, key: str):
        raise NotImplementedError

    def on_object_set(
        self,
        source: "TrackedObject",
        parent: Path,
        key: str,
        value: Any,
        old_value: Any,
    ):
        raise NotImplementedError

    def on_dict_delete(self, source: "TrackedDict", parent: Path, key: str):
        raise NotImplementedError

    def on_dict_set(
        self, source: "TrackedDict", parent: Path, key: str, value: Any, old_value: Any
    ):
        raise NotImplementedError

    def on_list_delete(self, source: "TrackedList", parent: Path, index: int):
        raise NotImplementedError

    def on_list_append(
        self, source: "TrackedList", parent: Path, value: Any, was_empty: bool
    ):
        raise NotImplementedError

    def on_list_extend(
        self, source: "TrackedList", parent: Path, values: list[Any], was_empty: bool
    ):
        raise NotImplementedError

    def on_list_insert(
        self, source: "TrackedList", parent: Path, index: int, value: Any
    ):
        raise NotImplementedError

    def on_list_set(self, source: "TrackedList", parent: Path, index: int, value: Any):
        raise NotImplementedError

    def track(self, obj: T) -> T:
        """Wraps the object in a tracked proxy."""
        return cast(T, TrackedObject(obj, self))

    def _wrap_object(
        self, obj, parent: Path, path_element: PathElement
    ) -> tuple[Any, bool]:
        """Wrap the object with the appropriate tracking proxy"""
        if isinstance(obj, (TrackedObject, TrackedList, TrackedDict)):
            return obj, True

        if isinstance(obj, NO_WRAPPING_TYPES):
            # Primitive types and known immutable types do not need wrapping
            return obj, False

        if isinstance(obj, list):
            return TrackedList(obj, self, parent + [path_element]), True
        elif isinstance(obj, dict):
            return TrackedDict(obj, self, parent + [path_element]), True
        else:
            return TrackedObject(obj, self, parent + [path_element]), True


class TrackedObject:
    """Main proxy class for tracking changes to an object"""

    _obj: Any
    _path: Path
    _wrapped_attrs: dict[str, Any]

    def __init__(self, obj: Any, tracker: ChangeTracker, path: Path | None = None):
        self._obj = obj
        self._tracker = tracker
        self._path = path or []
        self._wrapped_attrs = {}  # Cache for already wrapped attributes

    def __getattr__(self, name):
        if name.startswith("_"):
            return super().__getattribute__(name)

        # Delegate attribute access to the original object and lazily wrap if needed
        # Return if the attribute is already wrapped
        if name in self._wrapped_attrs:
            return self._wrapped_attrs[name]

        # Get attribute value from the original object
        value = getattr(self._obj, name)

        # If the value is a dict or list, wrap and cache it
        wrapped_value, is_wrapped = self._tracker._wrap_object(value, self._path, name)
        if is_wrapped:
            self._wrapped_attrs[name] = wrapped_value
            return wrapped_value

        return value

    def get_raw(self, name):
        """Return the raw attribute without wrapping"""
        if name in self._wrapped_attrs:
            return self._wrapped_attrs[name]
        return getattr(self._obj, name)

    def __setattr__(self, name: str, value):
        """Track attribute setting"""
        if name.startswith("_"):
            # Set internal attributes directly
            object.__setattr__(self, name, value)
        else:
            old_value = getattr(self._obj, name, None)
            setattr(self._obj, name, value)

            self._wrapped_attrs[name], _ = self._tracker._wrap_object(
                value, self._path, name
            )

            self._tracker.on_object_set(
                self, self._path, name.rstrip("_"), value, old_value
            )

    def __delattr__(self, name: str):
        """Track attribute deletion"""
        if name.startswith("_"):
            # Delete internal attributes directly
            object.__delattr__(self, name)
        else:
            delattr(self._obj, name)

            if name in self._wrapped_attrs:
                del self._wrapped_attrs[name]

            self._tracker.on_object_delete(self, self._path, name.rstrip("_"))

    def __repr__(self):
        return f"TrackedObject({self._obj})"

    def unwrap(self):
        return self._obj

    @staticmethod
    def isinstance(obj, cls):
        if isinstance(obj, TrackedObject):
            return isinstance(obj._obj, cls)
        return isinstance(obj, cls)


class TrackedList:
    _data: list
    _path: Path
    _wrapped_elems: list[tuple[bool, Any]] | None

    def __init__(self, data, tracker: ChangeTracker, path: Path):
        self._data = data
        self._tracker = tracker
        self._path = path
        self._wrapped_elems = None

    def _ensure_wrapped_elems(self):
        if self._wrapped_elems is None:
            self._wrapped_elems = [(False, value) for value in self._data]
        return self._wrapped_elems

    def __getitem__(self, index):
        elems = self._ensure_wrapped_elems()
        is_wrapped, value = elems[index]
        if is_wrapped:
            return value
        else:
            # If not wrapped, wrap and cache it
            actual_index = index if index >= 0 else len(self._data) + index
            wrapped_value, _ = self._tracker._wrap_object(
                value, self._path, actual_index
            )
            elems[index] = (True, wrapped_value)
            return wrapped_value

    def __setitem__(self, index, value):
        actual_index = index if index >= 0 else len(self._data) + index

        self._ensure_wrapped_elems()[index] = (False, value)

        self._data[index] = value

        self._tracker.on_list_set(self, self._path, actual_index, value)

    def __len__(self):
        if self._wrapped_elems is None:
            return len(self._data)
        return len(self._wrapped_elems)

    def __iter__(self):
        for i, (is_wrapped, value) in enumerate(self._ensure_wrapped_elems()):
            if is_wrapped:
                yield value
            else:
                # If not wrapped, wrap and cache it
                wrapped_value, _ = self._tracker._wrap_object(value, self._path, i)
                self._wrapped_elems[i] = (True, wrapped_value)
                yield wrapped_value

    def __delitem__(self, index):
        actual_index = index if index >= 0 else len(self._data) + index

        elems = self._ensure_wrapped_elems()
        del elems[index]

        del self._data[index]

        self._tracker.on_list_delete(self, self._path, actual_index)

    def __repr__(self):
        return f"TrackedList({self._data if self._wrapped_elems is None else self._wrapped_elems})"

    def append(self, value):
        elems = self._ensure_wrapped_elems()
        elems.append((False, value))

        was_empty = len(self._data) == 0
        self._data.append(value)

        self._tracker.on_list_append(self, self._path, value, was_empty=was_empty)

    def extend(self, values):
        values = list(values)  # iterators are not consumable multiple times
        elems = self._ensure_wrapped_elems()
        for value in values:
            elems.append((False, value))

        was_empty = len(self._data) == 0
        self._data.extend(values)

        self._tracker.on_list_extend(self, self._path, values, was_empty=was_empty)

    def insert(self, index, value):
        actual_index = index if index >= 0 else len(self._data) + index

        elems = self._ensure_wrapped_elems()
        elems.insert(index, (False, value))

        self._data.insert(index, value)

        self._tracker.on_list_insert(self, self._path, actual_index, value)

    def pop(self, index=-1):
        actual_index = index if index >= 0 else len(self._data) + index

        elems = self._ensure_wrapped_elems()
        is_wrapped, value = elems.pop(index)
        if is_wrapped:
            value = value.unwrap()
            self._data.pop(index)
        else:
            value = self._data.pop(index)

        self._tracker.on_list_delete(self, self._path, actual_index)
        return value

    def index(self, value, start=0, stop=None):
        return self._data.index(value, start, stop)

    def unwrap(self):
        return self._data

    def unwrap_slice(self, s: slice):
        return self._data[s]


class TrackedDict:
    """Proxy class for tracking changes to a dictionary-like object"""

    _data: dict
    _path: Path
    _wrapped_items: dict[str, Any]

    def __init__(self, data, tracker: ChangeTracker, path: Path):
        self._data = data
        self._tracker = tracker
        self._path = path
        self._wrapped_items = {}

    def __getitem__(self, key):
        if key in self._wrapped_items:
            return self._wrapped_items[key]

        value = self._data[key]

        wrapped_value, is_wrapped = self._tracker._wrap_object(
            value, self._path, DictKey(key)
        )
        if is_wrapped:
            self._wrapped_items[key] = wrapped_value
            return wrapped_value

        return value

    def __setitem__(self, key, value):
        old_value = self._data.get(key)
        self._data[key] = value

        wrapped_value, is_wrapped = self._tracker._wrap_object(
            value, self._path, DictKey(key)
        )
        if is_wrapped:
            self._wrapped_items[key] = wrapped_value
        else:
            self._wrapped_items.pop(key, None)

        self._tracker.on_dict_set(self, self._path, key, value, old_value)

    def __delitem__(self, key):
        del self._data[key]

        if key in self._wrapped_items:
            del self._wrapped_items[key]

        self._tracker.on_dict_delete(self, self._path, key)

    def __contains__(self, key):
        return key in self._data

    def keys(self):
        return self._data.keys()

    def values(self):
        for key in self._data.keys():
            yield self[key]

    def items(self):
        for key in self._data.keys():
            yield key, self[key]

    def unwrap(self):
        return self._data
