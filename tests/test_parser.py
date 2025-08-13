import json
from typing import Union, Optional

from pydantic import BaseModel

from langdiff.parser.model import unwrap_raw_type, unwrap_noneable_type
from langdiff import Field, Object, List, String, Atom, Parser


class Block(Object):
    id: String
    title: String
    labels: List[String]
    minutes: Atom[int]


class CreateBlocks(Object):
    __doc__ = "CreateBlocks is a tool for creating blocks with streaming updates."
    blocks: List[Block] = Field(description="max number of blocks is 5")


def test_streaming_object():
    def install_handlers(tool: CreateBlocks, events: list):
        @tool.blocks.on_append
        def on_block_append(block: Block, index: int):
            events.append(("on_block_append", index))

            @block.id.on_complete
            def on_id_complete(id: str):
                events.append(("on_id_complete", index, id))

            @block.title.on_append
            def on_title_append(chunk: str):
                events.append(("on_title_append", index, chunk))

            @block.title.on_complete
            def on_title_complete(title: str):
                events.append(("on_title_complete", index, title))

            @block.labels.on_append
            def on_label_append(label: String, _):
                events.append(("on_label_append", index))

                @label.on_complete
                def on_label_complete(label_value: str):
                    events.append(("on_label_complete", index, label_value))

            @block.minutes.on_complete
            def on_minutes_complete(minutes: int):
                events.append(("on_minutes_complete", index, minutes))

            @block.on_complete
            def on_block_complete(_):
                events.append(("on_block_complete", index))

        @tool.blocks.on_complete
        def on_blocks_complete(blocks: list):
            events.append(("on_blocks_complete", len(blocks)))

    tool = CreateBlocks()
    events = []
    install_handlers(tool, events)
    full_json = json.dumps(
        {
            "blocks": [
                {
                    "id": "block1",
                    "title": "Block One",
                    "labels": ["label1", "label2"],
                    "minutes": 10,
                    "score": 0.9,
                },
                {
                    "id": "block2",
                    "title": "Block Two",
                    "labels": ["label3"],
                    "minutes": 5,
                    "score": 0.8,
                },
            ]
        }
    )
    with Parser(tool) as parser:
        for i in range(len(full_json)):
            parser.push(full_json[i])

    assert events == [
        ("on_block_append", 0),
        ("on_id_complete", 0, "block1"),
        ("on_title_append", 0, "B"),
        ("on_title_append", 0, "l"),
        ("on_title_append", 0, "o"),
        ("on_title_append", 0, "c"),
        ("on_title_append", 0, "k"),
        ("on_title_append", 0, " "),
        ("on_title_append", 0, "O"),
        ("on_title_append", 0, "n"),
        ("on_title_append", 0, "e"),
        ("on_title_complete", 0, "Block One"),
        ("on_label_append", 0),
        ("on_label_complete", 0, "label1"),
        ("on_label_append", 0),
        ("on_label_complete", 0, "label2"),
        ("on_minutes_complete", 0, 10),
        ("on_block_complete", 0),
        ("on_block_append", 1),
        ("on_id_complete", 1, "block2"),
        ("on_title_append", 1, "B"),
        ("on_title_append", 1, "l"),
        ("on_title_append", 1, "o"),
        ("on_title_append", 1, "c"),
        ("on_title_append", 1, "k"),
        ("on_title_append", 1, " "),
        ("on_title_append", 1, "T"),
        ("on_title_append", 1, "w"),
        ("on_title_append", 1, "o"),
        ("on_title_complete", 1, "Block Two"),
        ("on_label_append", 1),
        ("on_label_complete", 1, "label3"),
        ("on_minutes_complete", 1, 5),
        ("on_block_complete", 1),
        ("on_blocks_complete", 2),
    ]


