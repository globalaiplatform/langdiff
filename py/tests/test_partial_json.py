import json

from langdiff.parser.parser import parse_partial_json


def repair_json(
    json_str: str = "",
    return_objects: bool = False,
):
    parsed_json = parse_partial_json(json_str)
    if return_objects:
        return parsed_json
    return json.dumps(parsed_json)


def test_valid_json():
    assert (
        repair_json('{"name": "John", "age": 30, "city": "New York"}')
        == '{"name": "John", "age": 30, "city": "New York"}'
    )
    assert (
        repair_json('{"employees":["John", "Anna", "Peter"]} ')
        == '{"employees": ["John", "Anna", "Peter"]}'
    )
    assert repair_json('{"key": "value:value"}') == '{"key": "value:value"}'
    assert (
        repair_json('{"text": "The quick brown fox,"}')
        == '{"text": "The quick brown fox,"}'
    )
    assert (
        repair_json('{"text": "The quick brown fox won\'t jump"}')
        == '{"text": "The quick brown fox won\'t jump"}'
    )
    assert repair_json('{"key": ""') == '{"key": ""}'
    assert (
        repair_json('{"key1": {"key2": [1, 2, 3]}}') == '{"key1": {"key2": [1, 2, 3]}}'
    )
    assert (
        repair_json('{"key": 12345678901234567890}') == '{"key": 12345678901234567890}'
    )
    assert repair_json('{"key": "value\u263a"}') == '{"key": "value\\u263a"}'
    assert repair_json('{"key": "value\\nvalue"}') == '{"key": "value\\nvalue"}'


# jiter does not support broken JSON
# def test_multiple_jsons():
#     assert repair_json("[]{}") == "[[], {}]"
#     assert repair_json("{}[]{}") == "[{}, [], {}]"
#     assert repair_json('{"key":"value"}[1,2,3,True]') == '[{"key": "value"}, [1, 2, 3, true]]'
#     assert (
#         repair_json('lorem ```json {"key":"value"} ``` ipsum ```json [1,2,3,True] ``` 42')
#         == '[{"key": "value"}, [1, 2, 3, true]]'
#     )
#     assert repair_json('[{"key":"value"}][{"key":"value_after"}]') == '[{"key": "value_after"}]'


def test_repair_json_with_objects():
    # Test with valid JSON strings
    assert repair_json("[]", return_objects=True) == []
    assert repair_json("{}", return_objects=True) == {}
    assert repair_json(
        '{"key": true, "key2": false, "key3": null}', return_objects=True
    ) == {
        "key": True,
        "key2": False,
        "key3": None,
    }
    assert repair_json(
        '{"name": "John", "age": 30, "city": "New York"}', return_objects=True
    ) == {
        "name": "John",
        "age": 30,
        "city": "New York",
    }
    assert repair_json("[1, 2, 3, 4]", return_objects=True) == [1, 2, 3, 4]
    assert repair_json(
        '{"employees":["John", "Anna", "Peter"]} ', return_objects=True
    ) == {"employees": ["John", "Anna", "Peter"]}
    assert repair_json(
        """
{
  "resourceType": "Bundle",
  "id": "1",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "1",
        "name": [
          {"use": "official", "family": "Corwin", "given": ["Keisha", "Sunny"], "prefix": ["Mrs."},
          {"use": "maiden", "family": "Goodwin", "given": ["Keisha", "Sunny"], "prefix": ["Mrs."]}
        ]
      }
    }
  ]
}
""",
        return_objects=True,
    ) == {
        "resourceType": "Bundle",
        "id": "1",
        "type": "collection",
        "entry": [
            {
                "resource": {
                    "resourceType": "Patient",
                    "id": "1",
                    "name": [
                        {
                            "use": "official",
                            "family": "Corwin",
                            "given": ["Keisha", "Sunny"],
                            "prefix": ["Mrs."],
                        },
                        {
                            "use": "maiden",
                            "family": "Goodwin",
                            "given": ["Keisha", "Sunny"],
                            "prefix": ["Mrs."],
                        },
                    ],
                }
            }
        ],
    }
    # jiter does not support broken JSON
    # assert repair_json(
    #     '{\n"html": "<h3 id="aaa">Waarom meer dan 200 Technical Experts - "Passie voor techniek"?</h3>"}',
    #     return_objects=True,
    # ) == {"html": '<h3 id="aaa">Waarom meer dan 200 Technical Experts - "Passie voor techniek"?</h3>'}
    # assert repair_json(
    #     """
    #     [
    #         {
    #             "foo": "Foo bar baz",
    #             "tag": "#foo-bar-baz"
    #         },
    #         {
    #             "foo": "foo bar "foobar" foo bar baz.",
    #             "tag": "#foo-bar-foobar"
    #         }
    #     ]
    #     """,
    #     return_objects=True,
    # ) == [
    #     {"foo": "Foo bar baz", "tag": "#foo-bar-baz"},
    #     {"foo": 'foo bar "foobar" foo bar baz.', "tag": "#foo-bar-foobar"},
    # ]


