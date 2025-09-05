/**
 * Change Tracking Example
 * 
 * This example demonstrates how to use LangDiff's change tracking
 * to monitor object mutations and generate JSON Patch operations.
 */

import {
  trackChange,
  applyChange,
  Operation,
} from '../src';

interface TodoItem {
  id: number;
  text: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface TodoApp {
  todos: TodoItem[];
  filter: 'all' | 'active' | 'completed';
  stats: {
    total: number;
    completed: number;
    active: number;
  };
}

async function changeTrackingExample() {
  console.log('📋 Change Tracking Example\n');

  // Initial state
  const initialState: TodoApp = {
    todos: [
      { id: 1, text: 'Learn LangDiff', completed: false, priority: 'high' },
      { id: 2, text: 'Build awesome app', completed: false, priority: 'medium' }
    ],
    filter: 'all',
    stats: { total: 2, completed: 0, active: 2 }
  };

  // Track changes to the state
  const [state, diffBuffer] = trackChange<TodoApp>(initialState);

  console.log('Initial state:');
  console.log(JSON.stringify(state, null, 2));
  console.log('\n--- Making Changes ---\n');

  // Simulate a series of user actions
  console.log('1. Add a new todo item');
  state.todos.push({
    id: 3,
    text: 'Write documentation',
    completed: false,
    priority: 'low'
  });

  let changes = diffBuffer.flush();
  console.log('Changes:', JSON.stringify(changes, null, 2));
  console.log();

  console.log('2. Mark first todo as completed');
  state.todos[0].completed = true;

  changes = diffBuffer.flush();
  console.log('Changes:', JSON.stringify(changes, null, 2));
  console.log();

  console.log('3. Update stats');
  state.stats.completed = 1;
  state.stats.active = 2;

  changes = diffBuffer.flush();
  console.log('Changes:', JSON.stringify(changes, null, 2));
  console.log();

  console.log('4. Change filter');
  state.filter = 'active';

  changes = diffBuffer.flush();
  console.log('Changes:', JSON.stringify(changes, null, 2));
  console.log();

  console.log('5. Update todo text');
  state.todos[1].text = 'Build amazing app with LangDiff';

  changes = diffBuffer.flush();
  console.log('Changes:', JSON.stringify(changes, null, 2));
  console.log();

  console.log('Final state:');
  console.log(JSON.stringify(state, null, 2));
  console.log();

  // Demonstrate applying changes to another object
  console.log('--- Applying Changes to Remote Object ---\n');
  
  const remoteState: TodoApp = {
    todos: [
      { id: 1, text: 'Learn LangDiff', completed: false, priority: 'high' },
      { id: 2, text: 'Build awesome app', completed: false, priority: 'medium' }
    ],
    filter: 'all',
    stats: { total: 2, completed: 0, active: 2 }
  };

  console.log('Remote state before sync:');
  console.log(JSON.stringify(remoteState, null, 2));

  // Collect all the changes made
  const allChanges: Operation[] = [
    { op: 'add', path: '/todos/-', value: { id: 3, text: 'Write documentation', completed: false, priority: 'low' } },
    { op: 'replace', path: '/todos/0/completed', value: true },
    { op: 'replace', path: '/stats/completed', value: 1 },
    { op: 'replace', path: '/stats/active', value: 2 },
    { op: 'replace', path: '/filter', value: 'active' },
    { op: 'replace', path: '/todos/1/text', value: 'Build amazing app with LangDiff' }
  ];

  // Apply changes
  applyChange(remoteState, allChanges);

  console.log('\nRemote state after sync:');
  console.log(JSON.stringify(remoteState, null, 2));
  
  console.log('\n✅ States are now synchronized!');
}

// Helper function to demonstrate incremental changes
async function incrementalChangeExample() {
  console.log('\n--- Incremental Change Example ---\n');

  interface Counter {
    value: number;
    history: number[];
  }

  const [counter, diffBuffer] = trackChange<Counter>({
    value: 0,
    history: []
  });

  console.log('Incrementing counter and tracking changes:');

  for (let i = 1; i <= 5; i++) {
    counter.value = i;
    counter.history.push(i);

    const changes = diffBuffer.flush();
    console.log(`Step ${i}:`, JSON.stringify(changes, null, 2));
  }
}

// Run the examples if this file is executed directly
if (require.main === module) {
  Promise.resolve()
    .then(() => changeTrackingExample())
    .then(() => incrementalChangeExample())
    .catch(console.error);
}

export { changeTrackingExample, incrementalChangeExample };