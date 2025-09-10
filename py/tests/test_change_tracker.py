from pydantic import BaseModel

from langdiff import track_change


class Author(BaseModel):
    name: str
    email: str | None


class Article(BaseModel):
    title: str
    tags: list[str]
    author: Author
    contributors: list[Author]
    metadata: dict[str, str]


def test_track_change():
    article, tracker = track_change(
        Article(
            title="Initial Title",
            tags=["python", "testing"],
            author=Author(name="Alice", email="alice@example.com"),
            contributors=[Author(name="Bob", email="bob@example.com")],
            metadata={},
        )
    )

    article.title = "Updated Title"
    assert tracker.flush() == [
        {"op": "add", "path": "/title", "value": "Updated Title"}
    ]

    article.author.name = "Alice Smith"
    assert tracker.flush() == [
        {"op": "append", "path": "/author/name", "value": " Smith"}
    ]

    article.contributors[0].name = "Bob Smith"
    assert tracker.flush() == [
        {"op": "append", "path": "/contributors/0/name", "value": " Smith"}
    ]

    article.tags.append("diff")
    assert tracker.flush() == [{"op": "add", "path": "/tags/-", "value": "diff"}]

    article.contributors.append(Author(name="Charlie", email="charlie@example.com"))
    assert tracker.flush() == [
        {
            "op": "add",
            "path": "/contributors/-",
            "value": {"name": "Charlie", "email": "charlie@example.com"},
        }
    ]

    article.tags.pop()
    assert tracker.flush() == [{"op": "remove", "path": "/tags/2"}]

    article.author.email = None
    assert tracker.flush() == [{"op": "add", "path": "/author/email", "value": None}]

    article.author.email = "alice@example.com"
    assert tracker.flush() == [
        {"op": "add", "path": "/author/email", "value": "alice@example.com"}
    ]

    article.metadata["version"] = "1.0"
    assert tracker.flush() == [
        {"op": "add", "path": "/metadata/version", "value": "1.0"}
    ]

    del article.metadata["version"]
    assert tracker.flush() == [{"op": "remove", "path": "/metadata/version"}]
