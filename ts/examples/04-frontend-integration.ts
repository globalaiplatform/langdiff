/**
 * Frontend Integration Example
 * 
 * This example demonstrates how to integrate LangDiff with frontend frameworks
 * using Server-Sent Events (SSE) and WebSocket patterns.
 */

import {
  trackChange,
  applyChange,
  Operation,
} from '../src';
import * as ld from '../src';

// Define a chat message structure
const ChatMessage = ld.object({
  role: ld.string(),
  content: ld.string(),
  timestamp: ld.number(),
});

// Define a chat conversation structure
const ChatConversation = ld.object({
  messages: ld.array(ChatMessage),
  status: ld.string()
});

interface UIMessage {
  role: string;
  content: string;
  timestamp: number;
  isComplete: boolean;
  isStreaming: boolean;
}

interface ChatUI {
  messages: UIMessage[];
  status: string;
  isConnected: boolean;
}

// Simulate Server-Sent Events
class MockSSEConnection {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  emit(event: string, data: any) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }

  close() {
    this.listeners.clear();
  }
}

async function frontendIntegrationExample() {
  console.log('🌐 Frontend Integration Example\n');

  // Initialize UI state
  const initialState: ChatUI = {
    messages: [],
    status: 'connecting',
    isConnected: false,
  };

  const [ui, diffBuffer] = trackChange<ChatUI>(initialState);

  // Simulate SSE connection
  const sse = new MockSSEConnection();

  // Set up SSE event handlers
  sse.on('connected', () => {
    console.log('✅ Connected to server');
    ui.status = 'connected';
    ui.isConnected = true;
    logUIChanges(diffBuffer.flush());
  });

  sse.on('update', (data: { changes: Operation[] }) => {
    console.log('📨 Received update from server');
    applyChange(ui, data.changes);
    console.log('Applied changes:', JSON.stringify(data.changes, null, 2));
  });

  sse.on('message_start', (data: { messageIndex: number }) => {
    console.log(`💬 New message started: #${data.messageIndex}`);
    ui.messages.push({
      role: '',
      content: '',
      timestamp: Date.now(),
      isComplete: false,
      isStreaming: true,
    });
    logUIChanges(diffBuffer.flush());
  });

  sse.on('chunk', (data: { changes: Operation[] }) => {
    applyChange(ui, data.changes);
    console.log('📝 Content chunk received');
    logCurrentMessage(ui);
  });

  sse.on('message_complete', (data: { messageIndex: number }) => {
    console.log(`✅ Message #${data.messageIndex} completed`);
    if (ui.messages[data.messageIndex]) {
      ui.messages[data.messageIndex].isComplete = true;
      ui.messages[data.messageIndex].isStreaming = false;
    }
    logUIChanges(diffBuffer.flush());
  });

  sse.on('disconnected', () => {
    console.log('❌ Disconnected from server');
    ui.status = 'disconnected';
    ui.isConnected = false;
    logUIChanges(diffBuffer.flush());
  });

  // Simulate server interactions
  await simulateServerInteraction(sse);

  console.log('\n🏁 Final UI state:');
  console.log(JSON.stringify(ui, null, 2));

  // Cleanup
  sse.close();
}

