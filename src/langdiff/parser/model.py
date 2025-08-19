import typing
from typing import Generic, Callable, Any, TypeVar, Annotated

import pydantic
from pydantic import BaseModel

from langdiff.parser.decoder import get_decoder

T = TypeVar("T")

Field = pydantic.Field


class PydanticType:
    """A hint that specifies the Pydantic type to use when converting to Pydantic models.

    This is used with typing.Annotated to provide custom type hints for Pydantic model derivation.

    Example:
        class Item(Object):
            field: Annotated[String, PydanticType(UUID)]

        When Item.to_pydantic() is called, the generated field will have type UUID instead of str.
    """

    def __init__(self, pydantic_type: Any):
        """Initialize with the desired Pydantic type.

        Args:
            pydantic_type: The type to use in the generated Pydantic model
        """
        self.pydantic_type = pydantic_type


class StreamingValue(Generic[T]):
    """A generic base class for a value that is streamed incrementally.

    This class provides a way to register callbacks that are executed when the
    streaming of the value starts and when it is complete.
    """

    _on_start_funcs: list[Callable[[], Any]]
    _on_complete_funcs: list[Callable[[T], Any]]
    _started: bool

    def __init__(self):
        self._on_start_funcs = []
        self._on_complete_funcs = []
        self._started = False

    def on_start(self, func: Callable[[], Any]):
        """Register a callback that is called when the streaming starts."""
        self._on_start_funcs.append(func)

    def on_complete(self, func: Callable[[T], Any]):
        self._on_complete_funcs.append(func)

    def _trigger_start(self):
        """Trigger start callbacks if not already started."""
        if not self._started:
            self._started = True
            for func in self._on_start_funcs:
                func()

    def update(self, value: T):
        raise NotImplementedError

    def complete(self):
        raise NotImplementedError


class Object(StreamingValue[dict]):
    """Represents a JSON object that is streamed.

    The keys of the object are determined from the type annotations of the class.
    It is assumed that the keys will be received in the order they are defined.
    When a new key is encountered in the stream, the previous key's value is
    considered complete.
    """

    def __init__(self):
        super().__init__()
        self._value = {}
        self._last_key_idx = None
        self._keys = []
        self._on_update_funcs = []

        for key, type_hint in type(self).__annotations__.items():
            self._keys.append(key)

            # Extract base type from Annotated[T, PydanticType(...), ...]
            base_type = type_hint
            if typing.get_origin(type_hint) is Annotated:
                base_type = typing.get_args(type_hint)[0]

            # handle List[T], Atom[T]
            if hasattr(base_type, "__origin__"):
                item_cls = typing.get_args(base_type)[0]
                setattr(self, key, base_type.__origin__(item_cls))
            else:
                setattr(self, key, base_type())

    def on_update(self, func: Callable[[dict], Any]):
        """Register a callback that is called whenever the object is updated."""
        self._on_update_funcs.append(func)

    def update(self, value: dict):
        self._trigger_start()
        if self._last_key_idx is None:
            start_idx = 0
        else:
            start_idx = self._last_key_idx + 1

        for i in range(start_idx, len(self._keys)):
            key = self._keys[i]
            if key not in value:
                break
            if self._last_key_idx is not None:
                last_key = self._keys[self._last_key_idx]
                s = getattr(self, last_key)
                s.update(value[last_key])
                s.complete()
            self._last_key_idx = i

        last_key = self._keys[self._last_key_idx or 0]
        if last_key in value:
            s = getattr(self, last_key)
            s.update(value[last_key])
        self._value = value

        for func in self._on_update_funcs:
            func(self._value)

    def complete(self):
        if self._last_key_idx is not None:
            last_key = self._keys[self._last_key_idx]
            last_value = getattr(self, last_key)
            last_value.complete()
        for func in self._on_complete_funcs:
            func(self._value)
        self._on_complete_funcs = []

    @property
    def value(self):
        return self._value

    @classmethod
    def to_pydantic(cls) -> type[BaseModel]:
        model = getattr(cls, "_pydantic_model", None)
        if model is not None:  # use cached model if available
            return model
        fields: dict[str, Any] = {}
        for name, type_hint in cls.__annotations__.items():
            type_hint = unwrap_raw_type(type_hint)
            field = getattr(cls, name, None)
            if field is not None:
                fields[name] = (type_hint, field)
            else:
                fields[name] = type_hint
        model = pydantic.create_model(cls.__name__, **fields, __doc__=cls.__doc__)
        setattr(cls, "_pydantic_model", model)
        return model


