# API Reference Overview

LangDiff provides two main modules for streaming structured data and tracking changes:

## Parser Module

The parser module contains streaming-aware data types and the core parser for processing token streams.

### Core Classes

- **[`StreamingObject`](parser.md#StreamingObject)** - Base class for streaming JSON objects
- **[`StreamingList`](parser.md#StreamingList)** - Represents a streaming JSON array
- **[`StreamingString`](parser.md#StreamingString)** - Represents a streaming string value
- **[`Atom`](parser.md#Atom)** - Represents atomic values (numbers, booleans, null)
- **[`Parser`](parser.md#Parser)** - Processes token streams and triggers callbacks

### Helper Classes

- **[`Field`](parser.md#Field)** - Field descriptor with validation and metadata (pydantic equivalent)
- **[`ZodType`](parser.md#ZodType)** - Type hint for Zod schema specification

### Type Aliases

- **`String`** - Alias for `StreamingString`
- **`List<T>`** - Alias for `StreamingList<T>`
- **`Atom<T>`** - Alias for `Atom<T>`
- **`Object`** - Alias for `StreamingObject`

### Key Features

- **Event Callbacks**: All streaming types support `onStart`, `onAppend`, and `onComplete` callbacks
- **Type Safety**: Full TypeScript generics and interfaces for compile-time checking
- **Zod Integration**: Convert streaming models to Zod schemas via `toZod()` and `fromZod()`

## Tracker Module  

The tracker module provides change tracking capabilities for generating JSON Patch diffs.

### Core Classes

- **[`ChangeTracker`](tracker.md#ChangeTracker)** - Abstract base for change tracking
- **[`JSONPatchChangeTracker`](tracker.md#JSONPatchChangeTracker)** - Standard JSON Patch tracking
- **[`EfficientJSONPatchChangeTracker`](tracker.md#EfficientJSONPatchChangeTracker)** - Enhanced tracking with `append` operations

### Utility Functions

- **[`trackChange()`](tracker.md#trackChange)** - Wrap objects for automatic change tracking
- **[`applyChange()`](tracker.md#applyChange)** - Apply JSON Patch operations to objects

## Usage Patterns

### Basic Streaming

```typescript
import { StreamingObject, StreamingString, StreamingList, Parser } from 'langdiff';

// Define schema
class Response extends StreamingObject {
  title!: StreamingString;
  items!: StreamingList<StreamingString>;

  protected _initializeFields(): void {
    this.addField('title', new StreamingString());
    this.addField('items', new StreamingList(StreamingString));
  }
}

// Set up callbacks
const response = new Response();

response.title.onAppend((chunk: string) => {
  console.log(`Title: ${chunk}`);
});

// Parse stream
const parser = new Parser(response);
parser.use((p) => {
  for (const token of stream) {
    p.push(token);
  }
  // complete() is called automatically
});
```

### Change Tracking

```typescript
import { trackChange } from 'langdiff';

interface UI {
  items: string[];
}

// Track changes to any object
const [obj, diffBuf] = trackChange<UI>({ items: [] });

// Make modifications
obj.items.push("new item");

// Get JSON Patch operations
const changes = diffBuf.flush();
```
