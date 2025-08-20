# Parser Module

The parser module provides streaming-aware data types and parsing capabilities for processing structured LLM outputs in real-time.

## Core Types

::: langdiff.Object
    options:
      show_root_heading: true
      show_source: false
      show_signature: false
      separate_signature: false
      heading_level: 3

::: langdiff.List
    options:
      show_root_heading: true
      show_source: false
      show_signature: false
      separate_signature: false
      heading_level: 3

::: langdiff.String
    options:
      show_root_heading: true
      show_source: false
      show_signature: false
      separate_signature: false
      heading_level: 3

::: langdiff.Atom
    options:
      show_root_heading: true
      show_source: false
      show_signature: false
      separate_signature: false
      heading_level: 3

## Parser

::: langdiff.Parser
    options:
      show_root_heading: true
      show_source: false
      heading_level: 3

## Field Configuration

::: langdiff.Field
    options:
      show_root_heading: true
      show_source: false
      heading_level: 3

## Usage Examples

### Basic Object Streaming

```python
import langdiff as ld

class BlogPost(ld.Object):
    title: ld.String
    content: ld.String
    tags: ld.List[ld.String]

post = BlogPost()

# Set up event handlers
@post.title.on_append
def on_title_chunk(chunk: str):
    print(f"Title chunk: {chunk}")

@post.tags.on_append
def on_tag_append(tag: ld.String, index: int):
    @tag.on_complete
    def on_tag_complete(final_tag: str):
        print(f"New tag: {final_tag}")

# Parse streaming JSON
with ld.Parser(post) as parser:
    for token in json_stream:
        parser.push(token)
```

### Nested Structures

```python
class Comment(ld.Object):
    author: ld.String
    text: ld.String

class Article(ld.Object):
    title: ld.String
    comments: ld.List[Comment]

article = Article()

@article.comments.on_append
def on_comment_append(comment: Comment, index: int):
    @comment.author.on_complete
    def on_author_complete(author: str):
        print(f"Comment {index} by {author}")
    
    @comment.text.on_append
    def on_text_chunk(chunk: str):
        print(f"Comment {index} text: {chunk}")
```

### OpenAI Integration

```python
import openai

# Convert to Pydantic for OpenAI SDK
response_format = BlogPost.to_pydantic()

client = openai.OpenAI()
with client.chat.completions.stream(
    model="gpt-5-mini",
    messages=[{"role": "user", "content": "Write a blog post"}],
    response_format=response_format,
) as stream:
    post = BlogPost()
    with ld.Parser(post) as parser:
        for event in stream:
            if event.type == "content.delta":
                parser.push(event.delta)
```

## Event System

All streaming types support three main events:

### on_start()
Called when streaming begins for a value:

```python
@response.title.on_start
def on_title_start():
    print("Title streaming started")
```

### on_append()
Called as new data is appended:

```python
@response.content.on_append
def on_content_chunk(chunk: str):
    print(f"New content: {chunk}")
```

### on_complete()
Called when a value is fully received:

```python
@response.title.on_complete
def on_title_complete(final_title: str):
    print(f"Title completed: {final_title}")
```