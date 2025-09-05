# LangDiff Examples

This directory contains practical examples demonstrating various features and use cases of LangDiff.

## Examples Overview

### 01. Basic Streaming (`01-basic-streaming.ts`)
Demonstrates fundamental streaming parser capabilities with a simple shopping list example.

**Key concepts:**
- Creating streaming objects
- Setting up event handlers (`onAppend`, `onComplete`)
- Progressive JSON parsing

```bash
npx ts-node examples/01-basic-streaming.ts
```

### 02. Change Tracking (`02-change-tracking.ts`)
Shows how to track object mutations and generate JSON Patch operations.

**Key concepts:**
- Using `trackChange()` to monitor mutations
- Generating JSON Patch diffs
- Applying changes to remote objects

```bash
npx ts-node examples/02-change-tracking.ts
```

### 03. OpenAI Integration (`03-openai-integration.ts`)
Demonstrates real-world integration with OpenAI's streaming API for AI applications.

**Key concepts:**
- Streaming LLM responses
- Complex nested object structures
- Real-time AI application patterns

```bash
# With OpenAI API key
OPENAI_API_KEY=your-key-here npx ts-node examples/03-openai-integration.ts

# With mock data (no API key required)
npx ts-node examples/03-openai-integration.ts
```

### 04. Frontend Integration (`04-frontend-integration.ts`)
Shows how to integrate LangDiff with frontend frameworks using Server-Sent Events.

**Key concepts:**
- SSE-based streaming
- React/Vue integration patterns
- Efficient state synchronization

```bash
npx ts-node examples/04-frontend-integration.ts
```

### 05. Article Generation (`05-article-generation.ts`)
Complete article generation scenario demonstrating both streaming parsing and change tracking together.

**Key concepts:**
- Multi-section article generation
- Combined streaming and change tracking
- Real-time UI updates with console rendering
- Mock LLM streaming simulation

```bash
npx ts-node examples/05-article-generation.ts
```

## Running All Examples

To run all examples in sequence:

```bash
npm run examples
```

## Prerequisites

Make sure you have installed the dependencies:

```bash
npm install
```

For the OpenAI example, you'll need an API key (optional - works with mock data):

```bash
export OPENAI_API_KEY=your-key-here
```

## Example Patterns

### Basic Streaming Pattern

```typescript
import { StreamingObject, StreamingString, Parser } from 'langdiff';

class MyResponse extends StreamingObject {
  message!: StreamingString;

  protected _initializeFields(): void {
    this.addField('message', new StreamingString());
  }
}

const response = new MyResponse();
response.message.onAppend(chunk => console.log(chunk));

const parser = new Parser(response);
parser.push('{"message": "Hello, ');
parser.push('world!"}');
parser.complete();
```

### Change Tracking Pattern

```typescript
import { trackChange, applyChange } from 'langdiff';

const [state, diffBuffer] = trackChange({ items: [] });
state.items.push('new item');

const changes = diffBuffer.flush();
// changes: [{ op: 'add', path: '/items/-', value: 'new item' }]

// Apply to another object
const remoteState = { items: [] };
applyChange(remoteState, changes);
```

### Server-Sent Events Pattern

```typescript
// Server side
const [state, diffBuffer] = trackChange(initialState);
response.message.onAppend(() => {
  const changes = diffBuffer.flush();
  res.write(`data: ${JSON.stringify({ changes })}\n\n`);
});

// Client side
const eventSource = new EventSource('/api/stream');
eventSource.onmessage = (event) => {
  const { changes } = JSON.parse(event.data);
  applyChange(clientState, changes);
};
```

## Advanced Topics

- **Performance**: Change tracking is optimized for large objects
- **Memory**: Streaming objects handle partial states efficiently  
- **Error Handling**: All examples include proper error handling patterns
- **Type Safety**: Full TypeScript support with generics

## Need Help?

- Check the main [README.md](../README.md) for detailed API documentation
- Look at the [tests](../tests/) directory for more usage examples
- Review the source code in [src](../src/) for implementation details