# Tracker Module

The tracker module provides automatic change tracking for TypeScript objects, generating JSON Patch operations for efficient state synchronization.

## Core Functions

### trackChange()

Wrap objects for automatic change tracking.

**Signature:**
```typescript
function trackChange<T>(
  obj: T, 
  trackerCls?: new () => ChangeTracker
): [T, DiffBuffer]
```

**Parameters:**
- `obj` - The object to track changes for
- `trackerCls` - Optional tracker class (defaults to EfficientJSONPatchChangeTracker)

**Returns:** A tuple containing the proxied object and a diff buffer.

### applyChange()

Apply JSON Patch operations to an object.

**Signature:**
```typescript
function applyChange(obj: any, operations: Operation[]): void
```

**Parameters:**
- `obj` - The target object to apply changes to
- `operations` - Array of JSON Patch operations to apply

## Change Trackers

### ChangeTracker

Abstract base class for change tracking implementations.

**Key Methods:**
- `track<T>(obj: T): T` - Track changes to an object and return a proxy
- `flush(): Operation[]` - Get and clear accumulated changes
- `getChanges(): Operation[]` - Get accumulated changes without clearing
- `clear(): void` - Clear accumulated changes

### JSONPatchChangeTracker

JSON Patch change tracker that generates standard JSON Patch operations (RFC 6902 compliant).

**Features:**
- Standard `add`, `remove`, `replace` operations
- Custom `append` operation for efficient string concatenation
- Full JSON Patch compliance

### EfficientJSONPatchChangeTracker

Enhanced JSON Patch change tracker with optimized string append operations.

**Features:**
- All JSONPatchChangeTracker features
- Optimized string append detection
- Better performance for streaming text scenarios

## Interfaces

### Operation

Represents a JSON Patch operation.

**Interface:**
```typescript
interface Operation {
  op: string;           // Operation type: 'add', 'remove', 'replace', 'append', etc.
  path: string;         // JSON Pointer path
  value?: any;          // Value for add/replace/append operations
  from?: string;        // Source path for move/copy operations
}
```

### DiffBuffer

Interface for objects that provide change tracking capabilities.

**Interface:**
```typescript
interface DiffBuffer {
  flush(): Operation[];      // Get and clear changes
  getChanges(): Operation[]; // Get changes without clearing
  clear(): void;             // Clear accumulated changes
}
```

## Usage Examples

### Basic Change Tracking

```typescript
import { trackChange } from 'langdiff';

interface UserProfile {
  name: string;
  age: number;
  hobbies: string[];
}

// Wrap object for tracking
const [profile, diffBuf] = trackChange<UserProfile>({
  name: "",
  age: 0,
  hobbies: []
});

// Make changes
profile.name = "Alice";
profile.age = 25;
profile.hobbies.push("reading");

// Get accumulated changes
const changes = diffBuf.flush();
console.log(changes);
// [
//   {"op": "replace", "path": "/name", "value": "Alice"},
//   {"op": "replace", "path": "/age", "value": 25},
//   {"op": "add", "path": "/hobbies/-", "value": "reading"}
// ]
```

### Different Tracker Types

```typescript
import { trackChange, JSONPatchChangeTracker, EfficientJSONPatchChangeTracker } from 'langdiff';

// Standard JSON Patch (RFC 6902 compliant)
const [profile1, diffBuf1] = trackChange(
  { name: "", age: 0, hobbies: [] }, 
  JSONPatchChangeTracker
);

// Efficient tracker with append operations (default)
const [profile2, diffBuf2] = trackChange(
  { name: "", age: 0, hobbies: [] }, 
  EfficientJSONPatchChangeTracker // This is the default
);
```

### String Append Optimization

```typescript
interface ChatMessage {
  content: string;
  timestamp: number;
}

const [message, diffBuf] = trackChange<ChatMessage>({
  content: "",
  timestamp: Date.now()
});

// Simulate streaming text - efficient append operations are detected
message.content = "Hello";
message.content = "Hello world";
message.content = "Hello world! How are you?";

const changes = diffBuf.flush();
// [
//   {"op": "replace", "path": "/content", "value": "Hello"},
//   {"op": "append", "path": "/content", "value": " world"},
//   {"op": "append", "path": "/content", "value": "! How are you?"}
// ]
```

### Applying Changes

```typescript
import { applyChange } from 'langdiff';

// Original object
const original = { count: 0, items: [] as string[] };

// Changes to apply
const changes = [
  { op: "replace", path: "/count", value: 5 },
  { op: "add", path: "/items/-", value: "new item" },
  { op: "append", path: "/items/0", value: " (updated)" }
];

// Apply changes
applyChange(original, changes);
console.log(original);
// { count: 5, items: ["new item (updated)"] }
```

### Integration with Streaming Parser

```typescript
import { StreamingObject, StreamingString, Parser, trackChange } from 'langdiff';

class Response extends StreamingObject {
  content!: StreamingString;
  
  protected _initializeFields(): void {
    this.addField('content', new StreamingString());
  }
}

// Create tracked UI state
interface UIState {
  displayText: string;
  isComplete: boolean;
}

const [uiState, diffBuf] = trackChange<UIState>({
  displayText: "",
  isComplete: false
});

// Set up streaming response
const response = new Response();
response.content.onAppend((chunk: string) => {
  uiState.displayText += chunk; // Tracked as append operations
});

response.onComplete(() => {
  uiState.isComplete = true;
});

// Parse streaming JSON
const parser = new Parser(response);
parser.push('{"content": "Hello');
parser.push(' world!"}');
parser.complete();

// Get efficient diff operations for frontend
const uiChanges = diffBuf.flush();
console.log(uiChanges);
// Efficient append operations instead of full content replacement
```

## JSON Patch Operations

The tracker module supports standard JSON Patch operations plus a custom `append` operation:

### Standard Operations

- **`add`** - Add a new value at the specified path
- **`remove`** - Remove the value at the specified path  
- **`replace`** - Replace the value at the specified path
- **`move`** - Move a value from one path to another
- **`copy`** - Copy a value from one path to another
- **`test`** - Test that the value at the path matches the given value

### Custom Operations

- **`append`** - Efficiently append to a string value (non-standard but useful for streaming)

### Path Format

JSON Patch uses JSON Pointer (RFC 6901) for paths:

- `/name` - Root level property "name"
- `/items/0` - First item in "items" array
- `/items/-` - Append to "items" array
- `/user/profile/email` - Nested property access

### Examples

```typescript
const operations = [
  { op: "add", path: "/items/-", value: "new item" },
  { op: "replace", path: "/status", value: "active" },
  { op: "remove", path: "/temp" },
  { op: "append", path: "/message", value: " (updated)" }
];
```
