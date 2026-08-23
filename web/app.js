const state = {
  messages: [],
  running: false,
  workflow: null,
  currentStep: null,
  currentTask: null,
  pendingTools: new Map(),
  assistantNode: null,
  agentBubble: null,
};

const $ = (selector) => document.querySelector(selector);
const shell = $('#app-shell');
const history = $('#message-history');
const promptInput = $('#prompt');
const composer = $('#composer');
const sendButton = $('#send-button');
const sendIcon = $('#send-icon');
const deepThink = $('#deep-think');
const searchFirst = $('#search-first');

const labels = {
  coordinator: 'Coordinator',
  planner: 'Planning',
  supervisor: 'Thinking',
  researcher: 'Researching',
  coder: 'Coding',
  browser: 'Browsing Web',
  file_manager: 'File Management',
  reporter: 'Report',
};

function resizePrompt() {
  promptInput.style.height = 'auto';
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 180)}px`;
}

function addTextMessage(role, content = '') {
  shell.classList.remove('empty');
  const message = document.createElement('div');
  message.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = content;
  message.appendChild(bubble);
  history.appendChild(message);
  history.scrollTop = history.scrollHeight;
  return bubble;
}

function createWorkflow(input) {
  shell.classList.remove('empty');
  const card = document.createElement('section');
  card.className = 'workflow-card';
  card.innerHTML = '<aside class="flow-sidebar"><div class="flow-title">Flow</div><ol class="flow-steps"></ol></aside><main class="flow-detail"><div class="workflow-empty">The team is preparing the workflow…</div></main>';
  history.appendChild(card);
  state.workflow = { card, input, steps: [], detail: card.querySelector('.flow-detail'), nav: card.querySelector('.flow-steps') };
  return state.workflow;
}

function ensureStep(agentName, agentId) {
  if (!state.workflow) return null;
  const step = { agentName, agentId, tasks: [], id: `step-${agentId}` };
  state.workflow.steps.push(step);
  state.currentStep = step;
  renderWorkflow();
  return step;
}

function ensureTask(type = 'thinking') {
  if (!state.currentStep) return null;
  const task = { type, text: '', reason: '', toolName: '', input: null, output: '', pending: true };
  state.currentStep.tasks.push(task);
  state.currentTask = task;
  renderWorkflow();
  return task;
}

function eventText(data) {
  if (data?.delta?.content) return data.delta.content;
  if (data?.delta?.reasoning_content) return data.delta.reasoning_content;
  return '';
}

function handleEvent(type, data) {
  switch (type) {
    case 'start_of_workflow':
      createWorkflow(data.input?.[0]?.content || '');
      break;
    case 'start_of_agent':
      if (!state.workflow && data.agent_name === 'coordinator') {
        state.agentBubble = addTextMessage('assistant');
      }
      ensureStep(data.agent_name, data.agent_id);
      break;
    case 'end_of_agent':
      state.currentStep = null;
      state.currentTask = null;
      renderWorkflow();
      break;
    case 'start_of_llm':
      ensureTask('thinking');
      break;
    case 'message': {
      const text = eventText(data);
      if (!state.workflow && state.agentBubble && data.delta?.content) {
        state.agentBubble.textContent += text;
        return;
      }
      if (!state.currentTask) ensureTask('thinking');
      if (data.delta?.reasoning_content) state.currentTask.reason += text;
      else state.currentTask.text += text;
      renderWorkflow();
      break;
    }
    case 'end_of_llm':
      if (state.currentTask) state.currentTask.pending = false;
      renderWorkflow();
      break;
    case 'tool_call': {
      const task = ensureTask('tool');
      task.toolName = data.tool_name;
      task.input = data.tool_input;
      task.toolId = data.tool_call_id;
      state.pendingTools.set(data.tool_call_id, task);
      state.currentTask = null;
      renderWorkflow();
      break;
    }
    case 'tool_call_result': {
      const task = state.pendingTools.get(data.tool_call_id);
      if (task) {
        task.output = data.tool_result || '';
        task.pending = false;
        state.pendingTools.delete(data.tool_call_id);
      }
      renderWorkflow();
      break;
    }
    case 'final_session_state':
      if (data.messages) {
        const last = [...data.messages].reverse().find((message) => message.role !== 'user' && message.content);
        if (last && !state.reportBubble) state.reportBubble = addTextMessage('assistant', last.content);
      }
      break;
    case 'end_of_workflow':
      if (data.messages) {
        const last = [...data.messages].reverse().find((message) => message.role !== 'user' && message.content);
        if (last && !state.reportBubble) state.reportBubble = addTextMessage('assistant', last.content);
      }
      break;
  }
}

function renderWorkflow() {
  const workflow = state.workflow;
  if (!workflow) return;
  const nav = workflow.nav;
  const detail = workflow.detail;
  nav.innerHTML = workflow.steps.filter((step) => step.agentName !== 'reporter').map((step) => `<li class="flow-step ${step === state.currentStep ? 'active' : ''}" data-step-id="${step.id}"><span class="flow-dot"></span><span>${escapeHtml(labels[step.agentName] || step.agentName)}</span></li>`).join('');
  nav.querySelectorAll('.flow-step').forEach((item) => item.addEventListener('click', () => document.getElementById(item.dataset.stepId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })));
  const visibleSteps = workflow.steps.filter((step) => step.agentName !== 'reporter');
  if (!visibleSteps.length) {
    detail.innerHTML = '<div class="workflow-empty">The team is preparing the workflow…</div>';
    return;
  }
  detail.innerHTML = visibleSteps.map((step, index) => `<section class="workflow-step" id="${step.id}"><h3>📍 Step ${index + 1}: ${escapeHtml(labels[step.agentName] || step.agentName)}</h3>${step.tasks.filter((task) => task.type !== 'thinking' || task.text || task.reason).map(renderTask).join('')}</section>`).join('');
  detail.scrollTop = detail.scrollHeight;
}

function renderTask(task) {
  if (task.type === 'tool') {
    const input = typeof task.input === 'string' ? task.input : JSON.stringify(task.input || {}, null, 2);
    const title = task.toolName === 'tavily_search' ? `Searching for "${task.input?.query || input}"` : task.toolName === 'browser' ? (task.input?.instruction || input) : task.toolName;
    return `<div class="task tool-task"><div class="task-label"><span class="task-symbol">${task.toolName === 'tavily_search' ? '⌕' : task.toolName === 'browser' ? '◎' : '</>'}</span><span>${escapeHtml(title)}</span></div><pre class="tool-detail">${escapeHtml(input)}${task.output ? `\n\n${escapeHtml(String(task.output).slice(0, 1200))}` : ''}</pre></div>`;
  }
  const text = task.text || '';
  const reason = task.reason ? `<div class="task deep-reason"><strong>✦ Deep Thought</strong><p>${escapeHtml(task.reason)}</p></div>` : '';
  return `<div class="task thinking">${reason}<div class="task-label"><span class="task-symbol">${task.pending ? '◌' : '·'}</span><span>${escapeHtml(text)}</span></div></div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function parseSse(buffer) {
  const chunks = buffer.split('\n\n');
  const remainder = chunks.pop();
  chunks.forEach((chunk) => {
    const type = chunk.match(/^event:\s*(.+)$/m)?.[1];
    const raw = chunk.match(/^data:\s*(.+)$/m)?.[1];
    if (type && raw) {
      try { handleEvent(type, JSON.parse(raw)); } catch { /* Ignore incomplete stream chunks. */ }
    }
  });
  return remainder;
}

