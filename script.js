// Realistic Todo App Demo - UI Focused
class TodoAppDemo {
    constructor() {
        this.isRunning = false;
        this.timeouts = [];
        this.standardComplete = false;
        this.langdiffComplete = false;
        
        // Demo data
        this.todos = [
            "Fix login bug in dashboard",
            "Update API documentation", 
            "Review pull request #47",
            "Deploy to staging environment",
            "Send weekly team report"
        ];
        
        this.initializeElements();
        this.bindEvents();
        
        // Auto-start demo after a short delay
        setTimeout(() => {
            this.startDemo();
        }, 100);
    }
    
    initializeElements() {
        this.startButton = document.getElementById('start-demo');
        this.resetButton = document.getElementById('reset-demo');
        
        // Standard UI elements
        this.standardTodoList = document.getElementById('standard-todo-list');
        this.standardNetworkLog = document.getElementById('standard-network-log');
        
        // LangDiff UI elements
        this.langdiffTodoList = document.getElementById('langdiff-todo-list');
        this.langdiffPatchLog = document.getElementById('langdiff-patch-log');
    }
    
    bindEvents() {
        this.startButton.addEventListener('click', () => this.startDemo());
        this.resetButton.addEventListener('click', () => this.resetDemo());
    }
    
    startDemo() {
        if (this.isRunning) return;
        
        this.resetUI();
        this.isRunning = true;
        this.startButton.disabled = true;
        
        // Start both demos simultaneously
        this.simulateStandardApp();
        this.simulateLangDiffApp();
    }
    
    resetUI() {
        this.isRunning = false;
        this.startButton.disabled = false;
        this.standardComplete = false;
        this.langdiffComplete = false;
        
        // Clear timeouts
        this.timeouts.forEach(timeout => clearTimeout(timeout));
        this.timeouts = [];
        
        // Reset UI
        this.standardTodoList.innerHTML = '';
        this.langdiffTodoList.innerHTML = '';
        this.standardNetworkLog.innerHTML = '';
        this.langdiffPatchLog.innerHTML = '';
        
        // Keep details sections open
        const detailsElements = document.querySelectorAll('.tech-details');
        detailsElements.forEach(details => {
            details.setAttribute('open', '');
        });
    }
    
    resetDemo() {
        this.resetUI();
        
        // Auto-restart after reset
        setTimeout(() => {
            this.startDemo();
        }, 0);
    }
    
    simulateStandardApp() {
        // Build incomplete JSON progressively and attempt parsing
        const fullJson = JSON.stringify({todos: this.todos});
        const tokens = this.tokenizeJson(fullJson);
        let jsonBuffer = '';
        let tokenIndex = 0;
        
        const processNextToken = () => {
            if (!this.isRunning || tokenIndex >= tokens.length) {
                if (tokenIndex >= tokens.length) {
                    // Standard demo completed
                    this.standardComplete = true;
                    this.checkCompletion();
                }
                return;
            }
            
            // Add next token to buffer
            jsonBuffer += tokens[tokenIndex];
            
            // Log the SSE chunk
            this.logNetworkEvent(`SSE chunk: "${jsonBuffer}"`);
            
            // Attempt to parse the incomplete JSON
            this.tryParseAndRender(jsonBuffer);
            
            tokenIndex++;
            this.timeouts.push(setTimeout(processNextToken, 200));
        };
        
        this.timeouts.push(setTimeout(processNextToken, 1000));
    }
    
    tokenizeJson(jsonString) {
        // Split JSON into meaningful tokens
        const tokens = [];
        let current = '';
        let inString = false;
        let escaping = false;
        
        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString[i];
            
            if (escaping) {
                current += char;
                escaping = false;
                continue;
            }
            
            if (char === '\\' && inString) {
                current += char;
                escaping = true;
                continue;
            }
            
            if (char === '"') {
                current += char;
                if (inString) {
                    // End of string - push as token
                    tokens.push(current);
                    current = '';
                    inString = false;
                } else {
                    inString = true;
                }
                continue;
            }
            
            if (inString) {
                current += char;
                continue;
            }
            
            // Outside of string - handle structural characters
            if (['{', '}', '[', ']', ':', ','].includes(char)) {
                if (current.trim()) {
                    tokens.push(current);
                    current = '';
                }
                tokens.push(char);
            } else if (char.trim()) {
                current += char;
            }
        }
        
        if (current.trim()) {
            tokens.push(current);
        }
        