def test_stream_stable():
    assert (
        repair_json('{"key": "val\\n123,`key2:value2`"}')
        == '{"key": "val\\n123,`key2:value2`"}'
    )
    assert repair_json('{"key": "val\\') == '{"key": "val"}'
    assert repair_json('{"key": "val\\u') == '{"key": "val"}'
    assert repair_json('{"key": "val\\uc') == '{"key": "val"}'
    assert repair_json('{"key": "val\\uC') == '{"key": "val"}'
    assert repair_json('{"key": "val\\uC8') == '{"key": "val"}'
    assert repair_json('{"key": "val\\uC81') == '{"key": "val"}'
    assert repair_json('{"key": "val\\uC815') == '{"key": "val\\uc815"}'
    assert repair_json('{"key": "val\\n') == '{"key": "val\\n"}'
    assert (
        repair_json('{"key": "val\\n123,`key2:value2')
        == '{"key": "val\\n123,`key2:value2"}'
    )
    assert (
        repair_json('{"key": "val\\n123,`key2:value2`"}')
        == '{"key": "val\\n123,`key2:value2`"}'
    )
    assert repair_json('["\\"') == '["\\""]'


def test_empty():
    assert repair_json("", return_objects=True) == ""
    assert repair_json(" ", return_objects=True) == ""
    assert repair_json("  ", return_objects=True) == ""
    assert repair_json("\n", return_objects=True) == ""
    assert repair_json("\n\n", return_objects=True) == ""
    assert repair_json("\t", return_objects=True) == ""
    assert repair_json("\t\t", return_objects=True) == ""
    assert repair_json("\r", return_objects=True) == ""
    assert repair_json("\r\n", return_objects=True) == ""


def test_jiter_difference_corrected():
    # repair-json removed incomplete empty string at the end of array
    assert repair_json('["', return_objects=True) == []
    assert repair_json('["a", "', return_objects=True) == ["a"]
    assert repair_json('["a", ""', return_objects=True) == ["a", ""]
    # This is OK because it's an object value:
    assert repair_json('{"notification":"', return_objects=True) == {"notification": ""}
    assert repair_json('{"notification":""', return_objects=True) == {
        "notification": ""
    }

    # repair-json generated extra empty object when object in the array has key conflicting momentarily
    assert repair_json(
        '{"notification":"Great","clarification":[{"question":"What","question',
        return_objects=True,
    ) == {"notification": "Great", "clarification": [{"question": "What"}]}
    assert repair_json(
        '{"themes":[{"block_id":"a1b2c3d4","swap_index":1,"block_theme":"Flexible Scheduling","block_theme',
        return_objects=True,
    ) == {
        "themes": [
            {
                "block_id": "a1b2c3d4",
                "swap_index": 1,
                "block_theme": "Flexible Scheduling",
            }
        ]
    }
    # This is OK because the key is not conflicting:
    assert repair_json(
        '{"notification":"Great","clarification":[{"question":"What","question_',
        return_objects=True,
    ) == {"notification": "Great", "clarification": [{"question": "What"}]}

    # repair-json generated empty string for missing object value but jiter does not
    assert repair_json('{"notification":', return_objects=True) == {}
