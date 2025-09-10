import { z } from 'zod';
import { fromZod, StreamingString, Atom, StreamingList, StreamingObject } from '../src';
import * as ld from '../src';

describe('fromZod Integration', () => {
  describe('Basic Types', () => {
    it('should create StreamingObject from simple Zod schema', () => {
      const schema = z.object({
        name: z.string().describe('a name'),
        age: z.number().describe('an age'),
        active: z.boolean().describe('an active status')
      }).describe('A simple user object');

      const StreamingUser = fromZod(schema);
      const user = StreamingUser.create();

      // Check that fields are properly initialized
      expect(user.name).toBeInstanceOf(StreamingString);
      expect(user.age).toBeInstanceOf(Atom);
      expect(user.active).toBeInstanceOf(Atom);
    });

    it('should handle string fields with proper streaming', () => {
      const schema = z.object({
        message: z.string()
      });

      const StreamingMessage = fromZod(schema);
      const message = StreamingMessage.create();

      const chunks: string[] = [];
      message.message.onAppend((chunk) => {
        chunks.push(chunk);
      });

      let completed = false;
      message.message.onComplete((value) => {
        completed = true;
        expect(value).toBe('Hello World');
      });

      message.update({ message: 'Hello' });
      message.update({ message: 'Hello World' });
      message.complete();

      expect(chunks).toEqual(['Hello', ' World']);
      expect(completed).toBe(true);
    });

    it('should handle number and boolean atoms', () => {
      const schema = z.object({
        count: z.number(),
        enabled: z.boolean()
      });

      const StreamingData = fromZod(schema);
      const data = StreamingData.create();

      let countCompleted = false;
      let enabledCompleted = false;

      data.count.onComplete((value) => {
        countCompleted = true;
        expect(value).toBe(42);
      });

      data.enabled.onComplete((value) => {
        enabledCompleted = true;
        expect(value).toBe(true);
      });

      data.update({ count: 42, enabled: true });
      data.complete();

      expect(countCompleted).toBe(true);
      expect(enabledCompleted).toBe(true);
    });
  });

  describe('Array Types', () => {
    it('should create StreamingList for string arrays', () => {
      const schema = z.object({
        tags: z.array(z.string())
      });

      const StreamingPost = fromZod(schema);
      const post = StreamingPost.create();

      expect(post.tags).toBeInstanceOf(StreamingList);

      const appendedTags: string[] = [];
      post.tags.onAppend((tag, index) => {
        expect(tag).toBeInstanceOf(StreamingString);
        
        tag.onAppend((chunk) => {
          if (!appendedTags[index]) appendedTags[index] = '';
          appendedTags[index] += chunk;
        });
      });

      post.update({ tags: ['react'] });
      post.update({ tags: ['react', 'typescript'] });
      post.complete();

      expect(appendedTags).toEqual(['react', 'typescript']);
    });

    it('should handle arrays of objects', () => {
      const schema = z.object({
        users: z.array(z.object({
          name: z.string(),
          email: z.string()
        }))
      });

      const StreamingUserList = fromZod(schema);
      const userList = StreamingUserList.create();

      const users: Array<{ name: string; email: string }> = [];
      
      userList.users.onAppend((user, index) => {
        users[index] = { name: '', email: '' };
        
        user.name.onAppend((chunk) => {
          users[index].name += chunk;
        });
        
        user.email.onAppend((chunk) => {
          users[index].email += chunk;
        });
      });

      userList.update({
        users: [
          { name: 'John', email: 'john@example.com' }
        ]
      });

      userList.update({
        users: [
          { name: 'John', email: 'john@example.com' },
          { name: 'Jane', email: 'jane@example.com' }
        ]
      });

      userList.complete();

      expect(users).toEqual([
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' }
      ]);
    });
  });

  describe('Nested Objects', () => {
    it('should handle nested object structures', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string(),
            bio: z.string()
          }),
          settings: z.object({
            theme: z.string(),
            notifications: z.boolean()
          })
        })
      });

      const StreamingNestedData = fromZod(schema);
      const data = StreamingNestedData.create();

      expect(data.user).toBeInstanceOf(StreamingObject);
      expect(data.user.profile).toBeInstanceOf(StreamingObject);
      expect(data.user.settings).toBeInstanceOf(StreamingObject);
      expect(data.user.profile.name).toBeInstanceOf(StreamingString);
      expect(data.user.profile.bio).toBeInstanceOf(StreamingString);
      expect(data.user.settings.theme).toBeInstanceOf(StreamingString);
      expect(data.user.settings.notifications).toBeInstanceOf(Atom);

      let nameComplete: string | null = '';
      let bioComplete: string | null = '';
      let themeComplete: string | null = '';
      let notificationsComplete = false;

      data.user.profile.name.onComplete((value) => {
        nameComplete = value;
      });

      data.user.profile.bio.onComplete((value) => {
        bioComplete = value;
      });

      data.user.settings.theme.onComplete((value) => {
        themeComplete = value;
      });

      data.user.settings.notifications.onComplete((value) => {
        notificationsComplete = value;
      });

      data.update({
        user: {
          profile: {
            name: 'Alice',
            bio: 'Software Developer'
          },
          settings: {
            theme: 'dark',
            notifications: true
          }
        }
      });

      data.complete();

      expect(nameComplete).toBe('Alice');
      expect(bioComplete).toBe('Software Developer');
      expect(themeComplete).toBe('dark');
      expect(notificationsComplete).toBe(true);
    });
  });

  describe('Optional and Nullable Types', () => {
    it('should handle optional fields', () => {
      const schema = z.object({
        title: z.string(),
        subtitle: z.string().optional(),
        description: z.string().nullable()
      });

      const StreamingContent = fromZod(schema);
      const content = StreamingContent.create();

      expect(content.title).toBeInstanceOf(StreamingString);
      expect(content.subtitle).toBeInstanceOf(StreamingString);
      expect(content.description).toBeInstanceOf(StreamingString);

      // Test with partial data
      content.update({
        title: 'Main Title',
        description: null
      });

      content.complete();

      expect(content.title.value).toBe('Main Title');
      expect(content.description.value).toBe(null);
    });
  });

  describe('Complex Real-world Example', () => {
    it('should handle a blog post with comments', () => {
      const CommentSchema = z.object({
        id: z.number(),
        author: z.string(),
        content: z.string(),
        timestamp: z.string()
      });

      const BlogPostSchema = z.object({
        title: z.string(),
        content: z.string(),
        author: z.object({
          name: z.string(),
          email: z.string()
        }),
        tags: z.array(z.string()),
        comments: z.array(CommentSchema),
        metadata: z.object({
          createdAt: z.string(),
          updatedAt: z.string(),
          published: z.boolean()
        })
      });

      const StreamingBlogPost = fromZod(BlogPostSchema);
      const post = StreamingBlogPost.create();

      // Track streaming events
      const events: string[] = [];

      post.title.onAppend((chunk) => {
        events.push(`title: ${chunk}`);
      });

      post.author.name.onAppend((chunk) => {
        events.push(`author.name: ${chunk}`);
      });

      post.tags.onAppend((tag, index) => {
        tag.onAppend((chunk) => {
          events.push(`tags[${index}]: ${chunk}`);
        });
      });

      post.comments.onAppend((comment, index) => {
        comment.author.onAppend((chunk) => {
          events.push(`comments[${index}].author: ${chunk}`);
        });
        comment.content.onAppend((chunk) => {
          events.push(`comments[${index}].content: ${chunk}`);
        });
      });

      // Simulate realistic streaming updates
      post.update({
        title: 'My Blog',
        author: { name: 'John', email: 'john@example.com' },
        content: 'Content here...',
        tags: ['tech'],
        comments: [],
      });

      post.update({
        title: 'My Blog Post',
        author: { name: 'John', email: 'john@example.com' },
        content: 'Content here...',
        tags: ['tech', 'javascript'],
        comments: [
          { id: 1, author: 'Alice', content: 'Great!', timestamp: '2024-01-02' }
        ],
        metadata: { createdAt: '2024-01-01', updatedAt: '2024-01-01', published: true }
      });

      post.complete();

      // Verify that streaming events occurred
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.includes('title:'))).toBe(true);
      expect(events.some(e => e.includes('author.name:'))).toBe(true);
      
      // Check tags - at least one tag event should occur
      const tagEvents = events.filter(e => e.includes('tags['));
      expect(tagEvents.length).toBeGreaterThanOrEqual(1);
      expect(events.some(e => e.includes('tags[0]: tech'))).toBe(true);
      
      // Check comments - if comments were processed
      expect(events.some(e => e.includes('comments[0].author: Alice'))).toBe(true);
      expect(events.some(e => e.includes('comments[0].content: Great!'))).toBe(true);
    });
  });

  describe('Type Safety and Error Handling', () => {
    it('should preserve Zod schema for validation', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(0).max(120)
      });

      const StreamingUser = fromZod(schema);
      const zodSchema = StreamingUser.toZod();
      
      expect(() => zodSchema.parse({ email: 'invalid-email', age: 25 })).toThrow();
      expect(() => zodSchema.parse({ email: 'test@example.com', age: -1 })).toThrow();
      expect(zodSchema.parse({ email: 'test@example.com', age: 25 })).toEqual({
        email: 'test@example.com',
        age: 25
      });
    });

    it('should handle edge cases gracefully', () => {
      const schema = z.object({
        data: z.array(z.string())
      });

      const StreamingData = fromZod(schema);
      const data = StreamingData.create();

      // Test empty array
      data.update({ data: [] });
      data.complete();

      expect(data.data.value).toEqual([]);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large nested structures efficiently', () => {
      const schema = z.object({
        items: z.array(z.object({
          id: z.number(),
          data: z.array(z.string())
        }))
      });

      const StreamingLargeData = fromZod(schema);
      const data = StreamingLargeData.create();

      const itemCount = 100;
      const items = Array.from({ length: itemCount }, (_, i) => ({
        id: i,
        data: [`item-${i}-data-1`, `item-${i}-data-2`]
      }));

      data.update({ items });
      data.complete();

      expect(data.items.value).toHaveLength(itemCount);
    });
  });
});

describe('toZod', () => {
  it('should convert StreamingObject to Zod schema', () => {
    const schema = ld.object({
      description: ld.string().describe('field description'),
    }).describe('object description').toZod();
    expect(schema).toBeInstanceOf(z.ZodObject);
    if (!(schema instanceof z.ZodObject)) throw new Error('Not a ZodObject');
    expect(schema.description).toBe('object description');
    expect(schema.shape.description).toBeInstanceOf(z.ZodString);
    expect(schema.shape.description.description).toBe('field description');
  });
});
