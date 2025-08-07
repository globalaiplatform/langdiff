# API Reference Overview

LangDiff provides two main modules for streaming structured data and tracking changes:

## Parser Module

The parser module contains streaming-aware data types and the core parser for processing token streams.

### Core Classes

- **[`Object`](parser.md#langdiff.Object)** - Represents a streaming JSON object
- **[`List`](parser.md#langdiff.List)** - Represents a streaming JSON array
- **[`String`](parser.md#langdiff.String)** - Represents a streaming string value
- **[`Atom`](parser.md#langdiff.Atom)** - Represents atomic values (numbers, booleans, null)
- **[`Parser`](parser.md#langdiff.Parser)** - Processes token streams and triggers callbacks

### Key Features

- **Event Callbacks**: All streaming types support `on_start`, `on_append`, and `on_complete` callbacks
- **Type Safety**: Full type hints and generic support for compile-time checking
- **Pydantic Integration**: Convert streaming models to Pydantic models via `to_pydantic()`

## Tracker Module  

The tracker module provides change tracking capabilities for generating JSON Patch diffs.

### Core Classes

- **[`ChangeTracker`](tracker.md#langdiff.ChangeTracker)** - Abstract base for change tracking
- **[`JSONPatchChangeTracker`](tracker.md#langdiff.JSONPatchChangeTracker)** - Standard JSON Patch tracking
- **[`EfficientJSONPatchChangeTracker`](tracker.md#langdiff.EfficientJSONPatchChangeTracker)** - Enhanced tracking with `append` operations

### Utility Functions

- **[`track_change()`](tracker.md#langdiff.track_change)** - Wrap objects for automatic change tracking
- **[`apply_change()`](tracker.md#langdiff.apply_change)** - Apply JSON Patch operations to objects

## Usage Patterns

### Basic Streaming

```python
import langdiff as ld

# Define schema
class Response(ld.Object):
    title: ld.String
    items: ld.List[ld.String]

# Set up callbacks
response = Response()

@response.title.on_append
def on_title_chunk(chunk: str):
    print(f"Title: {chunk}")

# Parse stream
with ld.Parser(response) as parser:
    for token in stream:
        parser.push(token)
```

### Change Tracking

```python
# Track changes to any object
obj, diff_buf = ld.track_change(UI(items=[]))

# Make modifications
obj.items.append("new item")

# Get JSON Patch operations
changes = diff_buf.flush()
```
