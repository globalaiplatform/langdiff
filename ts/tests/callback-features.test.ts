import { z } from 'zod';
import { 
  StreamingObject, 
  StreamingList, 
  StreamingString, 
  Atom,
  Parser,
  string
} from '../src/index';
import * as ld from '../src/index';

describe('Callback Features Tests', () => {
  
  describe('on_start callbacks', () => {
    test('StreamingString onStart callback', () => {
      const str = new StreamingString();
      const events: string[] = [];

      str.onStart(() => events.push('started'));
      str.onAppend((chunk) => events.push(`append:${chunk}`));
      str.onComplete((value) => events.push(`complete:${value}`));

      str.update('hello');
      str.update('hello world');
      str.complete();

      expect(events).toEqual([
        'started',
        'append:hello',
        'append: world',
        'complete:hello world'
      ]);
    });

    test('StreamingList onStart callback', () => {
      const list = new StreamingList(string());
      const events: string[] = [];

      list.onStart(() => events.push('started'));
      list.onAppend((item, index) => events.push(`append:${index}:${item}`));
      list.onComplete((items) => events.push(`complete:${items.length}`));

      list.update(['item1']);
      list.update(['item1', 'item2']);
      list.complete();

      expect(events[0]).toContain('started');
    });

    test('Atom onStart callback', () => {
      const atom = new Atom(z.number());
      const events: string[] = [];

      atom.onStart(() => events.push('started'));
      atom.onComplete((value) => events.push(`complete:${value}`));

      atom.update(42);
      atom.complete();

      expect(events).toEqual([
        'started',
        'complete:42'
      ]);
    });

    test('StreamingObject onStart callback', () => {
      const TestObject = ld.object({
        message: ld.string()
      });

      const obj = TestObject.create();
      const events: string[] = [];

      obj.onStart(() => events.push('object_started'));
      obj.message.onStart(() => events.push('message_started'));
      obj.message.onAppend((chunk) => events.push(`append:${chunk}`));
      obj.onUpdate((value) => events.push(`update:${JSON.stringify(value)}`));
      obj.onComplete((value) => events.push(`complete:${JSON.stringify(value)}`));

      obj.update({ message: 'hello' });
      obj.complete();

      expect(events).toContain('object_started');
      expect(events).toContain('message_started');
      expect(events).toContain('append:hello');
    });
  });

  describe('Complex callback scenarios', () => {
    const Article = ld.object({
      title: ld.string(),
      tags: ld.array(ld.string()),
      content: ld.string(),
      metadata: ld.atom(z.any())
    });

    test('complex streaming scenario with all callback types', () => {
      const article = Article.create();
      const events: any[] = [];

      // Set up comprehensive event tracking
      article.onStart(() => events.push(['article_start']));
      article.onUpdate((data) => events.push(['article_update', Object.keys(data)]));
      article.onComplete((data) => events.push(['article_complete', Object.keys(data)]));

      article.title.onStart(() => events.push(['title_start']));
      article.title.onAppend((chunk) => events.push(['title_append', chunk]));
      article.title.onComplete((value) => events.push(['title_complete', value]));

      article.tags.onStart(() => events.push(['tags_start']));
      article.tags.onAppend((tag, index) => {
        events.push(['tags_append', index]);
        tag.onStart(() => events.push(['tag_start', index]));
        tag.onAppend((chunk) => events.push(['tag_append', index, chunk]));
        tag.onComplete((value) => events.push(['tag_complete', index, value]));
      });
      article.tags.onComplete((tags) => events.push(['tags_complete', tags.length]));

      article.content.onStart(() => events.push(['content_start']));
      article.content.onAppend((chunk) => events.push(['content_append', chunk]));
      article.content.onComplete((value) => events.push(['content_complete', value?.slice(0, 10)]));

      article.metadata.onStart(() => events.push(['metadata_start']));
      article.metadata.onComplete((value) => events.push(['metadata_complete', value]));

      // Simulate progressive streaming
      article.update({ title: 'My Art' });
      article.update({ 
        title: 'My Article', 
        tags: ['tech'] 
      });
      article.update({ 
        title: 'My Article', 
        tags: ['tech', 'programming'],
        content: 'This is the beginning'
      });
      article.update({ 
        title: 'My Article', 
        tags: ['tech', 'programming'],
        content: 'This is the beginning of a great article about technology.',
        metadata: { author: 'John', date: '2024-01-01' }
      });
      article.complete();

      // Verify key events occurred
      expect(events).toContainEqual(['article_start']);
      expect(events).toContainEqual(['title_start']);
      expect(events).toContainEqual(['title_append', 'My Art']);
      
      // Title might complete as 'My Art' or 'My Article' depending on when complete() is called
      const titleComplete = events.find(e => e[0] === 'title_complete');
      expect(titleComplete).toBeDefined();
      expect(typeof titleComplete[1]).toBe('string');
      
      expect(events).toContainEqual(['tags_start']);
      expect(events).toContainEqual(['tags_append', 0]);
      expect(events).toContainEqual(['tag_complete', 0, 'tech']);
      expect(events).toContainEqual(['content_start']);
      expect(events).toContainEqual(['metadata_complete', { author: 'John', date: '2024-01-01' }]);
    });

    test('streaming with parser integration', () => {
      const article = Article.create();
      const parser = new Parser(article);
      const events: any[] = [];

      article.title.onStart(() => events.push('title_started'));
      article.title.onAppend((chunk) => events.push(`title_chunk:${chunk}`));
      article.title.onComplete((value) => events.push(`title_done:${value}`));

      const jsonStr = JSON.stringify({
        title: 'Streaming Article',
        tags: ['streaming', 'json'],
        content: 'Content here',
        metadata: { version: 1 }
      });

      // Parse character by character to test progressive streaming
      for (let i = 0; i < jsonStr.length; i++) {
        parser.push(jsonStr[i]);
      }
      parser.complete();

      expect(events).toContain('title_started');
      expect(events).toContain('title_done:Streaming Article');
      
      // Should have received title in chunks
      const titleChunks = events.filter(e => typeof e === 'string' && e.startsWith('title_chunk:'));
      expect(titleChunks.length).toBeGreaterThan(1);
    });
  });

  describe('Callback error handling', () => {
    test('should throw callback errors naturally', () => {
      const str = new StreamingString();

      str.onStart(() => {
        throw new Error('Start callback error');
      });

      // Should throw the callback error
      expect(() => {
        str.update('test');
      }).toThrow('Start callback error');
    });

    test('should allow users to handle errors in their callbacks', () => {
      const str = new StreamingString();
      const events: string[] = [];

      str.onStart(() => {
        try {
          throw new Error('Start callback error');
        } catch (error) {
          events.push('error-handled');
        }
      });
      
      str.onAppend((chunk) => events.push(`append:${chunk}`));

      // Should not throw when user handles error
      expect(() => {
        str.update('test');
      }).not.toThrow();

      expect(events).toContain('error-handled');
      expect(events).toContain('append:test');
    });

    test('multiple callback registration', () => {
      const str = new StreamingString();
      const events: string[] = [];

      str.onAppend((chunk) => events.push(`first:${chunk}`));
      str.onAppend((chunk) => events.push(`second:${chunk}`));
      str.onComplete((value) => events.push(`first_complete:${value}`));
      str.onComplete((value) => events.push(`second_complete:${value}`));

      str.update('test');
      str.complete();

      expect(events).toContain('first:test');
      expect(events).toContain('second:test');
      expect(events).toContain('first_complete:test');
      expect(events).toContain('second_complete:test');
    });
  });

  describe('Callback timing and order', () => {
    test('callback execution order is correct', () => {
      const OrderTest = ld.object({
        field1: ld.string(),
        field2: ld.string()
      });

      const obj = OrderTest.create();
      const events: any[] = [];

      obj.onStart(() => events.push(['object_start']));
      obj.field1.onStart(() => events.push(['field1_start']));
      obj.field1.onComplete((v) => events.push(['field1_complete', v]));
      obj.field2.onStart(() => events.push(['field2_start']));
      obj.field2.onComplete((v) => events.push(['field2_complete', v]));
      obj.onComplete((v) => events.push(['object_complete']));

      obj.update({ field1: 'value1' });
      obj.update({ field1: 'value1', field2: 'value2' });
      obj.complete();

      // Verify the order: object starts first, then fields in order
      const startEvents = events.filter(e => e[0].includes('_start'));
      expect(startEvents[0]).toEqual(['object_start']);
      expect(startEvents[1]).toEqual(['field1_start']);
      expect(startEvents[2]).toEqual(['field2_start']);
    });
  });
});