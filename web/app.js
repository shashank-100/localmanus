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
const influenceSuggestion = $('#influence-suggestion');

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
  shell.classList.add('has-messages');
  const message = document.createElement('div');
  message.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  // Agent output is Markdown; user input stays literal text.
  if (role === 'assistant' && content) bubble.innerHTML = renderMarkdown(content);
  else bubble.textContent = content;
  message.appendChild(bubble);
  history.appendChild(message);
  history.scrollTop = history.scrollHeight;
  return bubble;
}

function createWorkflow(input) {
  shell.classList.remove('empty');
  shell.classList.add('has-messages');
  const card = document.createElement('section');
  card.className = 'workflow-card';
  card.innerHTML = '<aside class="flow-sidebar"><div class="flow-title">Flow</div><ol class="flow-steps"></ol></aside><main class="flow-detail"><div class="workflow-empty">The team is preparing the workflow...</div></main>';
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

// Swap the send glyph between an arrow (idle) and a stop square (running).
const SEND_ARROW = 'M8 13V3.5M8 3.5L4 7.5M8 3.5l4 4';
const SEND_STOP = 'M5 5h6v6H5z';
function setSendIcon(running) {
  const path = sendIcon.querySelector('path');
  path.setAttribute('d', running ? SEND_STOP : SEND_ARROW);
  path.setAttribute('fill', running ? 'currentColor' : 'none');
  sendButton.title = running ? 'Stop' : 'Send message';
  sendButton.setAttribute('aria-label', sendButton.title);
}

function showFinalReport(messages) {
  if (!messages || state.reportBubble) return;
  // The graph serializes every agent message with role "user" and no name, so
  // neither field identifies the reporter. Its report is the last message in
  // the finished workflow, which is what the user should see.
  const reversed = [...messages].reverse();
  const report = reversed.find((message) => message.content);
  if (report) state.reportBubble = addTextMessage('assistant', report.content);
}

function handleEvent(type, data) {
  switch (type) {
    case 'start_of_workflow':
      createWorkflow(data.input?.[0]?.content || '');
      break;
    case 'start_of_agent':
      // The coordinator's bubble is created lazily when text actually arrives,
      // so a silent handoff to the planner leaves no empty bubble behind.
      if (!state.workflow && data.agent_name === 'coordinator') {
        state.agentBubble = null;
        state.coordinatorSpeaking = true;
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
      if (!state.workflow && state.coordinatorSpeaking && data.delta?.content) {
        if (!state.agentBubble) state.agentBubble = addTextMessage('assistant');
        state.agentBubble.dataset.raw = (state.agentBubble.dataset.raw || '') + text;
        state.agentBubble.textContent = state.agentBubble.dataset.raw;
        return;
      }
      if (!state.currentTask) ensureTask('thinking');
      if (data.delta?.reasoning_content) state.currentTask.reason += text;
      else state.currentTask.text += text;
      renderWorkflow();
      break;
    }
    case 'end_of_llm':
      // The coordinator bubble streamed as plain text; format it once complete.
      if (state.agentBubble?.dataset.raw) {
        state.agentBubble.innerHTML = renderMarkdown(state.agentBubble.dataset.raw);
      }
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
    case 'end_of_workflow':
      showFinalReport(data.messages);
      break;
  }
}

function renderWorkflow() {
  const workflow = state.workflow;
  if (!workflow) return;
  const nav = workflow.nav;
  const detail = workflow.detail;
  const wasAtBottom = detail.scrollHeight - detail.scrollTop - detail.clientHeight < 40;
  nav.innerHTML = workflow.steps.filter((step) => step.agentName !== 'reporter').map((step) => `<li class="flow-step ${step === state.currentStep ? 'active' : ''}" data-step-id="${step.id}"><span class="flow-dot"></span><span>${escapeHtml(labels[step.agentName] || step.agentName)}</span></li>`).join('');
  nav.querySelectorAll('.flow-step').forEach((item) => item.addEventListener('click', () => document.getElementById(item.dataset.stepId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })));
  const visibleSteps = workflow.steps.filter((step) => step.agentName !== 'reporter');
  if (!visibleSteps.length) {
    detail.innerHTML = '<div class="workflow-empty">The team is preparing the workflow...</div>';
    return;
  }
  detail.innerHTML = visibleSteps.map((step, index) => `<section class="workflow-step" id="${step.id}"><h3>Step ${index + 1}: ${escapeHtml(labels[step.agentName] || step.agentName)}</h3>${step.tasks.filter((task) => task.type !== 'thinking' || task.text || task.reason).map(renderTask).join('')}</section>`).join('');
  // Only follow the stream while the user is already at the bottom, so
  // scrolling back to an earlier step is not undone by the next update.
  if (wasAtBottom) detail.scrollTop = detail.scrollHeight;
}

