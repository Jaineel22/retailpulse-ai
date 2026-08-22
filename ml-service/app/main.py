from fastapi import FastAPI

from app.routes.ml import router as ml_router

app = FastAPI(
    title="RetailPulse AI — ML Service",
    description=(
        "Internal forecasting/anomaly-detection service. Not exposed to the "
        "frontend — only the Node backend calls this service, and only the "
        "Node backend talks to end users."
    ),
    version="1.0.0",
)

app.include_router(ml_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "retailpulse-ml-service"}


if __name__ == "__main__":
    # Lets the service be started purely from env vars (`python -m app.main`),
    # which is what the Docker CMD uses — ML_SERVICE_HOST=0.0.0.0 inside a
    # container (required for other containers/the host to reach it), vs the
    # 127.0.0.1 default for running directly on a dev machine. For local
    # development with auto-reload, `uvicorn app.main:app --reload` is still
    # the more convenient way to run this file directly.
    import uvicorn

    from app.config import HOST, PORT

    uvicorn.run("app.main:app", host=HOST, port=PORT)