        return tokens;
    }
    
    tryParseAndRender(jsonBuffer) {
        try {
            const parsed = JSON.parse(jsonBuffer);
            if (parsed.todos && Array.isArray(parsed.todos)) {
                // Success - render the todos and clear any error
                this.renderStandardTodoList(parsed.todos);
                this.logNetworkEvent(`✅ JSON.parse success: ${parsed.todos.length} todos rendered`);
            }
        } catch (error) {
            // Parsing failed - show error in UI and log
            const errorMsg = error.message.length > 50 
                ? error.message.substring(0, 50) + '...' 
                : error.message;
            this.showParseError(errorMsg);
            this.logNetworkEvent(`❌ JSON.parse failed: ${errorMsg}`);
        }
    }
    
    showParseError(errorMessage) {
        // Show parse error in the todo list area
        this.standardTodoList.innerHTML = `
            <div class="parse-error">
                <div class="parse-error-title">❌ JSON Parse Error</div>
                <div>${errorMessage}</div>
            </div>
        `;
    }
    
    renderStandardTodoList(todos) {
        // Clear any existing error displays
        if (this.standardTodoList.querySelector('.parse-error')) {
            this.standardTodoList.innerHTML = '';
        }
        
        // Update existing items or add new ones
        const existingItems = this.standardTodoList.querySelectorAll('.todo-item');
        
        // Remove excess items if needed
        if (existingItems.length > todos.filter(t => t).length) {
            for (let i = todos.filter(t => t).length; i < existingItems.length; i++) {
                existingItems[i].remove();
            }
        }
        
        // Update/add items
        todos.forEach((todoText, index) => {
            if (todoText) {
                if (existingItems[index]) {
                    // Update existing item
                    existingItems[index].querySelector('.todo-text').textContent = todoText;
                } else {
                    // Add new item
                    const todoItem = this.createStandardTodoItem(todoText);
                    this.standardTodoList.appendChild(todoItem);
                    
                    // Make item appear
                    setTimeout(() => {
                        todoItem.classList.add('appear');
                    }, 5);
                }
            }
        });
    }
    
    simulateLangDiffApp() {
        let todoIndex = 0;
        
        const processNextTodo = () => {
            if (!this.isRunning || todoIndex >= this.todos.length) {
                if (todoIndex >= this.todos.length) {
                    // LangDiff demo completed
                    this.langdiffComplete = true;
                    this.checkCompletion();
                }
                return;
            }
            
            const todo = this.todos[todoIndex];
            
            // Create empty todo item first
            const todoItem = this.createLangDiffTodoItem('');
            this.langdiffTodoList.appendChild(todoItem);
            
            // Animate todo item appearance
            setTimeout(() => {
                todoItem.classList.add('appear');
            }, 50);
            
            // Log JSON Patch for creating todo
            this.logPatchEvent(`{"op": "add", "path": "/todos/-", "value": ""}`);
            
            // Stream the todo content
            this.streamTodoContent(todoItem, todo, todoIndex, () => {
                // Move to next todo
                todoIndex++;
                if (todoIndex >= this.todos.length) {
                    // All todos completed
                    this.langdiffComplete = true;
                    this.checkCompletion();
                } else {
                    this.timeouts.push(setTimeout(processNextTodo, 100));
                }
            });
        };
        
        this.timeouts.push(setTimeout(processNextTodo, 1000));
    }
    
    streamTodoContent(todoItem, todo, todoIndex, onComplete) {
        const words = todo.split(' ');
        let wordIndex = 0;
        
        const addNextToken = () => {
            if (!this.isRunning || wordIndex >= words.length) {
                if (wordIndex >= words.length) {
                    // Todo completed
                    todoItem.classList.remove('updating');
                    todoItem.classList.add('completed-item');
                    todoItem.querySelector('.todo-status').textContent = '✅';
                    
                    this.logPatchEvent(`{"op": "replace", "path": "/todos/${todoIndex}/status", "value": "completed"}`);
                    
                    if (onComplete) onComplete();
                }
                return;
            }
            
            const word = words[wordIndex];
            const textElement = todoItem.querySelector('.todo-text');
            
            // Add space if not first word
            if (wordIndex > 0) {
                const spaceSpan = document.createElement('span');
                spaceSpan.textContent = ' ';
                spaceSpan.className = 'token-highlight';
                textElement.appendChild(spaceSpan);
                
                // Remove highlight
                setTimeout(() => {
                    spaceSpan.classList.remove('token-highlight');
                }, 100);
                
                this.logPatchEvent(`{"op": "append", "path": "/todos/${todoIndex}", "value": " "}`);
            }
            
            // Add word with highlight
            const wordSpan = document.createElement('span');
            wordSpan.textContent = word;
            wordSpan.className = 'token-highlight';
            textElement.appendChild(wordSpan);
            
            // Remove highlight
            setTimeout(() => {
                wordSpan.classList.remove('token-highlight');
            }, 100);
            
            // Log patch event
            this.logPatchEvent(`{"op": "append", "path": "/todos/${todoIndex}", "value": "${word}"}`);
            
            todoItem.classList.add('updating');
            
            wordIndex++;
            this.timeouts.push(setTimeout(addNextToken, 100));
        };
        
        addNextToken();
    }
    
    createStandardTodoItem(text) {
        const item = document.createElement('div');
        item.className = 'todo-item';
        item.innerHTML = `
            <div class="todo-checkbox"></div>
            <div class="todo-text">${text}</div>
        `;
        return item;
    }
    
    createLangDiffTodoItem(text) {
        const item = document.createElement('div');
        item.className = 'todo-item';
        item.innerHTML = `
            <div class="todo-checkbox"></div>
            <div class="todo-text">${text}</div>
            <div class="todo-status">🔄</div>
        `;
        return item;
    }
    
    logNetworkEvent(message) {
        const entry = document.createElement('div');
        entry.className = 'log-entry sse-event';
        entry.textContent = message;
        this.standardNetworkLog.appendChild(entry);
        this.standardNetworkLog.scrollTop = this.standardNetworkLog.scrollHeight;
    }
    
    logPatchEvent(message) {
        const entry = document.createElement('div');
        entry.className = 'log-entry patch-event';
        entry.textContent = message;
        this.langdiffPatchLog.appendChild(entry);
        this.langdiffPatchLog.scrollTop = this.langdiffPatchLog.scrollHeight;
    }
    
    checkCompletion() {
        if (this.standardComplete && this.langdiffComplete) {
            // Both demos completed, auto-open "Behind the Scenes"
            setTimeout(() => {
                const detailsElements = document.querySelectorAll('.tech-details');
                detailsElements.forEach(details => {
                    details.setAttribute('open', '');
                });
            }, 1000); // Wait 1 second after completion
        }
    }
}

