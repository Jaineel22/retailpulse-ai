"""
Environment configuration for the ML service.

Deliberately reuses the SAME MongoDB database as the Node backend (no second
database — see Phase 3 blueprint §27) and requires no JWT/auth secrets: this
service is internal-only and is never called directly by a browser client.
"""

import os

from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/retailpulse_ai")
HOST = os.getenv("ML_SERVICE_HOST", "127.0.0.1")
PORT = int(os.getenv("ML_SERVICE_PORT", "8000"))

# Minimum number of days of sale history required before we'll attempt to
# train a model at all. Below this, forecasting/anomaly detection return a
# controlled INSUFFICIENT_HISTORY error instead of training on noise.
MIN_HISTORY_DAYS = int(os.getenv("ML_MIN_HISTORY_DAYS", "21"))

# Number of most-recent days held out as the chronological test set used to
# compute MAE/RMSE for both the model and the naive baseline.
EVAL_DAYS = int(os.getenv("ML_EVAL_DAYS", "14"))

DEFAULT_HORIZON_DAYS = int(os.getenv("ML_DEFAULT_HORIZON_DAYS", "7"))
MAX_HORIZON_DAYS = int(os.getenv("ML_MAX_HORIZON_DAYS", "30"))