class List(Generic[T], StreamingValue[list]):
    """Represents a JSON array that is streamed.

    This class can handle a list of items that are themselves `StreamingValue`s
    (like `langdiff.Object` or `langdiff.String`) or complete values. It provides
    an `on_append` callback that is fired when a new item is added to the list.
    """

    _value: list
    _item_cls: type[T]
    _item_streaming: bool
    _decode: Callable | None
    _streaming_values: list[T]
    _on_append_funcs: list[Callable[[T, int], Any]]

    def __init__(self, item_cls: type[T]):
        super().__init__()
        self._value = []
        self._item_cls = item_cls
        self._item_streaming = issubclass(item_cls, StreamingValue)
        self._decode = get_decoder(item_cls) if not self._item_streaming else None
        self._streaming_values = []
        self._on_append_funcs = []

    def on_append(self, func: Callable[[T, int], Any]):
        self._on_append_funcs.append(func)

    def update(self, value: list):
        self._trigger_start()
        if not value:
            return
        if self._item_streaming:
            self._update_streaming(value)
        else:
            self._update_complete(value)

    def _update_streaming(self, value: list):
        prev_count = len(self._value)
        count = len(value)
        if count > prev_count:
            # expected call sequence on [A] -> [A, B, C, D]
            #  1. update(A) -> complete(A)
            #  2. on_append(B) -> update(B) -> complete(B)
            #     on_append(C) -> update(C) -> complete(C)
            #  3. on_append(D) -> update(D)

            # 1
            if prev_count > 0:
                s = self._streaming_values[prev_count - 1]
                assert isinstance(s, StreamingValue)
                s.update(value[prev_count - 1])
                s.complete()
            # 2
            for i in range(prev_count, count - 1):
                s = self._item_cls()
                self._streaming_values.append(s)
                for func in self._on_append_funcs:
                    func(s, i)
                assert isinstance(s, StreamingValue)
                s.update(value[i])
                s.complete()
            # 3
            s = self._item_cls()
            self._streaming_values.append(s)
            for func in self._on_append_funcs:
                func(s, count - 1)
            assert isinstance(s, StreamingValue)
            s.update(value[count - 1])
        else:
            s = self._streaming_values[-1]
            assert isinstance(s, StreamingValue)
            s.update(value[-1])
        self._value = value

    def _update_complete(self, value: list):
        prev_count = len(self._value)
        count = len(value)
        if count > prev_count:
            # expected call sequence on [A] -> [A, B, C, D]
            #  append(A) -> append(B) -> append(C)
            if prev_count > 0:
                start_idx = prev_count - 1
            else:
                start_idx = 0
            for i in range(start_idx, count - 1):
                s = value[i]
                if self._decode is not None:
                    s = self._decode(s)
                self._streaming_values.append(s)
                for func in self._on_append_funcs:
                    func(s, i)
        self._value = value

    def complete(self):
        if self._item_streaming:
            if self._streaming_values:
                last_value = self._streaming_values[-1]
                last_value.complete()
        else:
            if self._value:
                i = len(self._value) - 1
                s = self._value[i]
                if self._decode is not None:
                    s = self._decode(s)
                self._streaming_values.append(s)
                for func in self._on_append_funcs:
                    func(s, i)
        for func in self._on_complete_funcs:
            func(self._streaming_values)