def test_streaming_object_two_keys_at_once():
    block = Block()
    events = []

    @block.id.on_append
    def on_id_append(chunk: str):
        events.append(("on_id_append", chunk))

    @block.id.on_complete
    def on_id_complete(id: str):
        events.append(("on_id_complete", id))

    @block.title.on_append
    def on_title_append(chunk: str):
        events.append(("on_title_append", chunk))

    block.update({"id": "block1", "title": "Block One"})

    assert events == [
        ("on_id_append", "block1"),
        ("on_id_complete", "block1"),
        ("on_title_append", "Block One"),
    ]


def test_streaming_object_empty_string():
    block = Block()
    events = []

    @block.id.on_append
    def on_id_append(chunk: str):
        events.append(("on_id_append", chunk))

    @block.id.on_complete
    def on_id_complete(id: str):
        events.append(("on_id_complete", id))

    block.update({"id": "", "title": "Block One"})

    assert events == [
        ("on_id_append", ""),
        ("on_id_complete", ""),
    ]


def test_streaming_list_complete_value():
    class StreamingContainer(Object):
        items: List[str]

    container = StreamingContainer()
    events = []

    @container.items.on_append
    def on_item_append(item: str, index: int):
        events.append(("on_item_append", item, index))

    @container.items.on_complete
    def on_items_complete(items: list):
        events.append(("on_items_complete", items))

    container.update({"items": ["item1"]})
    assert events == []

    container.update({"items": ["item1", "item2", "item3"]})
    assert events == [
        ("on_item_append", "item1", 0),
        ("on_item_append", "item2", 1),
    ]
    events.clear()

    container.complete()
    assert events == [
        ("on_item_append", "item3", 2),
        ("on_items_complete", ["item1", "item2", "item3"]),
    ]


def test_streaming_list_complete_value_pydantic():
    class Item(BaseModel):
        name: str

    class StreamingContainer(Object):
        items: List[Item]

    container = StreamingContainer()
    events = []

    @container.items.on_append
    def on_item_append(item: Item, index: int):
        events.append(("on_item_append", item, index))

    @container.items.on_complete
    def on_items_complete(items: list):
        events.append(("on_items_complete", items))

    container.update({"items": [{"name": "item1"}]})
    assert events == []

    container.update(
        {"items": [{"name": "item1"}, {"name": "item2"}, {"name": "item3"}]}
    )
    assert events == [
        ("on_item_append", Item(name="item1"), 0),
        ("on_item_append", Item(name="item2"), 1),
    ]
    events.clear()

    container.complete()
    assert events == [
        ("on_item_append", Item(name="item3"), 2),
        (
            "on_items_complete",
            [Item(name="item1"), Item(name="item2"), Item(name="item3")],
        ),
    ]


def test_streaming_object_complete_value():
    class Item(BaseModel):
        name: str

    class StreamingContainer(Object):
        title: Atom[str]
        item: Atom[Item]

    container = StreamingContainer()
    events = []

    @container.title.on_complete
    def on_title_complete(title: str):
        events.append(("on_title_complete", title))

    @container.item.on_complete
    def on_item_complete(item: Item):
        events.append(("on_item_complete", item))

    container.update({"title": "Title"})
    assert events == []

    container.update({"title": "Title", "item": {}})
    assert events == [("on_title_complete", "Title")]
    events.clear()

    container.update({"title": "Title", "item": {"name": "item1"}})
    assert events == []

    container.complete()
    assert events == [("on_item_complete", Item(name="item1"))]


def test_null_streaming_list_with_complete_item():
    class StreamingContainer(Object):
        items: List[str]

    container = StreamingContainer()
    events = []

    @container.items.on_append
    def on_item_append(item: str, index: int):
        events.append(("on_item_append", item, index))

    @container.items.on_complete
    def on_items_complete(items: list):
        events.append(("on_items_complete", items))

    container.update({"items": None})
    container.complete()
    assert events == [
        ("on_items_complete", [])
    ]  # no way to differentiate between empty and null for now


def test_null_streaming_list_with_streaming_item():
    class StreamingContainer(Object):
        items: List[String]

    container = StreamingContainer()
    events = []

    @container.items.on_append
    def on_item_append(item: str, index: int):
        events.append(("on_item_append", item, index))

    @container.items.on_complete
    def on_items_complete(items: list):
        events.append(("on_items_complete", items))

    container.update({"items": None})
    container.complete()
    assert events == [
        ("on_items_complete", [])
    ]  # no way to differentiate between empty and null for now


