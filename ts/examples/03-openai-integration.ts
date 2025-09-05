/**
 * OpenAI Integration Example
 * 
 * This example demonstrates how to integrate LangDiff with OpenAI's
 * streaming API to create real-time AI applications.
 */

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  StreamingString,
  Parser,
  trackChange,
  Operation,
} from '../src';
import * as ld from '../src';

// Generate StreamingObject class using ld namespace (better type inference)
const CodeReviewResponse = ld.object({
  summary: ld.string(),
  issues: ld.array(ld.string()),
  suggestions: ld.array(ld.string()),
  score: ld.string()
});

// Derive the Zod schema for OpenAI SDK
const CodeReviewSchema = CodeReviewResponse.toZod();

interface CodeReview {
  summary: string;
  issues: string[];
  suggestions: string[];
  score: string;
  status: {
    summaryComplete: boolean;
    issuesComplete: boolean;
    suggestionsComplete: boolean;
    scoreComplete: boolean;
  };
}

async function openaiStreamingExample() {
  console.log('🤖 OpenAI Integration Example\n');

  // Initialize OpenAI client (you need to set OPENAI_API_KEY environment variable)
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  });

  // Create the streaming response structure
  const response = CodeReviewResponse.create();
  
  // Initialize UI state
  const initialReview: CodeReview = {
    summary: '',
    issues: [],
    suggestions: [],
    score: '',
    status: {
      summaryComplete: false,
      issuesComplete: false,
      suggestionsComplete: false,
      scoreComplete: false,
    }
  };

  // Track changes for efficient updates
  const [review, diffBuffer] = trackChange<CodeReview>(initialReview);

  // Set up event handlers
  setupEventHandlers(response, review);

  // Sample code to review
  const codeToReview = `
function calculateTotal(items) {
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}
`;

  const systemPrompt = `You are a code reviewer. Analyze the provided code and respond with a JSON object containing:
- summary: A brief overview of the code
- issues: An array of potential problems or bugs
- suggestions: An array of improvement recommendations  
- score: A score from 1-10 with brief explanation

Be concise and practical. Focus on real issues and actionable suggestions.`;

  console.log('🔄 Starting OpenAI streaming...\n');

  try {
    // This is a mock example since we don't want to require a real API key
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-api-key-here') {
      await streamWithRealAPI(openai, systemPrompt, codeToReview, response, review, diffBuffer);
    } else {
      await streamWithMockData(response, review, diffBuffer);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function streamWithRealAPI(
  openai: OpenAI,
  systemPrompt: string,
  codeToReview: string,
  response: ld.infer<typeof CodeReviewResponse>,
  review: CodeReview,
  diffBuffer: any
) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-5',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Please review this code:\n\n${codeToReview}` }
    ],
    stream: true,
    response_format: zodResponseFormat(CodeReviewSchema, 'code_review'),
  });

  const parser = new Parser(response);
  const logger = new ChangeLogger();

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      parser.push(content);
      
      // Get incremental changes
      const changes = diffBuffer.flush();
      if (changes.length > 0) {
        console.log('📡 Streaming update:');
        logger.log(changes);
        console.log('Current state:', JSON.stringify(review, null, 2));
        console.log('---\n');
      }
    }
  }

  parser.complete();
  const finalChanges = diffBuffer.flush();
  if (finalChanges.length > 0) {
    console.log('🏁 Final changes:');
    logger.log(finalChanges);
  }
}

