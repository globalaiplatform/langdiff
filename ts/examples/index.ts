/**
 * Examples Index
 * 
 * This file runs all examples in sequence to demonstrate
 * the full capabilities of LangDiff.
 */

import { basicStreamingExample } from './01-basic-streaming';
import { changeTrackingExample, incrementalChangeExample } from './02-change-tracking';
import { openaiStreamingExample, webServerExample } from './03-openai-integration';
import { frontendIntegrationExample } from './04-frontend-integration';

async function runAllExamples() {
  console.log('🚀 LangDiff Examples Demo\n');
  console.log('='.repeat(50));

  try {
    // Basic Streaming
    console.log('\n📦 Example 1: Basic Streaming Parser');
    console.log('-'.repeat(40));
    await basicStreamingExample();
    await delay(1000);

    // Change Tracking
    console.log('\n📦 Example 2: Change Tracking');
    console.log('-'.repeat(40));
    await changeTrackingExample();
    await delay(500);
    await incrementalChangeExample();
    await delay(1000);

    // OpenAI Integration
    console.log('\n📦 Example 3: OpenAI Integration');
    console.log('-'.repeat(40));
    await openaiStreamingExample();
    await delay(500);
    await webServerExample();
    await delay(1000);

    // Frontend Integration
    console.log('\n📦 Example 4: Frontend Integration');
    console.log('-'.repeat(40));
    await frontendIntegrationExample();
    await delay(1000);

    console.log('\n🎉 All examples completed successfully!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Example failed:', error);
    process.exit(1);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Interactive menu for running individual examples
async function interactiveMenu() {
  const examples = [
    { name: 'Basic Streaming Parser', fn: basicStreamingExample },
    { name: 'Change Tracking', fn: async () => {
      await changeTrackingExample();
      await incrementalChangeExample();
    }},
    { name: 'OpenAI Integration', fn: async () => {
      await openaiStreamingExample();
      await webServerExample();
    }},
    { name: 'Frontend Integration', fn: frontendIntegrationExample },
    { name: 'Run All Examples', fn: runAllExamples },
  ];

  console.log('🎯 LangDiff Examples Menu\n');
  examples.forEach((example, index) => {
    console.log(`${index + 1}. ${example.name}`);
  });

  console.log('\nTo run a specific example:');
  console.log('npx ts-node examples/01-basic-streaming.ts');
  console.log('npx ts-node examples/02-change-tracking.ts');
  console.log('npx ts-node examples/03-openai-integration.ts');
  console.log('npx ts-node examples/04-frontend-integration.ts');
  console.log('\nTo run all examples:');
  console.log('npx ts-node examples/index.ts');
}

// Check if we're being run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    interactiveMenu();
  } else {
    runAllExamples().catch(console.error);
  }
}

export {
  runAllExamples,
  interactiveMenu,
};