// Turn a tool result into a short human-readable line instead of raw JSON.
function summarizeToolOutput(output) {
  const text = String(output || '');
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    const results = Array.isArray(parsed) ? parsed : parsed?.results;
    if (Array.isArray(results)) {
      const sources = results
        .map((item) => item?.title || item?.url)
        .filter(Boolean)
        .slice(0, 5);
      if (sources.length) {
        return `<ul>${sources.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
      }
    }
    if (typeof parsed?.content === 'string') return renderMarkdown(parsed.content.slice(0, 800));
  } catch { /* Not JSON; fall through to plain text. */ }
  return renderMarkdown(text.slice(0, 800));
}

function renderTask(task) {
  if (task.type === 'tool') {
    const query = task.input?.query || task.input?.url || task.input?.instruction;
    const label =
      task.toolName === 'tavily_search' ? `Searched for "${query || ''}"`
      : task.toolName === 'crawl_tool' ? `Read ${query || 'a page'}`
      : task.toolName === 'browser' ? (query || 'Browsing')
      : task.toolName;
    const symbol = task.toolName === 'tavily_search' ? '?' : task.toolName === 'browser' ? '@' : '$';
    const output = task.output ? `<div class="tool-output">${summarizeToolOutput(task.output)}</div>` : '';
    return `<div class="task tool-task"><div class="task-label"><span class="task-symbol">${symbol}</span><span>${escapeHtml(label)}</span></div>${output}</div>`;
  }
  const reason = task.reason ? `<div class="task deep-reason"><strong>* Deep Thought</strong>${renderMarkdown(task.reason)}</div>` : '';
  return `<div class="task thinking">${reason}<div class="task-body">${renderPlanOrText(task.text || '')}</div></div>`;
}

// The planner emits a JSON plan; render it as a readable outline rather than
// dumping the raw object into the step body.
function renderPlanOrText(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.includes('"steps"')) {
    try {
      const plan = JSON.parse(trimmed);
      if (Array.isArray(plan.steps)) {
        const items = plan.steps
          .map((step) => `<li><strong>${escapeHtml(step.title || step.agent_name || '')}</strong>`
            + `<span class="plan-agent">${escapeHtml(step.agent_name || '')}</span>`
            + `${step.description ? `<p>${escapeHtml(step.description)}</p>` : ''}</li>`)
          .join('');
        return `${plan.thought ? `<p>${escapeHtml(plan.thought)}</p>` : ''}`
          + `${plan.title ? `<h4>${escapeHtml(plan.title)}</h4>` : ''}`
          + `<ol class="plan-steps">${items}</ol>`;
      }
    } catch { /* Plan still streaming in; show it as text below. */ }
    return '<p class="plan-pending">Drafting plan…</p>';
  }
  return renderMarkdown(text);
}

// Minimal Markdown renderer for agent prose: bold, italics, inline code,
// headings, and lists. Input is escaped first, so this never injects HTML.
function renderMarkdown(value) {
  const lines = escapeHtml(String(value || '')).split('\n');
  const html = [];
  let inList = false;
  const inline = (text) =>
    text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|\W)\*([^*\n]+)\*/g, '$1<em>$2</em>');
  let fence = null;
  for (const line of lines) {
    const fenceMark = line.match(/^\s*```(\w*)\s*$/);
    if (fenceMark) {
      if (fence === null) { fence = []; } // opening
      else { html.push(`<pre class="code-block">${fence.join('\n')}</pre>`); fence = null; }
      continue;
    }
    if (fence !== null) { fence.push(line); continue; }
    const item = line.match(/^\s*[-*]\s+(.*)$/);
    if (item) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inline(item[1])}</li>`);
      continue;
    }
    if (inList) { html.push('</ul>'); inList = false; }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) html.push(`<h4>${inline(heading[2])}</h4>`);
    else if (line.trim()) html.push(`<p>${inline(line)}</p>`);
  }
  if (inList) html.push('</ul>');
  // A fence still open means the block is mid-stream; render what we have.
  if (fence?.length) html.push(`<pre class="code-block">${fence.join('\n')}</pre>`);
  return html.join('');
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
  setSendIcon(true);
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
    setSendIcon(false);
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
influenceSuggestion.addEventListener('click', () => {
  promptInput.value = influenceSuggestion.textContent.trim();
  resizePrompt();
  promptInput.focus();
});

// Show which model is serving requests, reported by the server.
const modelBadge = $('#model-badge');
const modelName = $('#model-name');

fetch('/api/models')
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then((models) => {
    modelName.textContent = models.basic;
    modelBadge.title = `Basic: ${models.basic}\nReasoning: ${models.reasoning}`;
  })
  .catch(() => {
    modelName.textContent = 'model unavailable';
    modelBadge.classList.add('model-error');
    modelBadge.title = 'Could not reach /api/models';
  });

resizePrompt();
