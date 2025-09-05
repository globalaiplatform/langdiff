import { Parser } from '../src/parser/parser';
import { StreamingObject, StreamingString, StreamingList, Atom, StreamingAtomList } from '../src/parser/model';
import { z } from 'zod';
import * as ld from '../src';

const TestObject = ld.object({
  message: ld.string(),
});
type TestObject = ld.infer<typeof TestObject>;

const Block = ld.object({
  id: ld.string(),
  title: ld.string(),
  labels: ld.array(ld.string()),
  minutes: ld.number(),
})
type Block = ld.infer<typeof Block>;

const CreateBlocks = ld.object({
  blocks: ld.array(Block),
}).describe("CreateBlocks is a tool for creating blocks with streaming updates.");
type CreateBlocks = ld.infer<typeof CreateBlocks>;

const StreamingContainer = ld.object({
  items: ld.array(ld.atom(z.string())),
});
type StreamingContainer = ld.infer<typeof StreamingContainer>;

const StreamingContainerWithAtom = ld.object({
  title: ld.atom(z.string()),
  item: ld.atom(z.any()),
});
type StreamingContainerWithAtom = ld.infer<typeof StreamingContainerWithAtom>;

const StreamingContainerWithStringList = ld.object({
  items: ld.array(ld.string()),
});
type StreamingContainerWithStringList = ld.infer<typeof StreamingContainerWithStringList>;

const StreamingContainerWithNullableAtom = ld.object({
  item: ld.atom(z.string().nullable()),
});
type StreamingContainerWithNullableAtom = ld.infer<typeof StreamingContainerWithNullableAtom>;

const StreamingContainerWithAtomList = ld.object({
  items: ld.array(ld.atom(z.any())),
});
type StreamingContainerWithAtomList = ld.infer<typeof StreamingContainerWithAtomList>;

const StreamingContainerWithString = ld.object({
  item: ld.string(),
});
type StreamingContainerWithString = ld.infer<typeof StreamingContainerWithString>;

