# localmanus

localmanus is a community-driven AI automation framework that builds upon the incredible work of the open source community. Our goal is to combine language models with specialized tools for tasks like web search, crawling, and Python code execution, while giving back to the community that made this possible.

## Demo Video

> **Task**: Calculate the influence index of DeepSeek R1 on HuggingFace. This index can be designed by considering a weighted sum of factors such as followers, downloads, and likes.

[![Demo](./assets/demo.gif)](./assets/demo.mp4)

- [View on YouTube](https://youtu.be/sZCHqrQBUGk)
- [Download Video](https://github.com/shashank-100/localmanus/blob/main/assets/demo.mp4)

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Features](#features)
- [Why localmanus?](#why-localmanus)
- [Setup](#setup)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [Usage](#usage)
## Web UI
- [Development](#development)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/shashank-100/localmanus.git
cd localmanus

# Install dependencies, uv will take care of the python interpreter and venv creation
uv sync

# Playwright install to use Chromium for browser-use by default
uv run playwright install

# Configure environment
# Windows: copy .env.example .env 
cp .env.example .env
# Edit .env with your API keys

# Run the project
uv run main.py
```

## Architecture

localmanus implements a hierarchical multi-agent system where a supervisor coordinates specialized agents to accomplish complex tasks:

![localmanus Architecture](./assets/architecture.png)

The system consists of the following agents working together:

1. **Coordinator** - The entry point that handles initial interactions and routes tasks
2. **Planner** - Analyzes tasks and creates execution strategies
3. **Supervisor** - Oversees and manages the execution of other agents
4. **Researcher** - Gathers and analyzes information
5. **Coder** - Handles code generation and modifications
6. **Browser** - Performs web browsing and information retrieval
7. **Reporter** - Generates reports and summaries of the workflow results

## Features

### Core Capabilities

- 🤖 **LLM Integration**
  - Support for open source models like Qwen
  - OpenAI-compatible API interface
  - Multi-tier LLM system for different task complexities

### Tools and Integrations

- 🔍 **Search and Retrieval**
  - Web search via Tavily API
  - Neural search with Jina
  - Advanced content extraction

### Development Features

- 🐍 **Python Integration**
  - Built-in Python REPL
  - Code execution environment
  - Package management with uv

### Workflow Management

- 📊 **Visualization and Control**
  - Workflow graph visualization
  - Multi-agent orchestration
  - Task delegation and monitoring

## Why localmanus?

We believe in the power of open source collaboration. This project wouldn't be possible without the amazing work of projects like:

- [Qwen](https://github.com/QwenLM/Qwen) for their open source LLMs
- [Tavily](https://tavily.com/) for search capabilities
- [Jina](https://jina.ai/) for crawl search technology
- [Browser-use](https://pypi.org/project/browser-use/) for control browser
- And many other open source contributors

We're committed to giving back to the community and welcome contributions of all kinds - whether it's code, documentation, bug reports, or feature suggestions.

## Setup

### Prerequisites

- [uv](https://github.com/astral-sh/uv) package manager

### Installation

localmanus leverages [uv](https://github.com/astral-sh/uv) as its package manager to streamline dependency management.
Follow the steps below to set up a virtual environment and install the necessary dependencies:

```bash
# Step 1: Create and activate a virtual environment through uv
uv python install 3.12
uv venv --python 3.12

source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Step 2: Install project dependencies
uv sync
```

By completing these steps, you'll ensure your environment is properly configured and ready for development.

### Configuration

localmanus uses a three-tier LLM system with separate configurations for reasoning, basic tasks, and vision-language tasks. Create a `.env` file in the project root and configure the following environment variables:

```ini
# Reasoning LLM Configuration (for complex reasoning tasks)
REASONING_MODEL=your_reasoning_model
REASONING_API_KEY=your_reasoning_api_key
REASONING_BASE_URL=your_custom_base_url  # Optional

# Basic LLM Configuration (for simpler tasks)
BASIC_MODEL=your_basic_model
BASIC_API_KEY=your_basic_api_key
BASIC_BASE_URL=your_custom_base_url  # Optional

# Vision-Language LLM Configuration (for tasks involving images)
VL_MODEL=your_vl_model
VL_API_KEY=your_vl_api_key
VL_BASE_URL=your_custom_base_url  # Optional

# Tool API Keys
TAVILY_API_KEY=your_tavily_api_key
JINA_API_KEY=your_jina_api_key  # Optional

# Browser Configuration
CHROME_INSTANCE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome  # Optional, path to Chrome executable
CHROME_HEADLESS=False  # Optional, default is False
CHROME_PROXY_SERVER=http://127.0.0.1:10809  # Optional, default is None
CHROME_PROXY_USERNAME=  # Optional, default is None
CHROME_PROXY_PASSWORD=  # Optional, default is None
```

In addition to supporting LLMs compatible with OpenAI, localmanus also supports Azure LLMs. The configuration method is as follows:

```ini
# AZURE LLM Config
AZURE_API_BASE=https://xxxx
AZURE_API_KEY=xxxxx
AZURE_API_VERSION=2023-07-01-preview

# Reasoning LLM (for complex reasoning tasks)
REASONING_AZURE_DEPLOYMENT=xxx

# Non-reasoning LLM (for straightforward tasks)
BASIC_AZURE_DEPLOYMENT=gpt-4o-2024-08-06

# Vision-language LLM (for tasks requiring visual understanding)
VL_AZURE_DEPLOYMENT=gpt-4o-2024-08-06
```

> **Note:**
>
> - The system uses different models for different types of tasks:
>   - Reasoning LLM for complex decision-making and analysis
>   - Basic LLM for simpler text-based tasks
>   - Vision-Language LLM for tasks involving image understanding
> - You can customize the base URLs for all LLMs independently, and you can use LiteLLM's board LLM support by following [this guide](https://docs.litellm.ai/docs/providers).
> - Each LLM can use different API keys if needed
> - Jina API key is optional. Provide your own key to access a higher rate limit (get your API key at [jina.ai](https://jina.ai/))
> - Tavily search is configured to return a maximum of 5 results by default (get your API key at [app.tavily.com](https://app.tavily.com/))

You can copy the `.env.example` file as a template to get started:

```bash
cp .env.example .env
```

### Configure Pre-commit Hook

localmanus includes a pre-commit hook that runs linting and formatting checks before each commit. To set it up:

1. Make the pre-commit script executable:

```bash
chmod +x pre-commit
```

2. Install the pre-commit hook:

```bash
ln -s ../../pre-commit .git/hooks/pre-commit
```

The pre-commit hook will automatically:

- Run linting checks (`make lint`)
- Run code formatting (`make format`)
- Add any reformatted files back to staging
- Prevent commits if there are any linting or formatting errors

## Usage

### Basic Execution

To run localmanus with default settings:

```bash
uv run main.py
```

### API Server

localmanus provides a FastAPI-based API server with streaming support:

```bash
# Start the API server
make serve

# Or run directly
uv run server.py
```

The API server exposes the following endpoints:

- `POST /api/chat/stream`: Chat endpoint for LangGraph invoke with streaming support
  - Request body:
  ```json
  {
    "messages": [{ "role": "user", "content": "Your query here" }],
    "debug": false
  }
  ```
  - Returns a Server-Sent Events (SSE) stream with the agent's responses

### Advanced Configuration

localmanus can be customized through various configuration files in the `src/config` directory:

- `env.py`: Configure LLM models, API keys, and base URLs
- `tools.py`: Adjust tool-specific settings (e.g., Tavily search results limit)
- `agents.py`: Modify team composition and agent system prompts

### Agent Prompts System

localmanus uses a sophisticated prompting system in the `src/prompts` directory to define agent behaviors and responsibilities:

#### Core Agent Roles

- **Supervisor ([`src/prompts/supervisor.md`](src/prompts/supervisor.md))**: Coordinates the team and delegates tasks by analyzing requests and determining which specialist should handle them. Makes decisions about task completion and workflow transitions.

- **Researcher ([`src/prompts/researcher.md`](src/prompts/researcher.md))**: Specializes in information gathering through web searches and data collection. Uses Tavily search and web crawling capabilities while avoiding mathematical computations or file operations.

- **Coder ([`src/prompts/coder.md`](src/prompts/coder.md))**: Professional software engineer role focused on Python and bash scripting. Handles:

  - Python code execution and analysis
  - Shell command execution
  - Technical problem-solving and implementation

- **File Manager ([`src/prompts/file_manager.md`](src/prompts/file_manager.md))**: Handles all file system operations with a focus on properly formatting and saving content in markdown format.

- **Browser ([`src/prompts/browser.md`](src/prompts/browser.md))**: Web interaction specialist that handles:
  - Website navigation
  - Page interaction (clicking, typing, scrolling)
  - Content extraction from web pages

#### Prompt System Architecture

The prompts system uses a template engine ([`src/prompts/template.py`](src/prompts/template.py)) that:

- Loads role-specific markdown templates
- Handles variable substitution (e.g., current time, team member information)
- Formats system prompts for each agent

Each agent's prompt is defined in a separate markdown file, making it easy to modify behavior and responsibilities without changing the underlying code.

## Web UI

localmanus serves a built-in web UI from the same FastAPI process. Start the server and open:

```text
http://127.0.0.1:8000/
```

The UI streams agent messages, tool activity, and workflow state from `POST /api/chat/stream`. API documentation remains available at `/docs`.

## Development

### Testing

Run the test suite:

```bash
# Run all tests
make test

# Run specific test file
pytest tests/integration/test_workflow.py

# Run with coverage
make coverage
```
