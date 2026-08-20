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
