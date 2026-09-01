# localmanus

A multi-agent research assistant. You ask a question; a team of agents plans the
work, searches the web, runs code, drives a browser when needed, and writes the
answer. Built on [LangGraph](https://github.com/langchain-ai/langgraph) and
FastAPI, with a dependency-free web UI.

**Live:** https://localmanus-production.up.railway.app

## Demo

> **Task**: Calculate the influence index of DeepSeek R1 on HuggingFace, as a
> weighted sum of followers, downloads, and likes.

[![Demo](./assets/demo.gif)](./assets/demo.mp4)

- [View on YouTube](https://youtu.be/sZCHqrQBUGk)
- [Download Video](https://github.com/shashank-100/localmanus/blob/main/assets/demo.mp4)

## Contents

- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Layout](#project-layout)
- [Deployment](#deployment)
- [Development](#development)

## Quick Start

Requires [uv](https://github.com/astral-sh/uv). It installs Python for you.

```bash
git clone https://github.com/shashank-100/localmanus.git
cd localmanus

uv sync                              # installs Python 3.13 and dependencies
uv run python -m playwright install chromium   # only needed for browser tasks

cp .env.example .env                 # Windows: copy .env.example .env
# edit .env and add your API keys

make serve                           # then open http://localhost:8000
```

## How It Works

![localmanus architecture](./assets/architecture.png)

Seven agents pass work between them. A **supervisor** sits at the centre and
decides who runs next after every step.

```
START → coordinator ──→ END              small talk stops here
             ↓
          planner                        writes a step-by-step plan
             ↓
    ┌─── supervisor ───→ END             decides the next worker, or finishes
    │      ↑    ↓
    │   researcher   searches and reads pages
    │   coder        runs Python and shell commands
    │   browser      drives a real Chromium browser
    └── reporter     writes the final answer
```

| Agent | Role | Tools |
| --- | --- | --- |
| `coordinator` | Decides whether a message is a real task or small talk | — |
| `planner` | Breaks the task into steps and assigns each to an agent | — |
| `supervisor` | Dispatches one worker at a time, then finishes | — |
| `researcher` | Web search and page reading | Tavily, crawler |
| `coder` | Calculations and scripts | Python REPL, bash |
| `browser` | Page interaction that needs a real browser | browser-use |
| `reporter` | Writes the answer the user sees | — |

Workers always return to the supervisor rather than calling each other, so the
route through the graph is decided at runtime rather than hard-coded.

To print the graph as a Mermaid diagram:

```bash
uv run python -m src.workflow
```

## Prompts

Each agent's behaviour lives in a Markdown file under `src/prompts/`. Editing
`supervisor.md` changes routing; editing `planner.md` changes how work is broken
down. No code change required.

- **[`coordinator.md`](src/prompts/coordinator.md)** — Decides whether a message
  is a real task or ordinary conversation. Emits `handoff_to_planner` to start
  the workflow; anything else ends the run without one.

- **[`planner.md`](src/prompts/planner.md)** — Breaks the request into steps and
  assigns each to an agent. Must return a single raw JSON object; the caller
  parses it into the plan the supervisor follows.

- **[`supervisor.md`](src/prompts/supervisor.md)** — Coordinates the team,
  choosing which specialist runs next and when the task is complete. Replies with
  only `{"next": "worker_name"}` or `{"next": "FINISH"}`.

- **[`researcher.md`](src/prompts/researcher.md)** — Gathers information through
  web search and page reading. Explicitly cannot do mathematics or file
  operations, so the supervisor routes those elsewhere.

- **[`coder.md`](src/prompts/coder.md)** — Python and shell work: executing code,
  running calculations, and technical problem-solving.

- **[`browser.md`](src/prompts/browser.md)** — Navigating sites, interacting with
  pages (clicking, typing, scrolling), and extracting content that a plain fetch
  cannot reach.

- **[`reporter.md`](src/prompts/reporter.md)** — Turns the collected results into
  the final answer shown to the user.

### How prompts are rendered

[`src/prompts/template.py`](src/prompts/template.py) loads the Markdown file,
substitutes variables written as `<<VAR>>` (such as `<<CURRENT_TIME>>` and
`<<TEAM_MEMBERS>>`), and prepends the result as the system message.

Braces are escaped before substitution, which is why prompts use `<<VAR>>`
rather than `{VAR}`: the files contain JSON examples that would otherwise be
read as template placeholders.

## Configuration

Copy `.env.example` to `.env` and fill in the keys. Three model slots are used:

```bash
# Complex reasoning: planning
REASONING_MODEL=openai/gpt-5.5
REASONING_BASE_URL=https://your-endpoint/v1
REASONING_API_KEY=sk-...

# Everyday work: coordination, routing, research, code, reports
BASIC_MODEL=openai/gpt-5.4-mini
BASIC_BASE_URL=https://your-endpoint/v1
BASIC_API_KEY=sk-...

# Browser control; use an image-capable model if you have one
VL_MODEL=openai/gpt-5.5
VL_BASE_URL=https://your-endpoint/v1
VL_API_KEY=sk-...

# Web search. Optional, but research is much weaker without it.
TAVILY_API_KEY=tvly-...
JINA_API_KEY=            # optional, raises the page-reading rate limit

CHROME_HEADLESS=True
```

**The `openai/` prefix matters.** `src/llms/llm.py` routes on whether the model
name contains a `/`. With it, requests go through LiteLLM and honour your
`*_BASE_URL`. Without it, the reasoning slot falls back to a hardcoded DeepSeek
client and ignores the base URL entirely.

Any OpenAI-compatible endpoint works. Azure is supported through the
`AZURE_*` settings in `.env.example`.

Which agent uses which slot is set in `src/config/agents.py`.

## Usage

### Web UI

```bash
make serve      # http://localhost:8000
```

The composer has two toggles. **Deep Think** plans with the reasoning model
instead of the basic one; **Search** runs a web search before planning so the
plan is grounded in current results.

### Command line

```bash
uv run main.py "What is the current population of Tokyo?"
uv run main.py                    # prompts for a query
```

Runs the same graph without the server, and prints the full message history.
Both toggles are always on in this mode.

### API Server

A FastAPI server with streaming support. It serves both the API and the web UI.

```bash
make serve

# or directly
uv run server.py
```

It listens on `$PORT`, defaulting to 8000.

```
POST /api/chat/stream
```

```json
{
  "messages": [{ "role": "user", "content": "Your query here" }],
  "debug": false,
  "deep_thinking_mode": false,
  "search_before_planning": false
}
```

Returns a Server-Sent Events stream. Events: `start_of_workflow`,
`start_of_agent`, `start_of_llm`, `message`, `tool_call`, `tool_call_result`,
`end_of_agent`, `end_of_llm`, `end_of_workflow`, `final_session_state`.

Also available:

- `GET /api/models` — the model names currently configured
- `GET /api/browser_history/{filename}` — a browser session recording

## Project Layout

```
server.py                     starts the web server
main.py                       command-line entry point

src/graph/
  builder.py                  registers the seven nodes
  nodes.py                    all seven agents and their routing
  types.py                    the shared State passed between nodes
src/agents/agents.py          the three tool-using agents
src/prompts/*.md              each agent's instructions
src/llms/llm.py               model clients, one per slot
src/tools/                    search, crawl, python, bash, browser
src/crawler/                  fetch a page and convert it to Markdown
src/service/workflow_service.py   turns graph events into an SSE stream
src/api/app.py                HTTP routes
web/                          the UI: one HTML, one CSS, one JS file
```

## Deployment

The `Dockerfile` builds on Microsoft's Playwright image so Chromium is available
for the browser agent, and `railway.json` tells Railway to use it rather than
autodetecting a Python buildpack.

```bash
railway up
```

Set the same variables from `.env` as Railway environment variables. `.env`
itself is never copied into the image.

Serverless platforms are not suitable: workflows run for minutes and hold an
open SSE connection, and the browser agent needs a real Chromium install.

## Development

```bash
make install-dev    # dev and test dependencies
make format         # black
make lint           # black --check
make test           # pytest
make coverage       # pytest with coverage
```

### Adding an agent

1. Write its prompt in `src/prompts/<name>.md`.
2. Add a node function in `src/graph/nodes.py`.
3. Register it in `src/graph/builder.py`.
4. Add it to `TEAM_MEMBERS` in `src/config/__init__.py` so the supervisor can
   route to it.
5. Give it a model slot in `src/config/agents.py`.

### Pre-commit hook

```bash
chmod +x pre-commit
ln -s ../../pre-commit .git/hooks/pre-commit
```

Formats staged Python files and blocks the commit if linting fails.

## License

MIT. See [LICENSE](LICENSE).
