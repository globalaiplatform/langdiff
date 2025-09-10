# Tracker Module

The tracker module provides automatic change tracking for Python objects, generating JSON Patch operations for efficient state synchronization.

## Core Functions

::: langdiff.track_change
    options:
      show_root_heading: true
      show_source: false
      heading_level: 3

::: langdiff.apply_change
    options:
      show_root_heading: true
      show_source: false
      heading_level: 3

## Change Trackers

::: langdiff.ChangeTracker
    options:
      show_root_heading: true
      show_signature: false
      separate_signature: false
      show_source: false
      heading_level: 3

::: langdiff.JSONPatchChangeTracker
    options:
      show_root_heading: true
      show_signature: false
      separate_signature: false
      show_source: false
      heading_level: 3

::: langdiff.EfficientJSONPatchChangeTracker
    options:
      show_root_heading: true
      show_signature: false
      separate_signature: false
      show_source: false
      heading_level: 3

## Operations

::: langdiff.Operation
    options:
      show_root_heading: true
      show_source: false
      heading_level: 3

## Usage Examples

### Basic Change Tracking

```python
import langdiff as ld
from pydantic import BaseModel

class UserProfile(BaseModel):
    name: str = ""
    age: int = 0
    hobbies: list[str] = []

# Wrap object for tracking
profile, diff_buf = ld.track_change(UserProfile())

# Make changes
profile.name = "Alice"
profile.age = 25
profile.hobbies.append("reading")

# Get accumulated changes
changes = diff_buf.flush()
print(changes)
# [
#   {"op": "replace", "path": "/name", "value": "Alice"},
#   {"op": "replace", "path": "/age", "value": 25},
#   {"op": "add", "path": "/hobbies/-", "value": "reading"}
# ]
```

### Different Tracker Types

```python
# Standard JSON Patch (RFC 6902 compliant)
profile, diff_buf = ld.track_change(
    UserProfile(), 
    tracker_cls=ld.JSONPatchChangeTracker
)

# Efficient tracker with append operations (default)
profile, diff_buf = ld.track_change(
    UserProfile(), 
    tracker_cls=ld.EfficientJSONPatchChangeTracker
)
```

### Applying Changes

```python
# Original object
original = {"count": 0, "items": []}

# Changes to apply
changes = [
    {"op": "replace", "path": "/count", "value": 5},
    {"op": "add", "path": "/items/-", "value": "new item"}
]

# Apply changes
ld.apply_change(original, changes)
print(original)
# {"count": 5, "items": ["new item"]}
```
