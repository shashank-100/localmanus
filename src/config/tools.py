# Tool configuration
from pathlib import Path

TAVILY_MAX_RESULTS = 5

# Absolute so the path does not depend on the working directory, and created up
# front because browser_use writes its recording here without making the folder.
BROWSER_HISTORY_DIR = str(Path(__file__).resolve().parents[2] / "static" / "browser_history")
Path(BROWSER_HISTORY_DIR).mkdir(parents=True, exist_ok=True)
