from typing import TypeVar

from .change_tracker import ChangeTracker, DiffBuffer
from .changes import Operation, apply_change
from .impl import JSONPatchChangeTracker, EfficientJSONPatchChangeTracker

T = TypeVar("T")

__all__ = [
    "track_change",
    "DiffBuffer",
    "ChangeTracker",
    "JSONPatchChangeTracker",
    "EfficientJSONPatchChangeTracker",
    "Operation",
    "apply_change",
]


def track_change(
    obj: T, tracker_cls: type[ChangeTracker] = EfficientJSONPatchChangeTracker
) -> tuple[T, DiffBuffer]:
    """Wrap an object in a tracked proxy and return the tracker."""
    tracker = tracker_cls()
    tracked_obj = tracker.track(obj)
    return tracked_obj, tracker