async function simulateServerInteraction(sse: MockSSEConnection) {
  console.log('🔄 Simulating server interaction...\n');

  // Connect
  sse.emit('connected', {});
  await delay(500);

  // Simulate streaming a user message
  sse.emit('message_start', { messageIndex: 0 });
  await delay(200);

  const userMessageChanges = [
    { op: 'replace', path: '/messages/0/role', value: 'user' },
    { op: 'append', path: '/messages/0/content', value: 'Hello,' },
  ];
  sse.emit('chunk', { changes: userMessageChanges });
  await delay(200);

  const userMessageChanges2 = [
    { op: 'append', path: '/messages/0/content', value: ' how can you help me?' },
  ];
  sse.emit('chunk', { changes: userMessageChanges2 });
  await delay(200);

  sse.emit('message_complete', { messageIndex: 0 });
  await delay(500);

  // Simulate streaming an assistant response
  sse.emit('message_start', { messageIndex: 1 });
  await delay(200);

  const assistantMessageChanges = [
    { op: 'replace', path: '/messages/1/role', value: 'assistant' },
    { op: 'append', path: '/messages/1/content', value: 'I can help you with' },
  ];
  sse.emit('chunk', { changes: assistantMessageChanges });
  await delay(300);

  const assistantMessageChanges2 = [
    { op: 'append', path: '/messages/1/content', value: ' many things! I can answer questions,' },
  ];
  sse.emit('chunk', { changes: assistantMessageChanges2 });
  await delay(300);

  const assistantMessageChanges3 = [
    { op: 'append', path: '/messages/1/content', value: ' help with coding, and provide explanations.' },
  ];
  sse.emit('chunk', { changes: assistantMessageChanges3 });
  await delay(200);

  sse.emit('message_complete', { messageIndex: 1 });
  await delay(500);
}

// React-like component example (pseudo-code)
function ReactComponentExample() {
  console.log('\n⚛️  React Integration Example (Pseudo-code)\n');
  
  const reactExample = `
import React, { useState, useEffect } from 'react';
import { trackChange, applyChange } from 'langdiff';

function ChatComponent() {
  const [chatState, setChatState] = useState({
    messages: [],
    status: 'disconnected',
  });

  useEffect(() => {
    // Track changes for efficient updates
    const [state, diffBuffer] = trackChange(chatState);
    
    // Set up SSE connection
    const eventSource = new EventSource('/api/chat/stream');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.changes) {
        // Apply incremental changes instead of replacing entire state
        applyChange(state, data.changes);
        setChatState({ ...state });
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div>
      <div className="status">Status: {chatState.status}</div>
      <div className="messages">
        {chatState.messages.map((message, index) => (
          <div key={index} className={\`message message-\${message.role}\`}>
            <div className="role">{message.role}</div>
            <div className="content">
              {message.content}
              {message.isStreaming && <span className="cursor">|</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
`;

  console.log(reactExample);
}

// Vue-like component example (pseudo-code)
function VueComponentExample() {
  console.log('\n🖖 Vue Integration Example (Pseudo-code)\n');
  
  const vueExample = `
<template>
  <div>
    <div class="status">Status: {{ chatState.status }}</div>
    <div class="messages">
      <div 
        v-for="(message, index) in chatState.messages" 
        :key="index"
        :class="\`message message-\${message.role}\`"
      >
        <div class="role">{{ message.role }}</div>
        <div class="content">
          {{ message.content }}
          <span v-if="message.isStreaming" class="cursor">|</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { trackChange, applyChange } from 'langdiff';

export default {
  data() {
    return {
      chatState: {
        messages: [],
        status: 'disconnected',
      },
    };
  },
  
  mounted() {
    const [state, diffBuffer] = trackChange(this.chatState);
    
    const eventSource = new EventSource('/api/chat/stream');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.changes) {
        applyChange(state, data.changes);
        this.chatState = { ...state };
      }
    };
    
    this.$once('hook:beforeDestroy', () => {
      eventSource.close();
    });
  },
};
</script>
`;

  console.log(vueExample);
}

function logUIChanges(changes: Operation[]) {
  if (changes.length > 0) {
    console.log('🔄 UI Changes:', JSON.stringify(changes, null, 2));
  }
}

function logCurrentMessage(ui: ChatUI) {
  const lastMessage = ui.messages[ui.messages.length - 1];
  if (lastMessage) {
    console.log(`   Current: [${lastMessage.role}] "${lastMessage.content}"`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the example if this file is executed directly
if (require.main === module) {
  Promise.resolve()
    .then(() => frontendIntegrationExample())
    .then(() => ReactComponentExample())
    .then(() => VueComponentExample())
    .catch(console.error);
}

export { frontendIntegrationExample };