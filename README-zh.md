# ⚖️ LangDiff：来自 LLM 的渐进式 UI

[![docs](https://img.shields.io/badge/docs-latest-blue)](https://langdiff.readthedocs.io/en/latest/)
[![pypi](https://img.shields.io/pypi/v/langdiff.svg)](https://pypi.python.org/pypi/langdiff)
[![license](https://img.shields.io/github/license/globalaiplatform/langdiff.svg)](https://github.com/globalaiplatform/langdiff/blob/main/LICENSE)
[![Global AI Platform](https://img.shields.io/badge/made%20by-Global%20AI%20Platform-646EFF)](https://globalaiplatform.com/)

LangDiff 是一个 Python 库，用于解决将 LLM 结构化输出以流式方式传输到前端的难题。

![Diagram](./docs/diagram.png)

LangDiff 提供智能的增量解析，在 JSON 结构按 token 生成的过程中，触发细粒度、类型安全的事件，同时自动生成 JSON Patch，用于高效的前端同步。你可以构建后端结构与前端体验能够独立演进的响应式 AI 应用。更多内容可阅读 [动机](#motivation) 部分。

## 核心功能

### 流式解析
- 使用类 Pydantic 模型定义流式结构化输出的模式（schema）。
- 在 token 流入时，接收细粒度、类型安全的回调（`on_append`、`on_update`、`on_complete`）。
- 从 LangDiff 模型派生 Pydantic 模型，实现与 OpenAI SDK 等现有库的无缝互操作。

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

### 变更追踪
- 无需更改代码模式即可追踪数据变更，支持为现有的 Pydantic 模型或普通 Python dict/list/对象加上监测功能。
- 自动生成 JSON Patch 差异，用于前后端高效同步状态。

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

## 用法

### 安装

```
uv add langdiff
```

或使用 pip：

```
pip install langdiff
```

### 流式解析

假设你想用 LLM 生成一篇多章节的文章。与其等整个响应完成后再展示，不如先流式生成章节标题，再流式生成每个章节的内容。

![Demo Video](./docs/demo.gif)

首先定义你的流式数据结构模型类：

```python
import langdiff as ld

class ArticleGenerationResponse(ld.Object):
    section_titles: ld.List[ld.String]
    section_contents: ld.List[ld.String]
```

`ld.Object` 和 `ld.List` 会自动处理内部流式进度。创建实例并绑定事件处理器来响应流式事件：

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

用 `ld.Parser` 创建流式解析器，并将 LLM 的 token 流 (`push()`) 传入解析器：

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

### 变更追踪

要自动追踪 `Article` 对象的变更，可以用 `ld.track_change()` 包装：

```diff
- ui = Article(sections=[])
+ ui, diff_buf = ld.track_change(Article(sections=[]))
```

这样，`ui` 及其嵌套对象的所有修改都会自动记录在 `diff_buf` 中。

使用 `diff_buf.flush()` 获取累计的变更：

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

注意：

- `flush()` 会返回并清空已累计的变更，因此每次调用只会得到最新的修改
- 向前端发送轻量的 diff，而不是整个对象
- Diff 使用 JSON Patch 格式（[RFC 6902](https://datatracker.ietf.org/doc/html/rfc6902)），并新增了 `append` 操作用于高效拼接字符串
- 若需标准 JSON Patch 兼容性，可使用 `ld.track_change(..., tracker_cls=ld.JSONPatchChangeTracker)`

## 动机

现代 AI 应用越来越依赖 LLM 生成结构化数据，而不仅仅是对话文本。虽然 LLM 提供商提供了结构化输出能力（如 OpenAI 的 JSON 模式），但将其流式传输仍有独特挑战，现有工具并未充分解决。

### 传统流式方法的问题

当 LLM 生成复杂 JSON 时，如果必须等待完整响应才能展示，会导致糟糕的用户体验。标准的流式 JSON 解析器无法处理不完整的 token，例如：
`{"sentence": "Hello,` 在缺少结尾引号前无法解析，这意味着用户在较大块完成前看不到任何内容，失去了流式的意义。

即使是能“修复”不完整 JSON 的解析库，也存在不足：
- **无类型安全**：处理部分对象时丢失静态类型检查
- **无细粒度控制**：无法区分字段是完整还是未完成

### 耦合问题

在生产应用中，更大的问题是前端 UI 与 LLM 输出模式的强耦合。当你将原始 JSON 块直接从后端传到前端，会出现：

**模式演进**：改进提示词往往需要更改 JSON 模式，如果前端直接消费 LLM 输出，每次模式变更都可能造成破坏性影响。

**向后兼容性**：初始版本：
```json
{"summary": ["Food is great", "Nice interior"]}
```

增加表情符号后的版本：
```json
{"summaryV2": [{"emoji": "🍽️", "text": "Food is great"}]}
```

同时支持两个版本会造成冗余字段和同步问题。

**实现细节泄漏**：前端代码会依赖 LLM 提供商的具体实现、提示词设计以及 token 流模式。

### LangDiff 方案

LangDiff 用两项核心创新解决这些问题：

1. **智能流式解析**：定义可理解 LLM 流式输出的模式，为部分更新、字段完成、新数组项等提供类型安全的回调。
2. **基于变更的同步**：不是直接传输原始 JSON，而是追踪应用对象的变更，并将轻量的 JSON Patch diff 发送给前端，从而解耦 UI 状态与 LLM 输出格式。

这种架构可以：
- **独立演进**：修改 LLM 提示词和模式而不破坏前端
- **高效更新**：只发送变更而不是整个对象
- **类型安全**：在整个流式过程中保持静态类型检查

LangDiff 让你能够构建响应式、可维护的 AI 应用，让后端提示工程与前端用户体验各自独立演化。

## 许可证

Apache-2.0。详情见 [LICENSE](./LICENSE) 文件。

## 演示

查看 [`example.py`](./example.py)，获取使用流式解析与差异追踪的可运行端到端示例。
