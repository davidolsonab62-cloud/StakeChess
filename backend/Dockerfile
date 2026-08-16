FROM python:3.11-slim

# Install Stockfish from Debian's package repo. This happens once, at
# build time — no network dependency at runtime, no ambiguity about
# whether files persist between build and run (unlike Render's native
# runtime), and identical behavior on every deploy.
RUN apt-get update && \
    apt-get install -y --no-install-recommends stockfish && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# STOCKFISH_PATH env var is read by resolve_stockfish_path() and takes
# priority over every other candidate, so this pins it explicitly rather
# than relying on `shutil.which('stockfish')` finding the apt-installed
# binary on PATH (which it will, at /usr/games/stockfish or
# /usr/bin/stockfish, but being explicit avoids depending on that).
ENV STOCKFISH_PATH=/usr/games/stockfish

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
