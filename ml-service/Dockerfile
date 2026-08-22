# RetailPulse AI — ML service (FastAPI) production image.
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# 0.0.0.0 is correct and required *inside* a container (Docker's own network
# boundary controls what's actually reachable from outside — the container
# port isn't published unless docker-compose/`-p` says so). The 127.0.0.1
# default in .env.example is for running this directly on a dev machine.
ENV ML_SERVICE_HOST=0.0.0.0
ENV ML_SERVICE_PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=3).getcode()==200 else 1)"

CMD ["python", "-m", "app.main"]
