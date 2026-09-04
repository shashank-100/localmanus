FROM mcr.microsoft.com/playwright/python:v1.50.0-noble

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY pyproject.toml uv.lock README.md .python-version ./
COPY src ./src
COPY main.py server.py Makefile .env.example ./
COPY web ./web

# The Playwright image ships Python 3.12, so make uv download the 3.13 this
# project pins. UV_PYTHON_DOWNLOADS/PREFERENCE stop uv from silently falling
# back to the system interpreter at /usr/bin/python3.
ENV UV_PYTHON_DOWNLOADS=automatic \
    UV_PYTHON_PREFERENCE=only-managed

RUN pip install --no-cache-dir uv \
    && uv python install 3.13 \
    && uv venv --python 3.13 /app/.venv \
    && uv sync --frozen --no-dev --python /app/.venv/bin/python

ENV PATH="/app/.venv/bin:$PATH" \
    PORT=8000 \
    CHROME_HEADLESS=True

EXPOSE 8000

CMD ["python", "server.py"]
