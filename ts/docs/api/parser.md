# Parser Module

The parser module provides streaming-aware data types and parsing capabilities for processing structured LLM outputs in real-time using a modern functional schema builder API.

## Schema Builder Functions

### string()

Creates a streaming string schema that processes string values incrementally.

```typescript
import * as ld from '@langdiff/langdiff';

const schema = ld.string();
const instance = schema.create();
```

**Methods:**
- `create()` - Creates a `StreamingString` instance
- `toZod()` - Returns `z.string()`
- `describe(description)` - Add description metadata
- `default(value)` - Set default value

### array(itemSchema)

Creates a streaming array schema that processes array items incrementally.

```typescript
import * as ld from '@langdiff/langdiff';

// Array of strings
const stringArray = ld.array(ld.string());

// Array of objects  
const objectArray = ld.array(ld.object({
  name: ld.string(),
  age: ld.number()
}));

// Array of atoms
const numberArray = ld.array(ld.number());
```

**Methods:**
- `create()` - Creates a `StreamingList` or `StreamingAtomList` instance
- `toZod()` - Returns `z.array(itemSchema.toZod())`

### object(fields)

Creates a streaming object schema with specified fields.

```typescript
import * as ld from '@langdiff/langdiff';

const UserSchema = ld.object({
  name: ld.string(),
  age: ld.number(),
  hobbies: ld.array(ld.string()),
  profile: ld.object({
    bio: ld.string(),
    avatar: ld.string()
  })
});
```

**Methods:**
- `create()` - Creates a `StreamingObject` instance with typed field access
- `toZod()` - Returns `z.object()` with field schemas

### number()

Creates a number atom schema for non-streaming numeric values.

```typescript
import * as ld from '@langdiff/langdiff';

const numberSchema = ld.number();
const instance = numberSchema.create(); // Returns Atom<number>
```

### boolean()

Creates a boolean atom schema for non-streaming boolean values.

```typescript
import * as ld from '@langdiff/langdiff';

const booleanSchema = ld.boolean();
const instance = booleanSchema.create(); // Returns Atom<boolean>
```

### atom(zodSchema)

Creates a custom atom schema using any Zod schema for non-streaming values.

```typescript
import * as ld from '@langdiff/langdiff';
import { z } from 'zod';

const dateSchema = ld.atom(z.date());
const enumSchema = ld.atom(z.enum(['red', 'green', 'blue']));
```

### fromZod(zodSchema)

Creates a streaming schema from an existing Zod schema, automatically converting Zod types to their streaming equivalents.

```typescript
import * as ld from '@langdiff/langdiff';
import { z } from 'zod';

// Existing Zod schema
const UserZodSchema = z.object({
  name: z.string(),
  age: z.number(),
  hobbies: z.array(z.string())
});

// Convert to streaming schema
const UserStreamingSchema = ld.fromZod(UserZodSchema);
const user = UserStreamingSchema.create();

// Use normally with streaming callbacks
user.name.onAppend((chunk) => console.log(chunk));
user.hobbies.onAppend((hobby, index) => {
  hobby.onComplete((value) => console.log(`Hobby ${index}: ${value}`));
});
```

## Core Streaming Classes

### StreamingString

Represents a string value that is built incrementally from chunks.

**Key Methods:**
- `onStart(callback)` - Called when streaming begins
- `onAppend(callback)` - Called with each new chunk: `(chunk: string) => void`
- `onComplete(callback)` - Called when complete: `(value: string | null) => void`

### StreamingList<T>

Represents an array that receives items incrementally.

**Key Methods:**
- `onStart(callback)` - Called when streaming begins
- `onAppend(callback)` - Called when new item added: `(item: T, index: number) => void`
- `onComplete(callback)` - Called when complete: `(value: T[]) => void`

### StreamingObject<T>

Represents an object with streaming field values.

**Key Methods:**
- `onStart(callback)` - Called when streaming begins
- `onUpdate(callback)` - Called on any field update: `(value: Record<string, any>) => void`
- `onComplete(callback)` - Called when complete: `(value: T) => void`

### Atom<T>

Represents atomic values (numbers, booleans, etc.) that are received as complete values.

**Key Methods:**
- `onStart(callback)` - Called when value is received
- `onComplete(callback)` - Called with the final value: `(value: T) => void`

## Parser

Processes streaming JSON tokens and updates streaming objects incrementally.

**Constructor:**
```typescript
import * as ld from '@langdiff/langdiff';

const schema = ld.object({ title: ld.string() });
const instance = schema.create();
const parser = new ld.Parser(instance);
```

**Key Methods:**
- `push(chunk: string)` - Process a chunk of JSON string
- `complete()` - Mark parsing as complete and trigger final callbacks

## Usage Examples

### Basic Streaming

```typescript
import * as ld from '@langdiff/langdiff';

// Define schema
const ShoppingList = ld.object({
  items: ld.array(ld.string()),
  completed: ld.boolean()
});

// Create instance and set up callbacks
const list = ShoppingList.create();

list.items.onAppend((item: ld.StreamingString, index: number) => {
  console.log(`New item #${index} started`);
  
  item.onAppend((chunk: string) => {
    console.log(`  Chunk: "${chunk}"`);
  });
  
  item.onComplete((finalValue: string | null) => {
    console.log(`  Completed: "${finalValue}"`);
  });
});

