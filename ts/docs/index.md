# LangDiff

LangDiff is a TypeScript library that solves the hard problems of streaming structured LLM outputs to frontends.

![Diagram](/ts/docs/diagram.png)

LangDiff provides intelligent partial parsing with granular, type-safe events as JSON structures build token by token, plus automatic JSON Patch generation for efficient frontend synchronization. Build responsive AI applications where your backend structures and frontend experiences can evolve independently.

## Core Features

### Streaming Parsing
- Define schemas for streaming structured outputs using class-based models
- Receive granular, type-safe callbacks (`onAppend`, `onUpdate`, `onComplete`) as tokens stream in
- Convert to Zod schemas for seamless interop with existing libraries and SDKs like OpenAI SDK

### Change Tracking
- Track mutations without changing your code patterns by instrumenting existing objects and arrays
- Generate JSON Patch diffs automatically for efficient state synchronization between frontend and backend

```typescript
response.text.onAppend((chunk: string) => {
  ui.body[ui.body.length - 1] = ui.body[ui.body.length - 1].slice(5, -6); // remove <ins> tags
  ui.body.push(`<ins>${chunk}</ins>`);
});

// Tracked UI changes:
// {"op": "add", "path": "/body/-", "value": "<ins>Hell</ins>"}
// {"op": "replace", "path": "/body/0", "value": "Hell"}
// {"op": "add", "path": "/body/-", "value": "<ins>o, world!</ins>"}
```

## Installation

```bash
npm install langdiff
```

For yarn:

```bash
yarn add langdiff
```

## Quick Example

```typescript
import * as ld from '@langdiff/langdiff';
import OpenAI from 'openai';

class ArticleResponse extends ld.Object {
  title!: ld.String;
  sections!: ld.List<ld.String>;

  protected _initializeFields(): void {
    this.addField('title', new ld.String());
    this.addField('sections', new ld.List(ld.String));
  }
}

// Set up streaming callbacks
const response = new ArticleResponse();

response.title.onAppend((chunk: string) => {
  process.stdout.write(`Title: ${chunk}`);
});

response.sections.onAppend((section: ld.String, index: number) => {
  console.log(`\n\nSection ${index + 1}:`);
  
  section.onAppend((chunk: string) => {
    process.stdout.write(chunk);
  });
});

// Stream from OpenAI
const client = new OpenAI();
const stream = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Write a short article about TypeScript" }],
  response_format: { type: "json_object" },
  stream: true
});

const parser = new ld.Parser(response);

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    parser.push(content);
  }
}

parser.complete();
```

## Why LangDiff?

Modern AI applications increasingly rely on LLMs to generate structured data rather than just conversational text. While LLM providers offer structured output capabilities, streaming these outputs poses unique challenges:

- **Partial JSON Parsing**: Standard parsers can't handle incomplete tokens like `{"sentence": "Hello,` until closing quotes arrive
- **Type Safety**: Lose static type checking when dealing with partial objects
- **Frontend Coupling**: Tightly coupling UI to LLM schemas creates maintenance issues
- **Inefficient Updates**: Sending entire objects instead of just changes wastes bandwidth

LangDiff solves these problems through intelligent streaming parsing and change-based synchronization, enabling you to build responsive, maintainable AI applications.