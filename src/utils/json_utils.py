import logging
import json
import json_repair

logger = logging.getLogger(__name__)


def repair_json_output(content: str) -> str:
    """
    Repair and normalize JSON output.

    Args:
        content (str): String content that may contain JSON

    Returns:
        str: The repaired JSON string, or the original content if it is not JSON
    """
    content = content.strip()
    if content.startswith(("{", "[")) or "```json" in content:
        try:
            # Strip a ```json code fence if the model added one
            if content.startswith("```json"):
                content = content.removeprefix("```json")

            if content.endswith("```"):
                content = content.removesuffix("```")

            # Repair and parse the JSON
            repaired_content = json_repair.loads(content)
            return json.dumps(repaired_content)
        except Exception as e:
            logger.warning(f"JSON repair failed: {e}")
    return content
