import logging
import os

from langchain_core.tools import StructuredTool
from langchain_community.tools.tavily_search import TavilySearchResults

from src.config import TAVILY_MAX_RESULTS
from .decorators import create_logged_tool

logger = logging.getLogger(__name__)


def _local_search_unavailable(query: str) -> list[dict[str, str]]:
    """Return a useful tool error instead of failing application startup."""
    return [
        {
            "title": "Web search unavailable",
            "content": (
                "Tavily search is disabled because TAVILY_API_KEY is not configured. "
                f"Continue without web search for this request: {query}"
            ),
        }
    ]


if os.getenv("TAVILY_API_KEY"):
    LoggedTavilySearch = create_logged_tool(TavilySearchResults)
    tavily_tool = LoggedTavilySearch(
        name="tavily_search", max_results=TAVILY_MAX_RESULTS
    )
else:
    tavily_tool = StructuredTool.from_function(
        func=_local_search_unavailable,
        name="tavily_search",
        description="Use as a local fallback when web search credentials are unavailable.",
    )
    logger.warning("TAVILY_API_KEY is not configured; using local search fallback")