async function streamWithMockData(
  response: ld.infer<typeof CodeReviewResponse>,
  review: CodeReview,
  diffBuffer: any
) {
  console.log('📝 Using mock data (set OPENAI_API_KEY for real API)');
  
  const mockStreamData = [
    '{"summary": "',
    'The function calculates',
    ' total cost for items',
    ' but uses older',
    ' JavaScript syntax',
    '", "issues": ["',
    'Uses var instead',
    ' of const/let',
    '", "',
    'No input validation',
    '", "',
    'No error handling',
    ' for missing properties',
    '"], "suggestions": ["',
    'Use const/let',
    ' for variable declarations',
    '", "',
    'Add input validation',
    '", "',
    'Use array methods',
    ' like reduce()',
    '", "',
    'Add JSDoc comments',
    '"], "score": "',
    '6/10 - Functional',
    ' but needs modernization',
    ' and error handling',
    '"}',
  ];

  const parser = new Parser(response);
  const logger = new ChangeLogger();

  for (const chunk of mockStreamData) {
    console.log(`🔄 Processing: "${chunk}"`);
    parser.push(chunk);
    
    const changes = diffBuffer.flush();
    if (changes.length > 0) {
      console.log('📡 Streaming update:');
      logger.log(changes);
      console.log('Current state:', JSON.stringify(review, null, 2));
      console.log('---\n');
    }
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  parser.complete();
  const finalChanges = diffBuffer.flush();
  if (finalChanges.length > 0) {
    console.log('🏁 Final changes:');
    logger.log(finalChanges);
  }

  console.log('\n✅ Final review:');
  console.log(JSON.stringify(review, null, 2));
}

function setupEventHandlers(response: ld.infer<typeof CodeReviewResponse>, review: CodeReview) {
  // Summary handlers
  response.summary.onAppend((chunk) => {
    review.summary += chunk;
  });
  response.summary.onComplete(() => {
    review.status.summaryComplete = true;
    console.log('📄 Summary completed');
  });

  // Issues handlers
  response.issues.onAppend((issue: StreamingString, index: number) => {
    review.issues[index] = '';
    issue.onAppend((chunk: string) => {
      review.issues[index] += chunk;
    });
    issue.onComplete(() => {
      console.log(`🐛 Issue #${index + 1} completed: "${review.issues[index]}"`);
    });
  });
  response.issues.onComplete(() => {
    review.status.issuesComplete = true;
    console.log('🐛 All issues completed');
  });

  // Suggestions handlers
  response.suggestions.onAppend((suggestion: StreamingString, index: number) => {
    review.suggestions[index] = '';
    suggestion.onAppend((chunk: string) => {
      review.suggestions[index] += chunk;
    });
    suggestion.onComplete(() => {
      console.log(`💡 Suggestion #${index + 1} completed: "${review.suggestions[index]}"`);
    });
  });
  response.suggestions.onComplete(() => {
    review.status.suggestionsComplete = true;
    console.log('💡 All suggestions completed');
  });

  // Score handlers
  response.score.onAppend((chunk: string) => {
    review.score += chunk;
  });
  response.score.onComplete(() => {
    review.status.scoreComplete = true;
    console.log(`⭐ Score completed: "${review.score}"`);
  });
}

class ChangeLogger {
  private count = 0;

  log(changes: Operation[]) {
    changes.forEach((change, i) => {
      console.log(`  ${this.count + i + 1}. ${change.op} ${change.path}: ${JSON.stringify(change.value)}`);
    });
    this.count += changes.length;
  }
}

// Example of using LangDiff in a web server context
async function webServerExample() {
  console.log('\n🌐 Web Server Example (Express-like)\n');

  // Simulate server-sent events
  function sendSSE(data: any) {
    console.log(`data: ${JSON.stringify(data)}\n`);
  }

  const response = CodeReviewResponse.create();
  const [review, diffBuffer] = trackChange<CodeReview>({
    summary: '',
    issues: [],
    suggestions: [],
    score: '',
    status: {
      summaryComplete: false,
      issuesComplete: false,
      suggestionsComplete: false,
      scoreComplete: false,
    }
  });

  setupEventHandlers(response, review);

  // Simulate processing
  const mockData = ['{"summary": "Good code', '" , "issues": ["Minor issue"], "score": "8/10"}'];
  const parser = new Parser(response);

  for (const chunk of mockData) {
    parser.push(chunk);
    const changes = diffBuffer.flush();
    if (changes.length > 0) {
      // Send only the changes to clients
      sendSSE({ type: 'update', changes });
    }
  }

  parser.complete();
  const finalChanges = diffBuffer.flush();
  if (finalChanges.length > 0) {
    sendSSE({ type: 'complete', changes: finalChanges });
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  Promise.resolve()
    .then(() => openaiStreamingExample())
    .then(() => webServerExample())
    .catch(console.error);
}

export { openaiStreamingExample, webServerExample };