def test_null_complete_value():
    class StreamingContainer(Object):
        item: Atom[str | None]

    container = StreamingContainer()
    events = []

    @container.item.on_complete
    def on_item_complete(item: str | None):
        events.append(("on_item_complete", item))

    container.update({"item": None})
    assert events == []  # Expect no events since item is None

    container.complete()
    assert events == [("on_item_complete", None)]  # Still no events after completion


def test_null_pydantic_atom():
    class Item(BaseModel):
        name: str | None

    class StreamingContainer(Object):
        item: Atom[Item | None]

    container = StreamingContainer()
    events = []

    @container.item.on_complete
    def on_item_complete(item: Item | None):
        events.append(("on_item_complete", item))

    container.update({"item": None})
    assert events == []  # Expect no events since item is None

    container.complete()
    assert events == [("on_item_complete", None)]  # Still no events after completion


def test_null_pydantic_atom_non_null():
    class Item(BaseModel):
        name: str | None

    class StreamingContainer(Object):
        item: Atom[Item | None]

    container = StreamingContainer()
    events = []

    @container.item.on_complete
    def on_item_complete(item: Item | None):
        events.append(("on_item_complete", item))

    container.update({"item": {"name": "test"}})
    assert events == []
    container.complete()
    assert events == [
        ("on_item_complete", Item(name="test"))
    ]  # Expect item after completion


def test_null_streaming_string():
    class StreamingContainer(Object):
        item: String

    container = StreamingContainer()
    events = []

    @container.item.on_append
    def on_item_append(chunk: str):
        events.append(("on_item_append", chunk))

    @container.item.on_complete
    def on_item_complete(item: str):
        events.append(("on_item_complete", item))

    container.update({"item": None})
    assert events == []  # Expect no events since item is None

    container.complete()
    assert events == [("on_item_complete", None)]  # None after completion


def test_unwrap_raw_type():
    class PydanticModel(BaseModel):
        name: str
        age: int

    assert unwrap_raw_type(Atom[str]) is str
    assert unwrap_raw_type(Atom[int]) is int
    assert unwrap_raw_type(Atom[float]) is float
    assert unwrap_raw_type(Atom[bool]) is bool
    assert unwrap_raw_type(Atom[PydanticModel]) is PydanticModel

    assert unwrap_raw_type(Atom[str | None]) == str | None
    assert unwrap_raw_type(Atom[int | None]) == int | None
    assert unwrap_raw_type(Atom[float | None]) == float | None
    assert unwrap_raw_type(Atom[bool | None]) == bool | None
    assert unwrap_raw_type(Atom[PydanticModel | None]) == PydanticModel | None

    assert unwrap_raw_type(List[str]) == list[str]
    assert unwrap_raw_type(List[int]) == list[int]
    assert unwrap_raw_type(List[float]) == list[float]
    assert unwrap_raw_type(List[bool]) == list[bool]
    assert unwrap_raw_type(List[PydanticModel]) == list[PydanticModel]
    assert unwrap_raw_type(List[Block]) == list[Block.to_pydantic()]
    assert unwrap_raw_type(List[String]) == list[str]

    assert unwrap_raw_type(String) is str

    assert unwrap_raw_type(Block) == Block.to_pydantic()


def test_to_pydantic():
    CreateBlocksModel = CreateBlocks.to_pydantic()
    assert issubclass(CreateBlocksModel, BaseModel)
    assert CreateBlocksModel.__doc__ == CreateBlocks.__doc__
    blocks_field = CreateBlocksModel.model_fields["blocks"]
    assert blocks_field.annotation == list[Block.to_pydantic()]
    assert blocks_field.description == "max number of blocks is 5"


def test_unwrap_noneable_type():
    assert unwrap_noneable_type(str | None) is str
    assert unwrap_noneable_type(Union[str, None]) is str
    assert unwrap_noneable_type(Optional[str]) is str
