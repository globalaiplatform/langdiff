# ⚖️ LangDiff: Progressive UI from LLM

[![docs](https://img.shields.io/badge/docs-latest-blue)](https://langdiff.readthedocs.io/en/latest/)
[![pypi](https://img.shields.io/pypi/v/langdiff.svg)](https://pypi.python.org/pypi/langdiff)
[![license](https://img.shields.io/github/license/globalaiplatform/langdiff.svg)](https://github.com/globalaiplatform/langdiff/blob/main/LICENSE)
[![Global AI Platform](https://img.shields.io/badge/made%20by-Global%20AI%20Platform-646EFF)](https://globalaiplatform.com/)

LangDiff is a Python library that solves the hard problems of streaming structured LLM outputs to frontends.

![Diagram](./docs/diagram.png)

LangDiff provides intelligent partial parsing with granular, type-safe events as JSON structures build token by token, plus automatic JSON Patch generation for efficient frontend synchronization. Build responsive AI applications where your backend structures and frontend experiences can evolve independently. Read more about it on the [Motivation](#motivation) section.

## Demo

Click the image below.

[<img width="1175" height="537" alt="image" src="https://github.com/user-attachments/assets/3ce97baf-8856-44b0-8f40-b9db75e05950" />](https://globalaiplatform.github.io/langdiff/)


## Core Features

### Streaming Parsing
- Define schemas for streaming structured outputs using Pydantic-style models.
- Receive granular, type-safe callbacks (`on_append`, `on_update`, `on_complete`) as tokens stream in.
- Derive Pydantic models from LangDiff models for seamless interop with existing libraries and SDKs like OpenAI SDK.

<table>
<tr>
<td>Without LangDiff</td> <td>With LangDiff</td>
</tr>
<tr>
<td>

```python
parse_partial('{"it')
parse_partial('{"items":')
parse_partial('{"items": ["Buy a b')
parse_partial('{"items": ["Buy a banana", "')
parse_partial('{"items": ["Buy a banana", "Pack b')
parse_partial('{"items": ["Buy a banana", "Pack bags"]}')
```

</td>
<td>

```python
on_item_list_append("", index=0)
on_item_append("Buy a b")
on_item_append("anana")
on_item_list_append("", index=1)
on_item_append("Pack b")
on_item_append("ags")
```

</td>
</tr>
</table>

### Change Tracking
- Track mutations without changing your code patterns by instrumenting existing Pydantic models, or plain Python dict/list/objects.
- Generate JSON Patch diffs automatically for efficient state synchronization between frontend and backend.

<table>
<tr>
<td>Without LangDiff</td> <td>With LangDiff</td>
</tr>
<tr>
<td>

```http
data: {"it
data: ems":
data:  ["Buy a b
data: anana", "
data: Pack b
data: ags"]}
```

</td>
<td>

```http
data: {"op": "add", "path": "/items/-", "value": "Buy a b"}
data: {"op": "append", "path": "/items/0", "value": "anana"}
data: {"op": "add", "path": "/items/-", "value": "Pack b"}
data: {"op": "append", "path": "/items/1", "value": "ags"}
```

</td>
</tr>
</table>

## Usage

### Installation

```
uv add langdiff
```

For pip,

```
pip install langdiff
```

### Streaming Parsing

Suppose you want to generate a multi-section article with an LLM. Rather than waiting for the entire response, 
you can stream the article progressively by first generating section titles as they're determined, 
then streaming each section's content as it's written.

![Demo Video](./docs/demo.gif)

Start by defining model classes that specify your streaming structure:

```python
import langdiff as ld

class ArticleGenerationResponse(ld.Object):
    section_titles: ld.List[ld.String]
    section_contents: ld.List[ld.String]
```

The `ld.Object` and `ld.List` classes handle internal streaming progression automatically. 
Create an instance and attach event handlers to respond to streaming events:

```python
ui = Article(sections=[])
response = ArticleGenerationResponse()

@response.section_titles.on_append
def on_section_title_append(title: ld.String, index: int):
    ui.sections.append(Section(title="", content="", done=False))

    @title.on_append
    def on_title_append(chunk: str):
        ui.sections[index].title += chunk

@response.section_contents.on_append
def on_section_content_append(content: ld.String, index: int):
    if index >= len(ui.sections):
        return

    @content.on_append
    def on_content_append(chunk: str):
        ui.sections[index].content += chunk

    @content.on_complete
    def on_content_complete(_):
        ui.sections[index].done = True
```

Create a streaming parser with `ld.Parser` and feed token chunks from your LLM stream (`push()`):

```python
import openai
client = openai.OpenAI()

with client.chat.completions.stream(
    model="gpt-5-mini",
    messages=[{"role": "user", "content": "Write me a guide to open source a Python library."}],
    
    # You can derive a Pydantic model
    # from a LangDiff model and use it with OpenAI SDK.
    response_format=ArticleGenerationResponse.to_pydantic(),

) as stream:
    with ld.Parser(response) as parser:
        for event in stream:
            if event.type == "content.delta":
                parser.push(event.delta)
                print(ui)
    print(ui)
```

### Change Tracking

To automatically track changes to your `Article` object, wrap it with `ld.track_change()`:

```diff
- ui = Article(sections=[])
+ ui, diff_buf = ld.track_change(Article(sections=[]))
```

Now all modifications to `ui` and its nested objects are automatically captured in `diff_buf`.

Access the accumulated changes using `diff_buf.flush()`:

```python
import openai
client = openai.OpenAI()

with client.chat.completions.stream(
    ...
) as stream:
    with ld.Parser(response) as parser:
        for event in stream:
            if event.type == "content.delta":
                parser.push(event.delta)
                print(diff_buf.flush())  # list of JSON Patch objects
    print(diff_buf.flush())

# Output:
# [{"op": "add", "path": "/sections/-", "value": {"title": "", "content": "", "done": false}}]
# [{"op": "append", "path": "/sections/0/title", "value": "Abs"}]
# [{"op": "append", "path": "/sections/0/title", "value": "tract"}]
# ...
```

Notes:

- `flush()` returns and clears the accumulated changes, so each call gives you only new modifications
- Send these lightweight diffs to your frontend instead of retransmitting entire objects
- Diffs use JSON Patch format ([RFC 6902](https://datatracker.ietf.org/doc/html/rfc6902)) with an additional `append` operation for efficient string building
- For standard JSON Patch compatibility, use `ld.track_change(..., tracker_cls=ld.JSONPatchChangeTracker)`

## Motivation

Modern AI applications increasingly rely on LLMs to generate structured data rather than just conversational text. While LLM providers offer structured output capabilities (like OpenAI's JSON mode), streaming these outputs poses unique challenges that existing tools don't adequately address.

### The Problem with Traditional Streaming Approaches

When LLMs generate complex JSON structures, waiting for the complete response creates poor user experiences. Standard streaming JSON parsers can't handle incomplete tokens - for example, `{"sentence": "Hello,` remains unparseable until the closing quote arrives. This means users see nothing until substantial chunks complete, defeating the purpose of streaming.

Even partial JSON parsing libraries that "repair" incomplete JSON don't fully solve the issues:
- **No type safety**: You lose static type checking when dealing with partial objects
- **No granular control**: Can't distinguish between complete and incomplete fields

### The Coupling Problem

A more fundamental issue emerges in production applications: tightly coupling frontend UIs to LLM output schemas. When you stream raw JSON chunks from backend to frontend, several problems arise:

**Schema Evolution**: Improving prompts often requires changing JSON schemas. If your frontend directly consumes LLM output, every schema change may cause a breaking change.

**Backward Compatibility**: Consider a restaurant review summarizer that originally outputs:
```json
{"summary": ["Food is great", "Nice interior"]}
```

Adding emoji support requires a new schema:
```json
{"summaryV2": [{"emoji": "🍽️", "text": "Food is great"}]}
```

Supporting both versions in a single LLM output creates inefficiencies and synchronization issues between the redundant fields.

**Implementation Detail Leakage**: Frontend code becomes dependent on LLM provider specifics, prompt engineering decisions, and token streaming patterns.

### The LangDiff Approach

LangDiff solves these problems through two key innovations:

1. **Intelligent Streaming Parsing**: Define schemas that understand the streaming nature of LLM outputs. Get type-safe callbacks for partial updates, complete fields, and new array items as they arrive.
2. **Change-Based Synchronization**: Instead of streaming raw JSON, track mutations on your application objects and send lightweight JSON Patch diffs to frontends. This decouples UI state from LLM output format.

This architecture allows:
- **Independent Evolution**: Change LLM prompts and schemas without breaking frontends
- **Efficient Updates**: Send only what changed, not entire objects
- **Type Safety**: Maintain static type checking throughout the streaming process

LangDiff enables you to build responsive, maintainable AI applications where the backend prompt engineering and frontend user experience can evolve independently.

## License

Apache-2.0. See the [LICENSE](./LICENSE) file for details.

## Demo

See [`example.py`](./example.py) for a runnable end-to-end demo using streaming parsing and diff tracking.
