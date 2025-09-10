import { z } from 'zod';
import { 
  StreamingObject, 
  StreamingString, 
  Atom,
  Parser,
} from '../src/index';
import * as ld from '../src/index';

describe('Advanced Features Tests', () => {

  describe('ZodType integration', () => {
    const UuidSchema = z.string().uuid();

    const ItemWithZod = ld.object({
      id: ld.string().withZodSchema(UuidSchema),
      name: ld.string(),
    });

    test('zod type hints work with streaming', () => {
      const item = ItemWithZod.create();
      const events: any[] = [];

      item.id.onComplete((id: string | null) => {
        events.push(['id_complete', id]);
      });

      item.name.onComplete((name: string | null) => {
        events.push(['name_complete', name]);
      });

      item.update({ 
        id: "123e4567-e89b-12d3-a456-426614174000", 
        name: "Test Item" 
      });
      item.complete();

      expect(events).toEqual([
        ['id_complete', '123e4567-e89b-12d3-a456-426614174000'],
        ['name_complete', 'Test Item'],
      ]);

      // Test Zod schema generation
      const schema = ItemWithZod.toZod();
      expect(() => schema.parse({
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Test Item"
      })).not.toThrow();

      expect(() => schema.parse({
        id: "not-a-uuid",
        name: "Test Item"
      })).toThrow();
    });

    test('multiple zod annotations', () => {
      const ItemWithMultipleZod = ld.object({
        id: ld.string().withZodSchema(z.string().uuid()),
        score: ld.number().withZodSchema(z.number().min(0).max(100)),
      });

      const schema = ItemWithMultipleZod.toZod();

      // Valid case
      expect(() => schema.parse({
        id: "123e4567-e89b-12d3-a456-426614174000",
        score: 85
      })).not.toThrow();

      // Invalid UUID
      expect(() => schema.parse({
        id: "not-a-uuid",
        score: 85
      })).toThrow();

      // Invalid score (out of range)
      expect(() => schema.parse({
        id: "123e4567-e89b-12d3-a456-426614174000",
        score: 150
      })).toThrow();
    });
  });

  describe('Parser advanced features', () => {
    const TestObject = ld.object({
      message: ld.string(),
    })

    test('parser context manager behavior with use()', () => {
      const obj = TestObject.create();
      const parser = new Parser(obj);
      const events: any[] = [];

      obj.message.onComplete((msg: string | null) => {
        events.push(['complete', msg]);
      });

      parser.use((p) => {
        p.push('{"mess');
        p.push('age": "Hel');
        p.push('lo"}');
      });

      expect(events).toContainEqual(['complete', 'Hello']);
    });

    test('parser prevents double completion', () => {
      const obj = TestObject.create();
      const parser = new Parser(obj);
      const events: any[] = [];

      obj.message.onComplete((msg: string | null) => {
        events.push(['complete', msg]);
      });

      parser.push('{"message": "Hello"}');
      parser.complete();
      parser.complete(); // Should not trigger again

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(['complete', 'Hello']);
    });

    test('parser exception handling in use()', () => {
      const obj = TestObject.create();
      const parser = new Parser(obj);
      const events: any[] = [];

      obj.message.onComplete((msg: string | null) => {
        events.push(['complete', msg]);
      });

      expect(() => {
        parser.use((p) => {
          p.push('{"message": "test"}');
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      // Should still complete despite the error
      expect(events).toContainEqual(['complete', 'test']);
    });
  });

  describe('Field metadata support', () => {
    const ItemWithField = ld.object({
      title: ld.string().describe('Item title'),
      count: ld.number().describe('Item count').default(0),
    });

    test('should handle Field metadata', () => {
      const item = ItemWithField.create();

      // Test that object can be created and used normally
      const events: any[] = [];
      item.title.onComplete((title: string | null) => {
        events.push(['title', title]);
      });
      
      item.count.onComplete((count: number | null) => {
        events.push(['count', count]);
      });

      item.update({ title: 'Test', count: 5 });
      item.complete();

      expect(events).toContainEqual(['title', 'Test']);
      expect(events).toContainEqual(['count', 5]);
    });
  });

  describe('Complex nested structures', () => {
    const NestedObject = ld.object({
      nestedValue: ld.string(),
    });

    const ComplexObject = ld.object({
      id: ld.string(),
      nested: NestedObject,
      items: ld.array(ld.string()),
      metadata: ld.atom(z.any()),
    });

    test('complex nested object streaming', () => {
      const obj = ComplexObject.create();
      const events: any[] = [];

      obj.id.onComplete((id) => events.push(['id', id]));
      obj.nested.nestedValue.onComplete((value) => events.push(['nested_value', value]));
      obj.items.onAppend((item, index) => {
        events.push(['item_append', index]);
        item.onComplete((value) => events.push(['item_complete', index, value]));
      });
      obj.metadata.onComplete((meta) => events.push(['metadata', meta]));

      const testData = {
        id: "test-id",
        nested: { nestedValue: "nested-value" },
        items: ["item1", "item2"],
        metadata: { key: "value" }
      };

      obj.update(testData);
      obj.complete();

      expect(events).toContainEqual(['id', 'test-id']);
      expect(events).toContainEqual(['nested_value', 'nested-value']);
      expect(events).toContainEqual(['item_append', 0]);
      expect(events).toContainEqual(['item_complete', 0, 'item1']);
      expect(events).toContainEqual(['item_append', 1]);
      expect(events).toContainEqual(['item_complete', 1, 'item2']);
      expect(events).toContainEqual(['metadata', { key: "value" }]);
    });

    test('nested object schema generation', () => {
      const schema = ComplexObject.toZod();

      const validData = {
        id: "test-id",
        nested: { nestedValue: "nested-value" },
        items: ["item1", "item2"],
        metadata: { key: "value" }
      };

      expect(() => schema.parse(validData)).not.toThrow();
    });
  });

  describe('Edge cases and error handling', () => {
    const EdgeCaseObject = ld.object({
      text: ld.string(),
      numbers: ld.array(ld.number()),
    });

    test('empty string handling', () => {
      const obj = EdgeCaseObject.create();
      const events: any[] = [];

      obj.text.onAppend((chunk) => events.push(['append', chunk]));
      obj.text.onComplete((text) => events.push(['complete', text]));

      obj.update({ text: "" });
      obj.complete();

      expect(events).toContainEqual(['append', '']);
      expect(events).toContainEqual(['complete', '']);
    });

    test('null array handling', () => {
      const obj = EdgeCaseObject.create();
      const events: any[] = [];
      
      obj.numbers.onAppend((item, index) => events.push(['append', item, index]));
      obj.numbers.onComplete((items) => events.push(['complete', items]));

      obj.update({ numbers: null as any });
      obj.complete();
      
      // The null array should be treated as empty array and complete should be called
      const completeEvents = events.filter(e => e[0] === 'complete');
      expect(completeEvents.length).toBeGreaterThan(0);
      if (completeEvents.length > 0) {
        expect(Array.isArray(completeEvents[0][1])).toBe(true);
        expect(completeEvents[0][1]).toEqual([]);
      }
    });

    test('partial json edge cases', () => {
      const obj = EdgeCaseObject.create();
      const parser = new Parser(obj);
      const events: any[] = [];

      obj.text.onAppend((chunk) => events.push(['append', chunk]));

      // Test various edge cases
      parser.push('{"text": "test\\u00');  // Incomplete unicode
      parser.push('41"}');  // Complete it
      parser.complete();

      expect(events.length).toBeGreaterThan(0);
    });

    test('invalid streaming string update', () => {
      const str = new StreamingString();
      str.update('hello');
      
      expect(() => {
        str.update('world'); // Should fail - not a continuation
      }).toThrow('StreamingString can only be updated with a continuation of the current value');
    });
  });

  describe('Performance and memory tests', () => {
    test('large list streaming performance', () => {
      const LargeListObject = ld.object({
        items: ld.array(ld.number()),
      });

      const obj = LargeListObject.create();
      const events: number[] = [];

      obj.items.onAppend((item: number) => {
        events.push(item);
      });

      // Create large array
      const largeArray = Array.from({ length: 1000 }, (_, i) => i);
      
      const startTime = Date.now();
      obj.update({ items: largeArray });
      obj.complete();
      const endTime = Date.now();

      expect(events.length).toBe(1000);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });

    test('deep nesting performance', () => {
      const createDeepObject = (depth: number): any => {
        if (depth === 0) return { value: "deep" };
        return { nested: createDeepObject(depth - 1) };
      };

      const DeepObject = ld.object({
        data: ld.atom(z.any())
      });

      const obj = DeepObject.create();
      const events: any[] = [];

      obj.data.onComplete((data) => events.push(data));

      const deepData = createDeepObject(10);
      obj.update({ data: deepData });
      obj.complete();

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(deepData);
    });
  });
});