// Language toggle functionality
function toggleLanguage(lang) {
    const body = document.body;
    const enToggle = document.getElementById('lang-en');
    const cnToggle = document.getElementById('lang-cn');
    
    if (lang === 'zh' || lang === 'cn') {
        body.classList.add('lang-chinese');
        cnToggle.classList.add('active');
        enToggle.classList.remove('active');
        updateMetaTags('zh');
        updateUrlParameter('zh');
    } else {
        body.classList.remove('lang-chinese');
        enToggle.classList.add('active');
        cnToggle.classList.remove('active');
        updateMetaTags('en');
        updateUrlParameter('en');
    }
}

// Update URL parameter for language
function updateUrlParameter(lang) {
    const url = new URL(window.location);
    
    if (lang === 'zh') {
        url.searchParams.set('lang', 'zh');
    } else {
        url.searchParams.delete('lang');
    }
    
    window.history.pushState({}, '', url);
}

// Get URL parameter
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Update meta tags for SEO and social sharing
function updateMetaTags(lang) {
    const metaContent = {
        en: {
            title: 'LangDiff - Progressive UI from LLM',
            description: 'See the difference between standard JSON streaming and LangDiff. Progressive UI updates from LLM responses with structured streaming.',
            ogTitle: 'LangDiff - Progressive UI from LLM',
            ogDescription: 'See the difference between standard JSON streaming and LangDiff. Progressive UI updates from LLM responses with structured streaming.'
        },
        zh: {
            title: 'LangDiff - LLM 流式界面的新标准',
            description: '实现 LLM 响应的渐进式界面更新和结构化流式传输。',
            ogTitle: 'LangDiff - LLM 流式界面的新标准', 
            ogDescription: '实现 LLM 响应的渐进式界面更新和结构化流式传输。'
        }
    };
    
    const content = metaContent[lang] || metaContent.en;
    
    // Update page title and description
    document.getElementById('page-title').textContent = content.title;
    document.getElementById('page-description').setAttribute('content', content.description);
    
    // Update Open Graph tags
    document.getElementById('og-title').setAttribute('content', content.ogTitle);
    document.getElementById('og-description').setAttribute('content', content.ogDescription);
    
    // Update Twitter tags
    document.getElementById('twitter-title').setAttribute('content', content.ogTitle);
    document.getElementById('twitter-description').setAttribute('content', content.ogDescription);
    
    // Update HTML lang attribute
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
}

// Initialize demo when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check URL parameter for initial language
    const langParam = getUrlParameter('lang');
    const initialLang = langParam === 'zh' ? 'zh' : 'en';
    
    // Initialize language toggle with URL parameter or default to English
    toggleLanguage(initialLang);
    
    // Initialize demo
    new TodoAppDemo();
});
