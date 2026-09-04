import asyncio
import json
from pydantic import BaseModel, Field
from typing import Optional, ClassVar, Type
from langchain_core.tools import BaseTool
from browser_use import AgentHistoryList, BrowserProfile
from browser_use import Agent as BrowserAgent
from browser_use.llm.litellm.chat import ChatLiteLLM as BrowserChatLiteLLM
from src.config import VL_MODEL, VL_BASE_URL, VL_API_KEY
from src.llms.llm import _rejects_temperature
from src.tools.decorators import create_logged_tool
from src.config import (
    CHROME_INSTANCE_PATH,
    CHROME_HEADLESS,
    CHROME_PROXY_SERVER,
    CHROME_PROXY_USERNAME,
    CHROME_PROXY_PASSWORD,
    BROWSER_HISTORY_DIR,
)
import uuid

profile_kwargs = {"headless": CHROME_HEADLESS}
if CHROME_INSTANCE_PATH:
    profile_kwargs["executable_path"] = CHROME_INSTANCE_PATH
if CHROME_PROXY_SERVER:
    proxy_config = {"server": CHROME_PROXY_SERVER}
    if CHROME_PROXY_USERNAME:
        proxy_config["username"] = CHROME_PROXY_USERNAME
    if CHROME_PROXY_PASSWORD:
        proxy_config["password"] = CHROME_PROXY_PASSWORD
    profile_kwargs["proxy"] = proxy_config

browser_profile = BrowserProfile(**profile_kwargs)

# browser-use 0.13 dropped LangChain support and requires its own LLM client,
# so the browser agent builds one from the same vision-model settings. Its
# ChatLiteLLM defaults temperature to 0.0, which reasoning models reject, so
# pass None for those to send no temperature at all.
browser_llm = BrowserChatLiteLLM(
    model=VL_MODEL,
    api_key=VL_API_KEY,
    api_base=VL_BASE_URL,
    temperature=None if _rejects_temperature(VL_MODEL) else 0.0,
)


class BrowserUseInput(BaseModel):
    """Input for WriteFileTool."""

    instruction: str = Field(..., description="The instruction to use browser")


class BrowserTool(BaseTool):
    name: ClassVar[str] = "browser"
    args_schema: Type[BaseModel] = BrowserUseInput
    description: ClassVar[str] = (
        "Use this tool to interact with web browsers. Input should be a natural language description of what you want to do with the browser, such as 'Go to google.com and search for browser-use', or 'Navigate to Reddit and find the top post about AI'."
    )

    _agent: Optional[BrowserAgent] = None

    def _generate_browser_result(
        self, result_content: str, generated_gif_path: str
    ) -> dict:
        return {
            "result_content": result_content,
            "generated_gif_path": generated_gif_path,
        }

    def _run(self, instruction: str) -> str:
        generated_gif_path = f"{BROWSER_HISTORY_DIR}/{uuid.uuid4()}.gif"
        """Run the browser task synchronously."""
        self._agent = BrowserAgent(
            task=instruction,  # Will be set per request
            llm=browser_llm,
            browser_profile=browser_profile,
            generate_gif=generated_gif_path,
        )

        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(self._agent.run())

                if isinstance(result, AgentHistoryList):
                    return json.dumps(
                        self._generate_browser_result(
                            result.final_result(), generated_gif_path
                        )
                    )
                else:
                    return json.dumps(
                        self._generate_browser_result(result, generated_gif_path)
                    )
            finally:
                loop.close()
        except Exception as e:
            return f"Error executing browser task: {str(e)}"

    async def _arun(self, instruction: str) -> str:
        """Run the browser task asynchronously."""
        generated_gif_path = f"{BROWSER_HISTORY_DIR}/{uuid.uuid4()}.gif"
        self._agent = BrowserAgent(
            task=instruction,
            llm=browser_llm,
            browser_profile=browser_profile,
            generate_gif=generated_gif_path,  # Will be set per request
        )
        try:
            result = await self._agent.run()
            if isinstance(result, AgentHistoryList):
                return json.dumps(
                    self._generate_browser_result(
                        result.final_result(), generated_gif_path
                    )
                )
            else:
                return json.dumps(
                    self._generate_browser_result(result, generated_gif_path)
                )
        except Exception as e:
            return f"Error executing browser task: {str(e)}"


BrowserTool = create_logged_tool(BrowserTool)
browser_tool = BrowserTool()