class String(StreamingValue[str | None]):
    """Represents a string that is streamed incrementally.

    This class assumes that the string value is built up by concatenating chunks.
    It provides an `on_append` callback that is fired with each new chunk of the
    string.
    """

    def __init__(self):
        super().__init__()
        self._value = None
        self._on_append_funcs = []

    def on_append(self, func: Callable[[str], Any]):
        self._on_append_funcs.append(func)

    def update(self, value: str | None):
        self._trigger_start()
        if self._value is None:
            chunk = value
        else:
            if value is None or not value.startswith(self._value):
                raise ValueError(
                    "langdiff.String can only be updated with a continuation of the current value."
                )
            if len(value) == len(self._value):
                return
            chunk = value[len(self._value) :]
        if chunk is not None:
            for func in self._on_append_funcs:
                func(chunk)
        self._value = value

    def complete(self):
        for func in self._on_complete_funcs:
            func(self._value)


class Atom(Generic[T], StreamingValue[T]):
    """Represents a value that is not streamed incrementally but received whole.

    This is useful for types like numbers, booleans, or even entire objects/lists
    that are not streamed part-by-part but are present completely once available.
    The `on_complete` callback is triggered when the parent `langdiff.Object` or
    `langdiff.List` determines that this value is complete.
    """

    _value: T | None

    def __init__(self, item_cls: type[T]):
        super().__init__()
        self._value = None
        self._decode = get_decoder(item_cls)

    def update(self, value: T):
        self._trigger_start()
        self._value = value

    def complete(self):
        value = self._value
        if value is not None and self._decode is not None:
            value = self._decode(value)
        for func in self._on_complete_funcs:
            func(value)

    @property
    def value(self) -> T | None:
        """Returns the complete value."""
        return self._value


def _extract_pydantic_hint(type_hint: Any) -> type | None:
    """Extract PydanticType from Annotated type if present."""
    if typing.get_origin(type_hint) is Annotated:
        args = typing.get_args(type_hint)
        if len(args) >= 2:
            # Look for PydanticType in the metadata
            for metadata in args[1:]:
                if isinstance(metadata, PydanticType):
                    return metadata.pydantic_type
    return None


def unwrap_raw_type(type_hint: Any):
    # Possible types:
    # - Annotated[T, PydanticType(U)] => U (custom Pydantic type)
    # - Atom[T] => T
    # - List[T] => list[unwrap(T)]
    # - String => str
    # - T extends Object => T.to_pydantic()

    # First check for PydanticType in Annotated types
    pydantic_hint = _extract_pydantic_hint(type_hint)
    if pydantic_hint is not None:
        return pydantic_hint

    # Handle Annotated[T, ...] by extracting the base type
    if typing.get_origin(type_hint) is Annotated:
        type_hint = typing.get_args(type_hint)[0]

    if hasattr(type_hint, "__origin__"):
        origin = type_hint.__origin__
        if origin is Atom:
            return typing.get_args(type_hint)[0]
        elif origin is List:
            item_type = typing.get_args(type_hint)[0]
            return list[unwrap_raw_type(item_type)]  # type: ignore[misc]
    elif type_hint is String:
        return str
    elif issubclass(type_hint, Object):
        return type_hint.to_pydantic()
    elif issubclass(type_hint, StreamingValue):
        to_pydantic = getattr(type_hint, "to_pydantic", None)
        if to_pydantic is None or not callable(to_pydantic):
            raise ValueError(
                f"Custom StreamingValue type {type_hint} must implement to_pydantic() method."
            )
        return to_pydantic()
    elif (
        type_hint is str
        or type_hint is int
        or type_hint is float
        or type_hint is bool
        or issubclass(type_hint, BaseModel)
    ):
        return type_hint
    raise ValueError(
        f"Unsupported type hint: {type_hint}. Expected LangDiff Atom, List, String, or Object subclass."
    )
