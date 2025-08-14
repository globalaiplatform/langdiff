import json
from uuid import UUID
from typing import Annotated

from pydantic import BaseModel

from langdiff import (
    Field,
    Object,
    List,
    String,
    Atom,
    Parser,
    StreamingValue,
    PydanticType,
)
from langdiff.parser.model import unwrap_raw_type


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


def test_pydantic_list_atom():
    class Item(BaseModel):
        name: str

    class StreamingContainer(Object):
        items: Atom[list[Item]]

    container = StreamingContainer()
    events = []

    @container.items.on_complete
    def on_items_complete(items: list[Item]):
        events.append(("on_items_complete", items))

    container.update({"items": [{"name": "item1"}, {"name": "item2"}]})
    assert events == []

    container.complete()
    assert events == [("on_items_complete", [Item(name="item1"), Item(name="item2")])]


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

    class CustomStreamingValue(StreamingValue[dict]):
        @staticmethod
        def to_pydantic() -> type:
            return dict

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

    assert unwrap_raw_type(CustomStreamingValue) is CustomStreamingValue.to_pydantic()


def test_to_pydantic():
    CreateBlocksModel = CreateBlocks.to_pydantic()
    assert issubclass(CreateBlocksModel, BaseModel)
    assert CreateBlocksModel.__doc__ == CreateBlocks.__doc__
    blocks_field = CreateBlocksModel.model_fields["blocks"]
    assert blocks_field.annotation == list[Block.to_pydantic()]
    assert blocks_field.description == "max number of blocks is 5"


def test_pydantic_hint_string():
    """Test PydanticType with String fields converting to custom types."""

    class ItemWithUUID(Object):
        id: Annotated[String, PydanticType(UUID)]
        name: String

    # Test that the streaming functionality still works
    item = ItemWithUUID()
    events = []

    @item.id.on_complete
    def on_id_complete(id_value: str):
        events.append(("id_complete", id_value))

    @item.name.on_complete
    def on_name_complete(name_value: str):
        events.append(("name_complete", name_value))

    item.update({"id": "123e4567-e89b-12d3-a456-426614174000", "name": "Test Item"})
    item.complete()

    assert events == [
        ("id_complete", "123e4567-e89b-12d3-a456-426614174000"),
        ("name_complete", "Test Item"),
    ]

    # Test Pydantic model generation
    ItemModel = ItemWithUUID.to_pydantic()
    assert ItemModel.model_fields["id"].annotation is UUID
    assert ItemModel.model_fields["name"].annotation is str


def test_pydantic_hint_atom():
    """Test PydanticType with Atom fields."""

    class ItemWithHints(Object):
        user_id: Annotated[Atom[str], PydanticType(UUID)]
        score: Annotated[Atom[float], PydanticType(int)]  # Custom conversion
        regular_field: Atom[str]

    # Test Pydantic model generation
    ItemModel = ItemWithHints.to_pydantic()
    assert ItemModel.model_fields["user_id"].annotation is UUID
    assert ItemModel.model_fields["score"].annotation is int
    assert ItemModel.model_fields["regular_field"].annotation is str


def test_pydantic_hint_list():
    """Test PydanticType with List fields."""

    class ItemWithListHints(Object):
        tags: Annotated[List[String], PydanticType(list[UUID])]
        regular_tags: List[String]

    # Test Pydantic model generation
    ItemModel = ItemWithListHints.to_pydantic()
    assert ItemModel.model_fields["tags"].annotation == list[UUID]
    assert ItemModel.model_fields["regular_tags"].annotation == list[str]


def test_pydantic_hint_nested_object():
    """Test PydanticType with nested objects."""

    class NestedItem(Object):
        value: String

    class CustomNestedModel(BaseModel):
        custom_value: str

    class ItemWithNestedHints(Object):
        nested: Annotated[NestedItem, PydanticType(CustomNestedModel)]
        regular_nested: NestedItem

    # Test Pydantic model generation
    ItemModel = ItemWithNestedHints.to_pydantic()
    assert ItemModel.model_fields["nested"].annotation is CustomNestedModel
    assert (
        ItemModel.model_fields["regular_nested"].annotation == NestedItem.to_pydantic()
    )


def test_unwrap_raw_type_with_pydantic_hint():
    """Test unwrap_raw_type function with PydanticType annotations."""
    # Test String with PydanticType
    assert unwrap_raw_type(Annotated[String, PydanticType(UUID)]) is UUID

    # Test Atom with PydanticType
    assert unwrap_raw_type(Annotated[Atom[str], PydanticType(UUID)]) is UUID


