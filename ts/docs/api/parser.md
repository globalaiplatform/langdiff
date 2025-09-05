# Parser Module

The parser module provides streaming-aware data types and parsing capabilities for processing structured LLM outputs in real-time.

## Core Classes

### StreamingObject

Base class for objects that are streamed incrementally. Use this to define schemas for complex structured data.

**Constructor:**
```typescript
abstract class StreamingObject extends StreamingValue<Record<string, any>>
```

**Key Methods:**
- `toZod()` - Generate a Zod schema for this streaming object
- `fromZod(schema)` - Create a StreamingObject from a Zod schema (static method)
- `onUpdate(callback)` - Register callback for object updates
- `addField(key, fieldInstance, field?, zodType?)` - Add a field to the object

### StreamingList

Represents a list that is streamed incrementally.

**Constructor:**
```typescript
class StreamingList<T> extends StreamingValue<T[]>
constructor(itemClass: new () => T)
```

**Key Methods:**
- `onAppend(callback)` - Called when a new item is appended to the list

### StreamingString

Represents a string that is streamed incrementally.

**Constructor:**
```typescript
class StreamingString extends StreamingValue<string | null>
```

**Key Methods:**
- `onAppend(callback)` - Called with each new chunk of the string

### Atom

Represents an atomic value that is received whole, not streamed incrementally.

**Constructor:**
```typescript
class Atom<T> extends StreamingValue<T>
constructor(itemClass?: new (...args: any[]) => T)
```

## Parser

Parser for streaming JSON that can handle partial/incomplete JSON strings.

**Constructor:**
```typescript
class Parser
constructor(root: StreamingObject)
```

**Key Methods:**
- `push(chunk)` - Push a chunk of JSON string to the parser
- `complete()` - Mark the parsing as complete
- `use(callback)` - Use the parser with automatic completion (context manager pattern)

## Helper Classes

### Field

Field descriptor with optional validation and metadata. Equivalent to Python's pydantic.Field.

**Constructor:**
```typescript
class Field
constructor(options?: { description?: string; default?: any })
```

### ZodType

Type hint that specifies the Zod schema to use when converting to Zod models.

**Constructor:**
```typescript
class ZodType<T extends ZodBaseType = ZodBaseType>
constructor(zodSchema: T)
```

## Usage Examples

### Basic Object Streaming

```typescript
import { StreamingObject, StreamingString, StreamingList, Parser } from 'langdiff';

class BlogPost extends StreamingObject {
  title!: StreamingString;
  content!: StreamingString;
  tags!: StreamingList<StreamingString>;

  protected _initializeFields(): void {
    this.addField('title', new StreamingString());
    this.addField('content', new StreamingString());
    this.addField('tags', new StreamingList(StreamingString));
  }
}

const post = new BlogPost();

// Set up event handlers
post.title.onAppend((chunk: string) => {
  console.log(`Title chunk: ${chunk}`);
});

post.tags.onAppend((tag: StreamingString, index: number) => {
  tag.onComplete((finalTag: string | null) => {
    console.log(`New tag: ${finalTag}`);
  });
});

// Parse streaming JSON
const parser = new Parser(post);
parser.use((p) => {
  for (const token of jsonStream) {
    p.push(token);
  }
});
```

### Nested Structures

```typescript
class Comment extends StreamingObject {
  author!: StreamingString;
  text!: StreamingString;

  protected _initializeFields(): void {
    this.addField('author', new StreamingString());
    this.addField('text', new StreamingString());
  }
}

class Article extends StreamingObject {
  title!: StreamingString;
  comments!: StreamingList<Comment>;

  protected _initializeFields(): void {
    this.addField('title', new StreamingString());
    this.addField('comments', new StreamingList(Comment));
  }
}

const article = new Article();

article.comments.onAppend((comment: Comment, index: number) => {
  comment.author.onComplete((author: string | null) => {
    console.log(`Comment ${index} by ${author}`);
  });
  
  comment.text.onAppend((chunk: string) => {
    console.log(`Comment ${index} text: ${chunk}`);
  });
});
```

### OpenAI Integration

```typescript
import OpenAI from 'openai';

// Convert to Zod schema for OpenAI SDK
const responseFormat = new BlogPost().toZod();

const client = new OpenAI();
const stream = await client.chat.completions.create({
  model: "gpt-4",
  messages: [{role: "user", content: "Write a blog post"}],
  response_format: { type: "json_object" },
  stream: true
});

const post = new BlogPost();
const parser = new Parser(post);

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    parser.push(content);
  }
}

parser.complete();
```

### Zod Integration

```typescript
import { z } from 'zod';
import { StreamingObject, ZodType, Field } from 'langdiff';

// Define Zod schema
const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
  hobbies: z.array(z.string())
});

// Create StreamingObject from Zod schema
const UserStreamingClass = StreamingObject.fromZod(UserSchema);
const user = new UserStreamingClass();

// Or define manually with ZodType hints
class User extends StreamingObject {
  name!: StreamingString;
  age!: Atom<number>;
  hobbies!: StreamingList<StreamingString>;

  protected _initializeFields(): void {
    this.addField('name', new StreamingString(), 
      new Field({ description: "User's full name" }),
      new ZodType(z.string()));
    this.addField('age', new Atom(Number), 
      new Field({ description: "User's age" }),
      new ZodType(z.number()));
    this.addField('hobbies', new StreamingList(StreamingString));
  }
}
```

## Event System

All streaming types support three main events:

### onStart()
Called when streaming begins for a value:

```typescript
response.title.onStart(() => {
  console.log("Title streaming started");
});
```

### onAppend()
Called as new data is appended (specific to StreamingString and StreamingList):

```typescript
// For StreamingString
response.content.onAppend((chunk: string) => {
  console.log(`New content: ${chunk}`);
});

// For StreamingList
response.items.onAppend((item: StreamingString, index: number) => {
  console.log(`New item at index ${index}`);
});
```

### onComplete()
Called when a value is fully received:

```typescript
response.title.onComplete((finalTitle: string | null) => {
  console.log(`Title completed: ${finalTitle}`);
});
```

### onUpdate() (StreamingObject only)
Called whenever the object is updated:

```typescript
response.onUpdate((value: Record<string, any>) => {
  console.log('Object updated:', value);
});
```

## Type Aliases

For convenience, the following type aliases are provided:

```typescript
import { String, List, Atom, Object } from 'langdiff';

// Equivalent to:
// import { StreamingString, StreamingList, Atom, StreamingObject } from 'langdiff';

class MyClass extends Object {
  title!: String;
  items!: List<String>;
  count!: Atom<number>;
  // ...
}
```