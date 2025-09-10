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

### Schema Builder Functions

- **[`string()`](parser.md#string)** - Create a streaming string schema
- **[`array(itemSchema)`](parser.md#array)** - Create a streaming array schema
- **[`object(fields)`](parser.md#object)** - Create a streaming object schema
- **[`number()`](parser.md#number)** - Create a number atom schema
- **[`boolean()`](parser.md#boolean)** - Create a boolean atom schema
- **[`atom(zodSchema)`](parser.md#atom)** - Create a custom atom schema
- **[`fromZod(zodSchema)`](parser.md#fromZod)** - Create streaming schema from Zod schema

### Type Aliases

- **`String`** - Alias for `StreamingString`
- **`Object`** - Alias for `StreamingObject`

### Key Features

- **Event Callbacks**: All streaming types support `onStart`, `onAppend`, and `onComplete` callbacks
- **Type Safety**: Full TypeScript generics and interfaces for compile-time checking
- **Zod Integration**: Convert streaming schemas to Zod schemas via `toZod()` and create from Zod schemas via `fromZod()`

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
import * as ld from '@langdiff/langdiff';

// Define schema using the modern functional API
const Response = ld.object({
  title: ld.string(),
  items: ld.array(ld.string())
});

// Set up callbacks
const response = Response.create();

response.title.onAppend((chunk: string) => {
  console.log(`Title: ${chunk}`);
});

// Parse stream
const parser = new ld.Parser(response);
for (const chunk of streamChunks) {
  parser.push(chunk);
}
parser.complete();
```

### Change Tracking

```typescript
import { trackChange } from '@langdiff/langdiff';

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
