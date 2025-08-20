# LangDiff

LangDiff is a Python library that solves the hard problems of streaming structured LLM outputs to frontends.

![Diagram](./diagram.png)

LangDiff provides intelligent partial parsing with granular, type-safe events as JSON structures build token by token, plus automatic JSON Patch generation for efficient frontend synchronization. Build responsive AI applications where your backend structures and frontend experiences can evolve independently.

## Core Features

### Streaming Parsing
- Define schemas for streaming structured outputs using Pydantic-style models
- Receive granular, type-safe callbacks (`on_append`, `on_update`, `on_complete`) as tokens stream in
- Derive Pydantic models from LangDiff models for seamless interop with existing libraries and SDKs like OpenAI SDK

### Change Tracking
- Track mutations without changing your code patterns by instrumenting existing Pydantic models, or plain Python dict/list/objects
- Generate JSON Patch diffs automatically for efficient state synchronization between frontend and backend

```python
@response.text.on_append
def on_text_append(chunk: str, index: int):
    ui.body[-1] = ui.body[-1][5:-6]  # remove <ins> tags
    ui.body.append(f"<ins>{chunk}</ins>")

# Tracked UI changes:
# {"op": "add", "path": "/body", "value": "<ins>Hell</ins>"}
# {"op": "replace", "path": "/body/0", "value": "Hell"}
# {"op": "add", "path": "/body", "value": "<ins>o, world!</ins>"}
```

## Installation

```bash
uv add langdiff
```

For pip:

```bash
pip install langdiff
```

## Quick Example

```python
import langdiff as ld
import openai

class ArticleResponse(ld.Object):
    title: ld.String
    sections: ld.List[ld.String]

# Set up streaming callbacks
response = ArticleResponse()

@response.title.on_append
def on_title_chunk(chunk: str):
    print(f"Title: {chunk}", end="", flush=True)

@response.sections.on_append  
def on_section_append(section: ld.String, index: int):
    print(f"\n\nSection {index + 1}:")
    
    @section.on_append
    def on_section_chunk(chunk: str):
        print(chunk, end="", flush=True)

# Stream from OpenAI
client = openai.OpenAI()
with client.chat.completions.stream(
    model="gpt-5-mini",
    messages=[{"role": "user", "content": "Write a short article about Python"}],
    response_format=ArticleResponse.to_pydantic(),
) as stream:
    with ld.Parser(response) as parser:
        for event in stream:
            if event.type == "content.delta":
                parser.push(event.delta)
```

## Why LangDiff?

Modern AI applications increasingly rely on LLMs to generate structured data rather than just conversational text. While LLM providers offer structured output capabilities, streaming these outputs poses unique challenges:

- **Partial JSON Parsing**: Standard parsers can't handle incomplete tokens like `{"sentence": "Hello,` until closing quotes arrive
- **Type Safety**: Lose static type checking when dealing with partial objects
- **Frontend Coupling**: Tightly coupling UI to LLM schemas creates maintenance issues
- **Inefficient Updates**: Sending entire objects instead of just changes wastes bandwidth

LangDiff solves these problems through intelligent streaming parsing and change-based synchronization, enabling you to build responsive, maintainable AI applications.