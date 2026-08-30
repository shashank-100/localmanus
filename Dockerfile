FROM mcr.microsoft.com/playwright/python:v1.50.0-noble

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY pyproject.toml uv.lock README.md .python-version ./
COPY src ./src
COPY main.py server.py Makefile .env.example ./
COPY web ./web
COPY scripts ./scripts

# The Playwright image ships Python 3.12, so let uv fetch the 3.13 this project
# pins rather than relying on the base image's interpreter.
RUN pip install --no-cache-dir uv \
    && uv python install 3.13 \
    && uv sync --frozen --no-dev --python 3.13

ENV PATH="/app/.venv/bin:$PATH" \
    PORT=8000 \
    CHROME_HEADLESS=True

EXPOSE 8000

CMD ["python", "server.py"]
