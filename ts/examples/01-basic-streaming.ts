/**
 * Basic Streaming Parser Example
 * 
 * This example demonstrates how to use LangDiff's streaming parser
 * to handle progressive JSON parsing with type-safe callbacks.
 */

import * as ld from '../src';

// Define a simple data structure for a shopping list
const ShoppingList = ld.object({
  items: ld.array(ld.string())
});

interface UIState {
  items: string[];
  itemsComplete: boolean[];
}

async function basicStreamingExample() {
  console.log('🛒 Basic Streaming Parser Example\n');

  // Create the streaming object
  const shoppingList = ShoppingList.create();
  
  // Create UI state
  const ui: UIState = {
    items: [],
    itemsComplete: []
  };

  // Set up event handlers
  shoppingList.items.onAppend((item: ld.StreamingString, index: number) => {
    console.log(`📝 New item started: #${index}`);
    ui.items[index] = '';
    ui.itemsComplete[index] = false;

    item.onAppend((chunk: string) => {
      ui.items[index] += chunk;
      console.log(`   ↳ "${ui.items[index]}"`);
    });

    item.onComplete(() => {
      ui.itemsComplete[index] = true;
      console.log(`   ✅ Item #${index} completed: "${ui.items[index]}"`);
    });
  });

  shoppingList.items.onComplete(() => {
    console.log('\n🎉 All items completed!\n');
  });

  // Simulate streaming JSON data
  const mockStreamData = [
    '{"items": ["',
    'Milk',
    '", "',
    'Bread',
    '", "',
    'Apple',
    's", "',
    'Banan',
    'as"]}',
  ];

  const parser = new ld.Parser(shoppingList);

  console.log('Starting to parse streaming data...\n');

  for (const chunk of mockStreamData) {
    console.log(`🔄 Processing chunk: "${chunk}"`);
    parser.push(chunk);
    console.log(`Current state: ${JSON.stringify(ui.items)}\n`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  parser.complete();
  
  console.log('Final UI State:');
  console.log(`Items: ${JSON.stringify(ui.items)}`);
  console.log(`Completed: ${JSON.stringify(ui.itemsComplete)}`);
}

// Run the example if this file is executed directly
if (require.main === module) {
  basicStreamingExample().catch(console.error);
}

export { basicStreamingExample };