describe('Parser', () => {
  test('should handle streaming with parser', () => {
    const obj = TestObject.create();
    const parser = new Parser(obj);
    const updates: any[] = [];

    obj.onUpdate((value) => {
      updates.push({ ...value });
    });

    parser.push('{"mess');
    parser.push('age": "Hel');
    parser.push('lo"}');
    parser.complete();

    expect(updates.length).toBeGreaterThan(0);
    expect(obj.getValue()).toEqual({ message: 'Hello' });
  });

  test('streaming object with complex structure', () => {
    function installHandlers(tool: CreateBlocks, events: any[]) {
      tool.blocks.onAppend((block: Block, index: number) => {
        events.push(['on_block_append', index]);

        block.id.onComplete((id: string | null) => {
          events.push(['on_id_complete', index, id]);
        });

        block.title.onAppend((chunk: string) => {
          events.push(['on_title_append', index, chunk]);
        });

        block.title.onComplete((title: string | null) => {
          events.push(['on_title_complete', index, title]);
        });

        block.labels.onAppend((label: StreamingString, labelIndex: number) => {
          events.push(['on_label_append', index]);

          label.onComplete((labelValue: string | null) => {
            events.push(['on_label_complete', index, labelValue]);
          });
        });

        block.minutes.onComplete((minutes: number) => {
          events.push(['on_minutes_complete', index, minutes]);
        });

        block.onComplete((_: any) => {
          events.push(['on_block_complete', index]);
        });
      });

      tool.blocks.onComplete((blocks) => {
        events.push(['on_blocks_complete', blocks.length]);
      });
    }

    const tool = CreateBlocks.create();
    const events: any[] = [];
    installHandlers(tool, events);

    const fullJson = JSON.stringify({
      blocks: [
        {
          id: 'block1',
          title: 'Block One',
          labels: ['label1', 'label2'],
          minutes: 10,
          score: 0.9,
        },
        {
          id: 'block2',
          title: 'Block Two',
          labels: ['label3'],
          minutes: 5,
          score: 0.8,
        },
      ],
    });

    const parser = new Parser(tool);
    for (let i = 0; i < fullJson.length; i++) {
      parser.push(fullJson[i]);
    }
    parser.complete();

    expect(events).toContainEqual(['on_block_append', 0]);
    expect(events).toContainEqual(['on_id_complete', 0, 'block1']);
    expect(events).toContainEqual(['on_title_complete', 0, 'Block One']);
    expect(events).toContainEqual(['on_label_complete', 0, 'label1']);
    expect(events).toContainEqual(['on_label_complete', 0, 'label2']);
    expect(events).toContainEqual(['on_minutes_complete', 0, 10]);
    expect(events).toContainEqual(['on_block_complete', 0]);
    expect(events).toContainEqual(['on_block_append', 1]);
    expect(events).toContainEqual(['on_id_complete', 1, 'block2']);
    expect(events).toContainEqual(['on_title_complete', 1, 'Block Two']);
    expect(events).toContainEqual(['on_label_complete', 1, 'label3']);
    expect(events).toContainEqual(['on_minutes_complete', 1, 5]);
    expect(events).toContainEqual(['on_block_complete', 1]);
    expect(events).toContainEqual(['on_blocks_complete', 2]);
  });

  test('streaming object two keys at once', () => {
    const block = Block.create();
    const events: any[] = [];

    block.id.onAppend((chunk: string) => {
      events.push(['on_id_append', chunk]);
    });

    block.id.onComplete((id: string | null) => {
      events.push(['on_id_complete', id]);
    });

    block.title.onAppend((chunk: string) => {
      events.push(['on_title_append', chunk]);
    });

    block.update({ id: 'block1', title: 'Block One' });

    expect(events).toContainEqual(['on_id_append', 'block1']);
    expect(events).toContainEqual(['on_id_complete', 'block1']);
    expect(events).toContainEqual(['on_title_append', 'Block One']);
  });

  test('streaming object empty string', () => {
    const block = Block.create();
    const events: any[] = [];

    block.id.onAppend((chunk: string) => {
      events.push(['on_id_append', chunk]);
    });

    block.id.onComplete((id: string | null) => {
      events.push(['on_id_complete', id]);
    });

    block.update({ id: '', title: 'Block One' });

    expect(events).toContainEqual(['on_id_append', '']);
    expect(events).toContainEqual(['on_id_complete', '']);
  });

  test('streaming list complete value', () => {
    const container = StreamingContainer.create();
    const events: any[] = [];

    container.items.onAppend((item: string, index: number) => {
      events.push(['on_item_append', item, index]);
    });

    container.items.onComplete((items: string[]) => {
      events.push(['on_items_complete', items]);
    });

    container.update({ items: ['item1'] });
    expect(events).toEqual([]);

    container.update({ items: ['item1', 'item2', 'item3'] });
    expect(events).toContainEqual(['on_item_append', 'item1', 0]);
    expect(events).toContainEqual(['on_item_append', 'item2', 1]);
    
    events.length = 0; // Clear events

    container.complete();
    expect(events).toContainEqual(['on_item_append', 'item3', 2]);
    expect(events).toContainEqual(['on_items_complete', ['item1', 'item2', 'item3']]);
  });

  test('streaming object complete value', () => {
    const container = StreamingContainerWithAtom.create();
    const events: any[] = [];

    container.title.onComplete((title: string) => {
      events.push(['on_title_complete', title]);
    });

    container.item.onComplete((item: any) => {
      events.push(['on_item_complete', item]);
    });

    container.update({ title: 'Title' });
    expect(events).toEqual([]);

    container.update({ title: 'Title', item: {} });
    expect(events).toContainEqual(['on_title_complete', 'Title']);
    
    events.length = 0; // Clear events

    container.update({ title: 'Title', item: { name: 'item1' } });
    expect(events).toEqual([]);

    container.complete();
    expect(events).toContainEqual(['on_item_complete', { name: 'item1' }]);
  });

  test('null streaming list with complete item', () => {
    const container = StreamingContainer.create();
    const events: any[] = [];

    container.items.onAppend((item: string, index: number) => {
      events.push(['on_item_append', item, index]);
    });

    container.items.onComplete((items: string[]) => {
      events.push(['on_items_complete', items]);
    });

    container.update({ items: null as any });
    container.complete();
    expect(events).toContainEqual(['on_items_complete', []]);
  });

  test('null streaming list with streaming item', () => {
    const container = StreamingContainerWithStringList.create();
    const events: any[] = [];

    container.items.onAppend((item: StreamingString, index: number) => {
      events.push(['on_item_append', item, index]);
    });

    container.items.onComplete((items) => {
      events.push(['on_items_complete', items]);
    });

    container.update({ items: null as any });
    container.complete();
    expect(events).toContainEqual(['on_items_complete', []]);
  });

  test('null complete value', () => {
    const container = StreamingContainerWithNullableAtom.create();
    const events: any[] = [];

    container.item.onComplete((item: string | null) => {
      events.push(['on_item_complete', item]);
    });

    container.update({ item: null });
    expect(events).toEqual([]);

    container.complete();
    expect(events).toContainEqual(['on_item_complete', null]);
  });

  test('atom list complete value', () => {
    const container = StreamingContainerWithAtomList.create();
    const events: any[] = [];

    container.items.onComplete((items: any[]) => {
      events.push(['on_items_complete', items]);
    });

    container.update({ items: [{ name: 'item1' }, { name: 'item2' }] });
    expect(events).toEqual([]);

    container.complete();
    expect(events).toContainEqual([
      'on_items_complete',
      [{ name: 'item1' }, { name: 'item2' }],
    ]);
  });

  test('null streaming string', () => {
    const container = StreamingContainerWithString.create();
    const events: any[] = [];

    container.item.onAppend((chunk: string) => {
      events.push(['on_item_append', chunk]);
    });

    container.item.onComplete((item: string | null) => {
      events.push(['on_item_complete', item]);
    });

    container.update({ item: null });
    expect(events).toEqual([]);

    container.complete();
    expect(events).toContainEqual(['on_item_complete', null]);
  });

  describe('fromZod', () => {
    test('should create StreamingObject from simple Zod schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean()
      });

      const DynamicClass = ld.fromZod(schema);
      const instance = DynamicClass.create();

      expect(instance).toBeInstanceOf(StreamingObject);
      expect((instance as any).name).toBeInstanceOf(StreamingString);
      expect((instance as any).age).toBeInstanceOf(Atom);
      expect((instance as any).active).toBeInstanceOf(Atom);
    });

    test('should create StreamingObject with array fields', () => {
      const schema = z.object({
        tags: z.array(z.string()),
        scores: z.array(z.number())
      });

      const DynamicClass = ld.fromZod(schema);
      const instance = DynamicClass.create();

      expect((instance as any).tags).toBeInstanceOf(StreamingList);
      expect((instance as any).scores).toBeInstanceOf(StreamingAtomList);
    });

    test('should create StreamingObject with nested objects', () => {
      const addressSchema = z.object({
        street: z.string(),
        city: z.string()
      });

      const userSchema = z.object({
        name: z.string(),
        address: addressSchema
      });

      const DynamicUserClass = ld.fromZod(userSchema);
      const user = DynamicUserClass.create();

      expect((user as any).name).toBeInstanceOf(StreamingString);
      expect((user as any).address).toBeInstanceOf(StreamingObject);
    });

    test('should handle optional fields', () => {
      const schema = z.object({
        name: z.string(),
        nickname: z.string().optional()
      });

      const DynamicClass = ld.fromZod(schema);
      const instance = DynamicClass.create();

      expect((instance as any).name).toBeInstanceOf(StreamingString);
      expect((instance as any).nickname).toBeInstanceOf(StreamingString);
    });

    test('should handle nullable fields', () => {
      const schema = z.object({
        name: z.string(),
        description: z.string().nullable()
      });

      const DynamicClass = ld.fromZod(schema);
      const instance = DynamicClass.create();

      expect((instance as any).name).toBeInstanceOf(StreamingString);
      expect((instance as any).description).toBeInstanceOf(StreamingString);
    });

    test('should handle union types', () => {
      const schema = z.object({
        data: z.union([z.string(), z.number()])
      });

      const DynamicClass = ld.fromZod(schema);
      const instance = DynamicClass.create();

      // unions are currently only supported as atoms
      expect(instance.data).toBeInstanceOf(Atom);
    });

    test('should work with Parser for streaming', () => {
      const schema = z.object({
        title: z.string(),
        items: z.array(z.string()),
        count: z.number()
      });

      const DynamicClass = ld.fromZod(schema);
      const instance = DynamicClass.create();
      const events: any[] = [];

      (instance as any).title.onAppend((chunk: string) => {
        events.push(['title_append', chunk]);
      });

      (instance as any).items.onAppend((item: StreamingString, index: number) => {
        events.push(['item_append', index]);
        item.onAppend((chunk: string) => {
          events.push(['item_chunk', index, chunk]);
        });
      });

      (instance as any).count.onComplete((value: number) => {
        events.push(['count_complete', value]);
      });

      const parser = new Parser(instance);
      const jsonData = '{"title": "Test Title", "items": ["item1", "item2"], "count": 42}';
      
      for (let i = 0; i < jsonData.length; i++) {
        parser.push(jsonData[i]);
      }
      parser.complete();

      // Check that title was streamed in chunks
      const titleChunks = events.filter(e => e[0] === 'title_append').map(e => e[1]).join('');
      expect(titleChunks).toBe('Test Title');
      expect(events).toContainEqual(['item_append', 0]);
      expect(events).toContainEqual(['item_append', 1]);
      expect(events).toContainEqual(['count_complete', 42]);
      
      // Check that first item was streamed correctly
      const item0Chunks = events.filter(e => e[0] === 'item_chunk' && e[1] === 0).map(e => e[2]).join('');
      expect(item0Chunks).toBe('item1');
      
      // Check that second item was streamed correctly  
      const item1Chunks = events.filter(e => e[0] === 'item_chunk' && e[1] === 1).map(e => e[2]).join('');
      expect(item1Chunks).toBe('item2');
    });

    test('should handle nested object arrays', () => {
      const itemSchema = z.object({
        id: z.string(),
        name: z.string()
      });

      const containerSchema = z.object({
        items: z.array(itemSchema)
      });

      const DynamicClass = ld.fromZod(containerSchema);
      const instance = DynamicClass.create();

      expect(instance.items).toBeInstanceOf(StreamingList);

      const events: any[] = [];
      instance.items.onAppend((item, index) => {
        events.push(['item_added', index]);
        expect(item).toBeInstanceOf(StreamingObject);
      });

      const parser = new Parser(instance);
      const jsonData = '{"items": [{"id": "1", "name": "First"}, {"id": "2", "name": "Second"}]}';
      
      for (let i = 0; i < jsonData.length; i++) {
        parser.push(jsonData[i]);
      }
      parser.complete();

      expect(events).toContainEqual(['item_added', 0]);
      expect(events).toContainEqual(['item_added', 1]);
    });
  });
});
