from typing import Literal

# Define available LLM types
LLMType = Literal["basic", "reasoning", "vision"]

# Define agent-LLM mapping
AGENT_LLM_MAP: dict[str, LLMType] = {
    "coordinator": "basic",  # Conversation handling
    "planner": "reasoning",  # Planning benefits from the stronger model
    "supervisor": "basic",  # Routing decisions
    "researcher": "basic",  # Search and crawl tasks
    "coder": "basic",  # Code execution tasks
    "browser": "vision",  # Browser control needs the vision model
    "reporter": "basic",  # Final report writing
}
