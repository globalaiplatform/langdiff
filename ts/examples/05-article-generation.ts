/**
 * Article Generation Example
 * 
 * This example demonstrates a complete article generation scenario
 * using LangDiff with both streaming parsing and change tracking.
 * It simulates generating a multi-section article with an LLM.
 */

import { z } from 'zod';
import {
  StreamingString,
  Parser,
  trackChange,
  applyChange,
  Operation,
  fromZod,
} from '../src';

interface Section {
  title: string;
  content: string;
  done: boolean;
}

interface Article {
  sections: Section[];
}

// Define Zod schema for article generation response
const ArticleGenerationSchema = z.object({
  sectionTitles: z.array(z.string()),
  sectionContents: z.array(z.string()),
});

// Generate StreamingObject class from Zod schema
const ArticleGenerationResponse = fromZod(ArticleGenerationSchema);

/**
 * Simulate streaming from an LLM server
 */
async function* serverStream(_prompt: string): AsyncGenerator<Operation[]> {
  // Create initial article with some sections pre-allocated
  const initialArticle: Article = { 
    sections: [
      { title: '', content: '', done: false },
      { title: '', content: '', done: false },
      { title: '', content: '', done: false },
    ]
  };
  
  const [ui, diffBuf] = trackChange<Article>(initialArticle);
  const result = ArticleGenerationResponse.create();

  // Set up event handlers for section titles
  result.sectionTitles.onAppend((title: StreamingString, index: number) => {
    title.onAppend((chunk: string) => {
      ui.sections[index].title += chunk;
    });
  });

  // Set up event handlers for section contents  
  result.sectionContents.onAppend((content: StreamingString, index: number) => {
    content.onAppend((chunk: string) => {
      ui.sections[index].content += chunk;
    });

    content.onComplete(() => {
      ui.sections[index].done = true;
    });
  });

  // Use OpenAI API for real streaming (commented out for demo purposes)
  /*
  import { zodResponseFormat } from 'openai/helpers/zod';
  
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const stream = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'user', content: prompt },
    ],
    stream: true,
    response_format: zodResponseFormat(ArticleGenerationSchema, 'article_generation'),
  });

  const parser = new Parser(result);

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      parser.push(content);
      const changes = diffBuf.flush();
      if (changes.length > 0) {
        yield changes;
      }
    }
  }

  parser.complete();
  const finalChanges = diffBuf.flush();
  if (finalChanges.length > 0) {
    yield finalChanges;
  }
  */

  // Simulate streaming JSON data for demo purposes
  const mockStreamData = [
    '{"sectionTitles": ["',
    'Getting',
    ' Started", "',
    'Project',
    ' Setup", "',
    'Publishing"],',
    ' "sectionContents": ["',
    'First,',
    ' you need to',
    ' create a new',
    ' TypeScript project.',
    ' Initialize with npm',
    ' and configure tsconfig.',
    '", "',
    'Set up your',
    ' build pipeline.',
    ' Configure Jest',
    ' for testing.',
    '", "',
    'Publish to npm',
    ' registry.',
    ' Tag your releases',
    ' properly."]}',
  ];

  const parser = new Parser(result);

  for (const chunk of mockStreamData) {
    parser.push(chunk);
    const changes = diffBuf.flush();
    if (changes.length > 0) {
      yield changes;
    }
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  parser.complete();
  const finalChanges = diffBuf.flush();
  if (finalChanges.length > 0) {
    yield finalChanges;
  }
}

/**
 * Render the article to console
 */
function render(article: Article, _final = false): void {
  let buf = '\x1b[H\x1b[J'; // Clear the console (equivalent to "\033[H\033[J")
  
  for (const section of article.sections) {
    // Title with formatting
    buf += '\x1b[1m'; // Bold
    buf += section.title;
    if (section.done) {
      buf += '\x1b[0;32m ✓ done'; // Green "done" indicator
    }
    buf += '\x1b[0m\n'; // Reset formatting and newline
    
    // Content
    if (section.done) {
      buf += section.content;
    } else if (section.content) {
      // Show content with blinking cursor on last character
      const content = section.content;
      const lastChar = content[content.length - 1];
      const beforeLast = content.slice(0, -1);
      buf += beforeLast + `\x1b[7;32m${lastChar}\x1b[0m`;
    }
    buf += '\n\n';
  }
  
  process.stdout.write(buf);
}

/**
 * Main function
 */
async function articleGenerationExample(): Promise<void> {
  console.log('📰 Article Generation Example\n');
  console.log('This example demonstrates streaming article generation with LangDiff.\n');
  
  const prompt = 'Write me a guide to open source a TypeScript library in 3 sections without numbering. Section content should be 3 lines. Be simple and concise.';
  
  const article: Article = { 
    sections: [
      { title: '', content: '', done: false },
      { title: '', content: '', done: false },
      { title: '', content: '', done: false },
    ]
  };
  
  console.log('🔄 Starting article generation...\n');
  render(article);

  try {
    for await (const changes of serverStream(prompt)) {
      applyChange(article, changes);
      render(article);
    }
    
    render(article, true);
    console.log('\n✅ Article generation completed!');
    
    // Show final result
    console.log('\n📄 Final Article:');
    article.sections.forEach((section, index) => {
      console.log(`\n${index + 1}. ${section.title}`);
      console.log(section.content);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }

  // Keep the final result visible
  setTimeout(() => {
    console.log('\n🎉 Demo completed!');
  }, 1000);
}

// Run the example if this file is executed directly
if (require.main === module) {
  articleGenerationExample().catch(console.error);
}

export { articleGenerationExample };