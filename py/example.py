import time

import openai

import langdiff as ld
from pydantic import BaseModel


class Section(BaseModel):
    title: str
    content: str
    done: bool


class Article(BaseModel):
    sections: list[Section]


##


class ArticleGenerationResponse(ld.Object):
    section_titles: ld.List[ld.String]
    section_contents: ld.List[ld.String]


##


def server_stream(prompt: str):
    ui, diff_buf = ld.track_change(Article(sections=[]))
    result = ArticleGenerationResponse()

    @result.section_titles.on_append
    def on_section_title_append(title: ld.String, index: int):
        ui.sections.append(Section(title="", content="", done=False))

        @title.on_append
        def on_title_append(chunk: str):
            ui.sections[index].title += chunk

    @result.section_contents.on_append
    def on_section_content_append(content: ld.String, index: int):
        if index >= len(ui.sections):
            return

        @content.on_append
        def on_content_append(chunk: str):
            ui.sections[index].content += chunk

        @content.on_complete
        def on_content_complete(_):
            ui.sections[index].done = True

    ##

    client = openai.OpenAI()
    with client.chat.completions.stream(
        model="gpt-5-mini",
        messages=[
            {"role": "user", "content": prompt},
        ],
        # You can derive Pydantic model from LangDiff model and use it with OpenAI SDK
        response_format=ArticleGenerationResponse.to_pydantic(),
    ) as stream:
        with ld.Parser(result) as parser:
            for event in stream:
                if event.type == "content.delta":
                    parser.push(event.delta)
                    if change := diff_buf.flush():
                        yield change
                time.sleep(0.02)

        if change := diff_buf.flush():
            yield change


##


def main():
    prompt = "Write me a guide to open source a Python library in 5 sections without numbering. Section content should be 3 lines. Be simple and concise."
    article = {"sections": []}
    render(article)

    for change in server_stream(prompt):
        ld.apply_change(article, change)
        render(article)

    render(article, final=True)

    time.sleep(1)


def render(article: dict, final: bool = False):
    buf = "\033[H\033[J"  # Clear the console
    for section in article["sections"]:
        buf += "\033[1m"
        buf += section["title"]
        buf += "\033[0;32m ✓ done" if section["done"] else ""
        buf += "\033[0m\n"
        if section["done"]:
            buf += section["content"]
        elif section["content"]:
            buf += section["content"][:-1]
            buf += f"\033[7;32m{section['content'][-1]}\033[0m"
        buf += "\n\n"
    print(buf, flush=True)


if __name__ == "__main__":
    main()