async function runTask(query) {
  state.running = true;
  state.reportBubble = null;
  state.agentBubble = null;
  state.workflow = null;
  state.currentStep = null;
  state.currentTask = null;
  state.pendingTools.clear();
  state.messages.push({ role: 'user', content: query });
  addTextMessage('user', query);
  sendButton.classList.add('running');
  sendIcon.textContent = '■';
  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ messages: state.messages, debug: false, deep_thinking_mode: deepThink.getAttribute('aria-pressed') === 'true', search_before_planning: searchFirst.getAttribute('aria-pressed') === 'true' }),
    });
    if (!response.ok || !response.body) throw new Error(`API returned ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      buffer = parseSse(buffer);
      if (done) break;
    }
  } catch (error) {
    addTextMessage('assistant', `Unable to connect to LocalManus: ${error.message}`);
  } finally {
    state.running = false;
    sendButton.classList.remove('running');
    sendIcon.textContent = '↑';
  }
}

composer.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = promptInput.value.trim();
  if (!query || state.running) return;
  promptInput.value = '';
  resizePrompt();
  runTask(query);
});
promptInput.addEventListener('input', resizePrompt);
promptInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});
[deepThink, searchFirst].forEach((button) => button.addEventListener('click', () => {
  const next = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(next));
}));
resizePrompt();