def test_from_pydantic_basic_types():
    """Test Object.from_pydantic with basic types."""

    class SimplePydantic(BaseModel):
        name: str
        age: int
        height: float
        is_active: bool

    StreamingSimple = Object.from_pydantic(SimplePydantic)

    # Test that the class was created correctly
    assert issubclass(StreamingSimple, Object)
    assert StreamingSimple.__name__ == "StreamingSimplePydantic"

    # Test field types
    instance = StreamingSimple()
    assert isinstance(instance.name, String)
    assert isinstance(instance.age, Atom)
    assert isinstance(instance.height, Atom)
    assert isinstance(instance.is_active, Atom)


def test_from_pydantic_lists():
    """Test Object.from_pydantic with list types."""

    class ListPydantic(BaseModel):
        titles: list[str]
        scores: list[int]

    StreamingList = Object.from_pydantic(ListPydantic)
    instance = StreamingList()

    # Test list field types
    assert isinstance(instance.titles, List)
    assert isinstance(instance.scores, List)


def test_from_pydantic_nested_models():
    """Test Object.from_pydantic with nested Pydantic models."""

    class NestedPydantic(BaseModel):
        content: str  # Avoid 'value' which conflicts with Object.value property
        count: int

    class ParentPydantic(BaseModel):
        nested: NestedPydantic
        nested_list: list[NestedPydantic]

    StreamingParent = Object.from_pydantic(ParentPydantic)
    instance = StreamingParent()

    # Test nested object
    assert isinstance(instance.nested, Object)
    assert isinstance(instance.nested_list, List)


def test_from_pydantic_example_usage():
    """Test the example usage pattern from the user's request."""

    # Define the Pydantic models as in the example
    class Page(BaseModel):
        titles: list[str]
        sections: list[str]

    class SectionUI(BaseModel):
        title: str
        content: str

    class PageUI(BaseModel):
        sections: list[SectionUI]

    # Generate streaming equivalent
    StreamingPage = Object.from_pydantic(Page)
    response = StreamingPage()

    # Test that we can set up the callbacks as in the example
    ui = PageUI(sections=[])

    events = []

    @response.titles.on_append
    def on_titles_append(title: String, index: int):
        events.append(("titles_append", index))
        ui.sections.append(SectionUI(title="", content=""))

        @title.on_append
        def on_title_append(chunk: str):
            events.append(("title_chunk", index, chunk))
            ui.sections[index].title += chunk

    @response.sections.on_append
    def on_sections_append(section: String, index: int):
        events.append(("sections_append", index))

        @section.on_append
        def on_section_append(chunk: str):
            events.append(("section_chunk", index, chunk))
            if index < len(ui.sections):
                ui.sections[index].content += chunk

    # Simulate streaming data with proper sequence
    # First update: single title, no sections
    response.update({"titles": ["Title 1"]})

    # Second update: complete first title, add second title
    response.update({"titles": ["Title 1", "Title 2"]})

    # Third update: add sections
    response.update(
        {"titles": ["Title 1", "Title 2"], "sections": ["Section 1 content"]}
    )

    # Complete the response
    response.complete()

    # Verify events fired correctly - should have both title appends
    assert ("titles_append", 0) in events
    assert ("titles_append", 1) in events
    assert ("sections_append", 0) in events

    # Verify UI was updated - should have 2 sections created from titles
    assert len(ui.sections) >= 2
    assert ui.sections[0].title == "Title 1"
    assert ui.sections[1].title == "Title 2"
    if len(ui.sections) > 0:
        assert ui.sections[0].content == "Section 1 content"

    # Test List with PydanticType
    assert (
        unwrap_raw_type(Annotated[List[String], PydanticType(list[UUID])]) == list[UUID]
    )

    # Test multiple annotations (PydanticType should take precedence)
    assert (
        unwrap_raw_type(
            Annotated[
                String,
                "some other annotation",
                PydanticType(UUID),
                "another annotation",
            ]
        )
        is UUID
    )

    # Test without PydanticType (should fall back to normal behavior)
    assert unwrap_raw_type(Annotated[String, "some annotation"]) is str
    assert unwrap_raw_type(Annotated[Atom[int], "some annotation"]) is int


def test_pydantic_hint_multiple_annotations():
    """Test that PydanticType works with other annotations."""

    class ItemWithMultipleAnnotations(Object):
        field: Annotated[String, "documentation", PydanticType(UUID), "more docs"]

    # Test Pydantic model generation
    ItemModel = ItemWithMultipleAnnotations.to_pydantic()
    assert ItemModel.model_fields["field"].annotation is UUID
