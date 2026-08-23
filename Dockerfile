FROM mcr.microsoft.com/playwright/python:v1.50.0-noble

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY pyproject.toml uv.lock README.md ./
COPY src ./src
COPY main.py server.py Makefile .env.example ./
COPY web ./web
COPY scripts ./scripts

RUN pip install --no-cache-dir uv \
    && uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH" \
    PORT=8000 \
    CHROME_HEADLESS=True

EXPOSE 8000

CMD ["python", "server.py"]