// Parse streaming data
const parser = new ld.Parser(list);
const chunks = ['{"items": ["Mi', 'lk", "Br', 'ead"], "completed": true}'];

for (const chunk of chunks) {
  parser.push(chunk);
}
parser.complete();
```

### Nested Objects

```typescript
import * as ld from '@langdiff/langdiff';

const BlogPost = ld.object({
  title: ld.string(),
  author: ld.object({
    name: ld.string(),
    email: ld.string()
  }),
  comments: ld.array(ld.object({
    text: ld.string(),
    likes: ld.number()
  }))
});

const post = BlogPost.create();

// Set up nested callbacks
post.author.name.onAppend((chunk: string) => {
  console.log(`Author name: ${chunk}`);
});

post.comments.onAppend((comment, index: number) => {
  comment.text.onAppend((chunk: string) => {
    console.log(`Comment ${index}: ${chunk}`);
  });
  
  comment.likes.onComplete((likes: number) => {
    console.log(`Comment ${index} has ${likes} likes`);
  });
});

const parser = new ld.Parser(post);
// ... process streaming JSON
```

### OpenAI Integration

```typescript
import * as ld from '@langdiff/langdiff';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';

const ArticleSchema = ld.object({
  title: ld.string(),
  sections: ld.array(ld.object({
    heading: ld.string(),
    content: ld.string()
  }))
});

const client = new OpenAI();

// Use Zod schema with OpenAI
const stream = await client.chat.completions.create({
  model: "gpt-4",
  messages: [{role: "user", content: "Write an article about TypeScript"}],
  stream: true,
  response_format: zodResponseFormat(ArticleSchema.toZod(), 'Article'),
});

// Set up streaming response handling
const article = ArticleSchema.create();
const parser = new ld.Parser(article);

article.sections.onAppend((section, index) => {
  section.heading.onComplete((heading) => {
    console.log(`Section ${index}: ${heading}`);
  });
  
  section.content.onAppend((chunk) => {
    process.stdout.write(chunk); // Stream content in real-time
  });
});

// Process stream
for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    parser.push(content);
  }
}
parser.complete();
```

### Working with Atoms

```typescript
import * as ld from '@langdiff/langdiff';
import { z } from 'zod';

const UserProfile = ld.object({
  name: ld.string(),
  age: ld.number(),
  isActive: ld.boolean(),
  role: ld.atom(z.enum(['admin', 'user', 'guest'])),
  metadata: ld.atom(z.record(z.any()))
});

const profile = UserProfile.create();

// Atoms receive complete values
profile.age.onComplete((age: number) => {
  console.log(`User is ${age} years old`);
});

profile.role.onComplete((role: 'admin' | 'user' | 'guest') => {
  console.log(`User role: ${role}`);
});
```

### Schema Customization

```typescript
import * as ld from '@langdiff/langdiff';
import { z } from 'zod';

const ProductSchema = ld.object({
  name: ld.string()
    .describe("Product name")
    .default("Unnamed Product"),
  price: ld.number()
    .describe("Price in USD"),
  tags: ld.array(ld.string())
    .describe("Product tags"),
  category: ld.atom(z.string().min(1))
    .describe("Product category")
});

// Get Zod schema for validation
const zodSchema = ProductSchema.toZod();
console.log(zodSchema._def); // Contains descriptions and defaults
```

### fromZod Integration

Create streaming schemas from existing Zod schemas:

```typescript
import * as ld from '@langdiff/langdiff';
import { z } from 'zod';

// Existing Zod schema
const UserZodSchema = z.object({
  name: z.string(),
  age: z.number(),
  hobbies: z.array(z.string())
});

// Convert to streaming schema
const UserStreamingSchema = ld.fromZod(UserZodSchema);
const user = UserStreamingSchema.create();

// Use normally with streaming callbacks
user.name.onAppend((chunk) => console.log(chunk));
user.hobbies.onAppend((hobby, index) => {
  hobby.onComplete((value) => console.log(`Hobby ${index}: ${value}`));
});
```

## Type Aliases

For convenience, the following type aliases are available:

```typescript
import { String, Object } from '@langdiff/langdiff';

// String is an alias for StreamingString
// Object is an alias for StreamingObject<any>
```

**Note:** These are type aliases, not runtime values. Use them for type annotations:

```typescript
// ✅ Correct usage - type annotations
function handleString(str: String): void {
  str.onAppend(chunk => console.log(chunk));
}

const stringInstance: String = ld.string().create();

// ❌ Incorrect usage - runtime values
const instance = new String();  // Error! String is not a class
const result = String.create(); // Error! String is not a function
```

## Event System

All streaming types support a consistent event system:

### Event Order
1. `onStart()` - Fired when streaming begins
2. `onAppend()` - Fired for each chunk/item (StreamingString/StreamingList only)
3. `onComplete()` - Fired when streaming finishes

### Error Handling
Events allow errors to propagate naturally - if a callback throws an error, it will bubble up to your application code:

```typescript
const schema = ld.object({ title: ld.string() });
const instance = schema.create();

instance.title.onAppend((chunk) => {
  if (chunk.includes('bad_word')) {
    throw new Error('Content filter violation');
  }
});

try {
  const parser = new ld.Parser(instance);
  parser.push('{"title": "bad_word detected"}');
} catch (error) {
  console.error('Streaming error:', error.message);
}
```