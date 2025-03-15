from typing import Literal

# Define available LLM types
LLMType = Literal["basic", "reasoning", "vision"]

# Define agent-LLM mapping
AGENT_LLM_MAP: dict[str, LLMType] = {
    # "supervisor": "reasoning",     # Routing decisions
    "supervisor": "basic",  # Routing decisions
    "researcher": "basic",  # Search and crawl tasks
    "coder": "basic",  # Code execution tasks
    "file_manager": "basic",  # File operations
    "browser": "vision",  # Browser control needs the vision model
    "reporter": "basic",  # Final report writing
}
