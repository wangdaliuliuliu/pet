FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY scripts/image-requirements.txt /app/scripts/image-requirements.txt
RUN python3 -m venv /opt/pet-venv && /opt/pet-venv/bin/pip install --no-cache-dir -r scripts/image-requirements.txt
COPY . /app
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV PET_IMAGE_PYTHON=/opt/pet-venv/bin/python HOST=0.0.0.0 PORT=3210 PET_DATA_DIR=/app/data PET_ENABLE_GENERATION=0 PET_ENABLE_TRIPS=0
EXPOSE 3210
CMD ["node", "server.js"]
