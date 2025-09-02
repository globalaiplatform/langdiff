import re
from io import StringIO
from typing import Any

import jiter

from .model import Object

PARTIAL_UNICODE_PATTERN = re.compile("\\\\u[0-9a-fA-F]{0,3}$")


class Parser:
    def __init__(self, root: Object):
        self._root = root
        self._snapshot = StringIO()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type is None:
            self.complete()

    def push(self, chunk: str):
        if chunk == "":
            return
        self._snapshot.write(chunk)
        self._root.update(parse_partial_json(self._snapshot.getvalue()))

    def complete(self):
        self._root.complete()


def parse_partial_json(json_str: str) -> Any:
    if not json_str.strip():
        return ""

    if (
        json_str.endswith('"')
        and not json_str.endswith('\\"')
        and not json_str.endswith(':"')
    ):
        json_str = json_str[:-1]
    elif json_str.endswith("\\") and not json_str.endswith("\\\\"):
        json_str = json_str[:-1]
    else:
        # Workaround for https://github.com/pydantic/jiter/issues/207
        m = PARTIAL_UNICODE_PATTERN.search(json_str)
        if m:
            json_str = json_str[: -len(m.group(0))]

    return jiter.from_json(
        json_str.encode("utf-8"), cache_mode="keys", partial_mode="trailing-strings"
    )
