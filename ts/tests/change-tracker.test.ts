import { trackChange, applyChange, Operation, JSONPatchChangeTracker, EfficientJSONPatchChangeTracker } from '../src/tracker';

// Define TypeScript interfaces for complex nested structures
interface Author {
  name: string;
  email: string | null;
}

interface Article {
  title: string;
  tags: string[];
  author: Author;
  contributors: Author[];
  metadata: { [key: string]: string };
}

describe('Change Tracking', () => {
  test('should track object property changes', () => {
    const [tracked, diffBuf] = trackChange({ name: 'John', age: 30 });
    
    tracked.name = 'Jane';
    const changes = diffBuf.flush();
    
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'replace',
      path: '/name',
      value: 'Jane',
    });
  });

  test('should track array additions', () => {
    const [tracked, diffBuf] = trackChange({ items: ['a', 'b'] });
    
    tracked.items.push('c');
    const changes = diffBuf.flush();
    
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'add',
      path: '/items/-',
      value: 'c',
    });
  });

  test('should track string append operations', () => {
    const [tracked, diffBuf] = trackChange({ message: 'Hello' });
    
    tracked.message = 'Hello World';
    const changes = diffBuf.flush();
    
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'append',
      path: '/message',
      value: ' World',
    });
  });

  test('should apply changes correctly', () => {
    const obj = { message: 'Hello', count: 0 };
    const operations: Operation[] = [
      { op: 'append', path: '/message', value: ' World' },
      { op: 'replace', path: '/count', value: 5 },
    ];
    
    applyChange(obj, operations);
    
    expect(obj.message).toBe('Hello World');
    expect(obj.count).toBe(5);
  });

  test('complex nested object change tracking', () => {
    const article: Article = {
      title: 'Initial Title',
      tags: ['python', 'testing'],
      author: { name: 'Alice', email: 'alice@example.com' },
      contributors: [{ name: 'Bob', email: 'bob@example.com' }],
      metadata: {},
    };

    const [tracked, tracker] = trackChange(article);

    // Test title change
    tracked.title = 'Updated Title';
    let changes = tracker.flush();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'replace',
      path: '/title',
      value: 'Updated Title',
    });

    // Test nested object property append (string concatenation)
    tracked.author.name = 'Alice Smith';
    changes = tracker.flush();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'append',
      path: '/author/name',
      value: ' Smith',
    });

    // Test array append
    tracked.tags.push('diff');
    changes = tracker.flush();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'add',
      path: '/tags/-',
      value: 'diff',
    });

    // Test adding new object to array
    tracked.contributors.push({ name: 'Charlie', email: 'charlie@example.com' });
    changes = tracker.flush();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'add',
      path: '/contributors/-',
      value: { name: 'Charlie', email: 'charlie@example.com' },
    });

    // Test setting nested property to null
    tracked.author.email = null;
    changes = tracker.flush();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'replace',
      path: '/author/email',
      value: null,
    });

    // Test setting nested property back from null
    tracked.author.email = 'alice@example.com';
    changes = tracker.flush();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'replace',
      path: '/author/email',
      value: 'alice@example.com',
    });

    // Test adding property to object/map
    tracked.metadata['version'] = '1.0';
    changes = tracker.flush();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'add',
      path: '/metadata/version',
      value: '1.0',
    });

    // Test removing property from object/map
    delete tracked.metadata['version'];
    changes = tracker.flush();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'remove',
      path: '/metadata/version',
    });
  });

  test('should track multiple simultaneous changes', () => {
    const obj = {
      user: { name: 'John', age: 30 },
      items: ['a', 'b'],
      settings: { theme: 'dark' },
    };

    const [tracked, tracker] = trackChange(obj);

    // Make multiple changes before flushing
    tracked.user.name = 'John Doe';
    tracked.items.push('c');
    tracked.settings.theme = 'light';

    const changes = tracker.flush();
    expect(changes).toHaveLength(3);
    
    expect(changes).toContainEqual({
      op: 'append',
      path: '/user/name',
      value: ' Doe',
    });
    expect(changes).toContainEqual({
      op: 'add',
      path: '/items/-',
      value: 'c',
    });
    expect(changes).toContainEqual({
      op: 'replace',
      path: '/settings/theme',
      value: 'light',
    });
  });

  test('should handle basic array modifications', () => {
    const obj = { items: ['a', 'b', 'c'] };
    const [tracked, tracker] = trackChange(obj);

    // Test array push
    tracked.items.push('d');
    let changes = tracker.flush();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'add',
      path: '/items/-',
      value: 'd',
    });

    // Test direct index assignment
    tracked.items[0] = 'A';
    changes = tracker.flush();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'replace',
      path: '/items/0',
      value: 'A',
    });
  });

  test('nested array object property modification', () => {
    const article: Article = {
      title: 'Title',
      tags: ['tag1'],
      author: { name: 'Alice', email: 'alice@example.com' },
      contributors: [{ name: 'Bob', email: 'bob@example.com' }],
      metadata: {},
    };

    const [tracked, tracker] = trackChange(article);

    // Test nested array object property modification with string append
    tracked.contributors[0].name = 'Bob Smith';
    
    let changes = tracker.flush();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'append',
      path: '/contributors/0/name',
      value: ' Smith',
    });

    // Test nested array object property replacement
    tracked.contributors[0].email = 'newbob@example.com';
    
    changes = tracker.flush();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'replace',
      path: '/contributors/0/email',
      value: 'newbob@example.com',
    });
  });

  test('array pop operation', () => {
    const obj = { items: ['a', 'b', 'c'] };
    const [tracked, tracker] = trackChange(obj);

    tracked.items.pop();
    const changes = tracker.flush();
    
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'remove',
      path: '/items/2',
    });
  });

  test('array splice operations', () => {
    const obj = { items: [1, 2, 3, 4, 5] };
    const [tracked, tracker] = trackChange(obj);

    // Remove one element from middle
    tracked.items.splice(2, 1);
    let changes = tracker.flush();
    
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({
      op: 'remove',
      path: '/items/2',
    });

    // Insert elements
    tracked.items.splice(1, 0, 10, 20);
    changes = tracker.flush();
    
    expect(changes).toHaveLength(2);
    expect(changes[0]).toEqual({
      op: 'add',
      path: '/items/1',
      value: 10,
    });
    expect(changes[1]).toEqual({
      op: 'add',
      path: '/items/2',
      value: 20,
    });
  });

  describe('Direct ChangeTracker Class Comparison', () => {
    test('JSONPatchChangeTracker vs EfficientJSONPatchChangeTracker - object string append', () => {
      const initialObj = { message: 'Hello' };
      
      // Test JSONPatchChangeTracker
      const standardTracker = new JSONPatchChangeTracker();
      const standardTracked = standardTracker.track({ ...initialObj });
      standardTracked.message = 'Hello World';
      const standardChanges = standardTracker.flush();
      
      // Test EfficientJSONPatchChangeTracker  
      const efficientTracker = new EfficientJSONPatchChangeTracker();
      const efficientTracked = efficientTracker.track({ ...initialObj });
      efficientTracked.message = 'Hello World';
      const efficientChanges = efficientTracker.flush();
      
      // Standard should use replace, Efficient should use append
      expect(standardChanges).toEqual([{
        op: 'replace',
        path: '/message',
        value: 'Hello World',
      }]);
      
      expect(efficientChanges).toEqual([{
        op: 'append', 
        path: '/message',
        value: ' World',
      }]);
    });

    test('JSONPatchChangeTracker vs EfficientJSONPatchChangeTracker - array element string append', () => {
      const initialObj = { items: ['Hello'] };
      
      // Test JSONPatchChangeTracker
      const standardTracker = new JSONPatchChangeTracker();
      const standardTracked = standardTracker.track({ items: [...initialObj.items] });
      standardTracked.items[0] = 'Hello World';
      const standardChanges = standardTracker.flush();
      
      // Test EfficientJSONPatchChangeTracker
      const efficientTracker = new EfficientJSONPatchChangeTracker();
      const efficientTracked = efficientTracker.track({ items: [...initialObj.items] });
      efficientTracked.items[0] = 'Hello World';
      const efficientChanges = efficientTracker.flush();
      
      // Standard should use replace, Efficient should use append
      expect(standardChanges).toEqual([{
        op: 'replace',
        path: '/items/0',
        value: 'Hello World',
      }]);
      
      expect(efficientChanges).toEqual([{
        op: 'append',
        path: '/items/0', 
        value: ' World',
      }]);
    });

    test('Both trackers should handle non-string values identically', () => {
      const initialObj = { count: 5, items: [10] };
      
      // Test JSONPatchChangeTracker
      const standardTracker = new JSONPatchChangeTracker();
      const standardTracked = standardTracker.track({ ...initialObj, items: [...initialObj.items] });
      standardTracked.count = 10;
      standardTracked.items[0] = 20;
      const standardChanges = standardTracker.flush();
      
      // Test EfficientJSONPatchChangeTracker
      const efficientTracker = new EfficientJSONPatchChangeTracker();
      const efficientTracked = efficientTracker.track({ ...initialObj, items: [...initialObj.items] });
      efficientTracked.count = 10;
      efficientTracked.items[0] = 20;
      const efficientChanges = efficientTracker.flush();
      
      // Both should produce identical results for non-string values
      expect(standardChanges).toEqual(efficientChanges);
      expect(standardChanges).toEqual([
        { op: 'replace', path: '/count', value: 10 },
        { op: 'replace', path: '/items/0', value: 20 },
      ]);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty string append correctly', () => {
      const [tracked, diffBuf] = trackChange({ message: 'Hello' });
      
      // Appending empty string should not generate changes
      tracked.message = 'Hello';
      const changes = diffBuf.flush();
      
      expect(changes).toHaveLength(0);
    });

    test('should handle non-append string changes', () => {
      const [tracked, diffBuf] = trackChange({ message: 'Hello World' });
      
      // String that doesn't start with original should be replace
      tracked.message = 'Goodbye World';
      const changes = diffBuf.flush();
      
      expect(changes).toEqual([{
        op: 'replace',
        path: '/message',
        value: 'Goodbye World',
      }]);
    });

    test('should handle empty array operations', () => {
      const [tracked, diffBuf] = trackChange({ items: [] as string[] });
      
      // Adding to empty array
      tracked.items.push('first');
      const changes = diffBuf.flush();
      
      expect(changes).toEqual([{
        op: 'add',
        path: '/items/-',
        value: 'first',
      }]);
    });

    test('should handle array bounds edge cases', () => {
      const [tracked, diffBuf] = trackChange({ items: ['a', 'b'] });
      
      // Direct assignment beyond array length
      tracked.items[5] = 'f';
      const changes = diffBuf.flush();
      
      expect(changes).toEqual([{
        op: 'add',
        path: '/items/-',
        value: 'f',
      }]);
    });
  });
});
