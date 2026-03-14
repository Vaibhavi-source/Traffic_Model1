"""
FastAPI server exposing the LSTM+GCN emergency traffic model as a REST API.

Port: 8001 (config["inference"]["port"])
Target latency: <500 ms per config["inference"]["max_latency_ms"]

Consumed by:
  Model 2 — Route Reliability Scorer
  Model 3 — RL Rerouting Agent
"""

import os
import time
import logging
import yaml
import numpy as np
import torch
import torch.nn as nn
import uvicorn
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv

from inference.predict import (
    load_model_and_graph,
    fetch_live_features,
    build_inference_window,
    run_prediction_for_bbox,
    summarise_prediction_result,
)
from models.lstm_gcn import count_parameters
from data.preprocess import FEATURE_COLUMNS

load_dotenv()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level state
# ---------------------------------------------------------------------------

_config: dict = {}
_device: torch.device = torch.device("cpu")
_model_cache: dict[str, tuple] = {}   # city → (model, spatial_proj, adj, node_feats, scaler)
_startup_time: float = 0.0

VALID_CITIES = ["Delhi", "Mumbai", "Bengaluru", "Chennai", "Patna"]

_SPATIAL_COLS = ["avg_speed_limit", "avg_road_weight", "is_signal", "street_count"]
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_CONFIG_PATH = _PROJECT_ROOT / "config" / "config.yaml"


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class CityPredictRequest(BaseModel):
    city_name: str


class BatchPredictRequest(BaseModel):
    city_names: list[str]


class BBox(BaseModel):
    north: float
    south: float
    east: float
    west: float


class AreaPredictRequest(BaseModel):
    bbox: BBox
    area_id: str | None = None
    reference_city: str | None = None
    weather_context_city: str | None = None


class PredictionResponse(BaseModel):
    city: str
    timestamp: str
    congestion_t5: float
    congestion_t10: float
    congestion_t20: float
    congestion_t30: float
    uncertainty_t5: float
    uncertainty_t10: float
    uncertainty_t20: float
    uncertainty_t30: float
    latency_ms: float


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    cities_available: list[str]
    uptime_seconds: float


class ModelInfoResponse(BaseModel):
    model_name: str
    lstm_hidden_size: int
    gcn_hidden_dim: int
    num_prediction_horizons: int
    checkpoint_path: str
    parameter_count: int


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load config, device, and all city models on startup."""
    global _config, _device, _model_cache, _startup_time

    # Load config
    with open(_CONFIG_PATH, "r") as f:
        _config = yaml.safe_load(f)

    device_str = _config["training"].get("device", "cpu")
    _device = torch.device(
        "cuda" if device_str == "cuda" and torch.cuda.is_available() else "cpu"
    )
    logger.info("API startup: using device %s", _device)

    preload_models = os.getenv("PRELOAD_MODELS", "false").strip().lower() == "true"

    # Optionally preload models; default is lazy loading for fast startup.
    if preload_models:
        for city_entry in _config["data"]["cities"]:
            city_name = city_entry if isinstance(city_entry, str) else city_entry["name"]
            try:
                artifacts = load_model_and_graph(city_name, _config, _device)
                _model_cache[city_name] = artifacts
                logger.info("API startup: loaded model for %s", city_name)
            except Exception:
                logger.error(
                    "API startup: failed to load model for %s — city will be unavailable",
                    city_name, exc_info=True,
                )
    else:
        logger.info("API startup: lazy model loading enabled (PRELOAD_MODELS=false)")

    _startup_time = time.time()
    logger.info(
        "API ready. Models loaded for %d cities: %s",
        len(_model_cache), list(_model_cache.keys()),
    )

    yield  # ← application runs here

    logger.info("API shutting down.")


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

class LatencyLoggingMiddleware(BaseHTTPMiddleware):
    """Log method, path, status code, and elapsed ms for every request.
    Emit a WARNING when latency exceeds the configured threshold.
    """

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        t0 = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        logger.info(
            "%s %s → %d in %.1f ms",
            request.method, request.url.path,
            response.status_code, elapsed_ms,
        )

        max_latency = _config.get("inference", {}).get("max_latency_ms", 500)
        if elapsed_ms > max_latency:
            logger.warning(
                "Latency exceeded threshold: %.1f ms > %d ms for %s %s",
                elapsed_ms, max_latency, request.method, request.url.path,
            )

        return response


# ---------------------------------------------------------------------------
# App instance
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Emergency Routing Model 1 — Traffic Prediction API",
    description=(
        "Hybrid LSTM+GCN spatiotemporal traffic congestion predictor "
        "for Indian cities. Returns congestion scores at T+5, T+10, T+20, T+30 minutes."
    ),
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(LatencyLoggingMiddleware)


# ---------------------------------------------------------------------------
# Internal helper — run inference from cache
# ---------------------------------------------------------------------------

def _predict_from_cache(city_name: str) -> PredictionResponse:
    """Run live inference using pre-loaded model and graph from _model_cache."""
    model, spatial_proj, adj_matrix, node_features, scaler = _model_cache[city_name]

    # Find city bbox
    bbox = None
    for city_entry in _config["data"]["cities"]:
        cname = city_entry if isinstance(city_entry, str) else city_entry.get("name", "")
        if cname == city_name:
            bbox = city_entry.get("bbox") if isinstance(city_entry, dict) else None
            break

    if bbox is None:
        raise ValueError(f"No bbox found in config for city '{city_name}'")

    t_start = time.perf_counter()

    # Fetch live data
    live_df = fetch_live_features(city_name, bbox, _config)

    # Build inference window
    x_window = build_inference_window(live_df, scaler, _config)
    x_temporal = torch.tensor(x_window, dtype=torch.float32).to(_device)

    # Graph tensors
    import scipy.sparse
    coo = adj_matrix.tocoo()
    edge_index  = torch.tensor(
        np.vstack([coo.row, coo.col]), dtype=torch.long
    ).to(_device)
    edge_weight = torch.tensor(coo.data, dtype=torch.float32).to(_device)

    # Spatial projection
    x_spatial_raw = torch.tensor(
        node_features[_SPATIAL_COLS].values, dtype=torch.float32
    ).to(_device)
    with torch.no_grad():
        x_spatial = spatial_proj(x_spatial_raw)

    # Predict
    result = model.predict_congestion(x_temporal, x_spatial, edge_index, edge_weight)
    latency_ms = (time.perf_counter() - t_start) * 1000.0

    summary = summarise_prediction_result(result)
    return PredictionResponse(
        city=city_name,
        timestamp=datetime.now(timezone.utc).isoformat(),
        congestion_t5=summary["congestion_t5"],
        congestion_t10=summary["congestion_t10"],
        congestion_t20=summary["congestion_t20"],
        congestion_t30=summary["congestion_t30"],
        uncertainty_t5=summary["uncertainty_t5"],
        uncertainty_t10=summary["uncertainty_t10"],
        uncertainty_t20=summary["uncertainty_t20"],
        uncertainty_t30=summary["uncertainty_t30"],
        latency_ms=latency_ms,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Return service health status and loaded cities."""
    return HealthResponse(
        status="ok",
        model_loaded=len(_model_cache) > 0,
        cities_available=list(_model_cache.keys()),
        uptime_seconds=time.time() - _startup_time if _startup_time else 0.0,
    )


@app.post("/predict", response_model=PredictionResponse)
def predict(request: CityPredictRequest) -> PredictionResponse:
    """Return live congestion prediction for a single city.

    Uses the pre-loaded model cache — does NOT reload from disk.
    """
    city_name = request.city_name

    if city_name not in VALID_CITIES:
        raise HTTPException(
            status_code=422,
            detail=f"city_name must be one of {VALID_CITIES}",
        )

    if city_name not in _model_cache:
        try:
            _model_cache[city_name] = load_model_and_graph(city_name, _config, _device)
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"Model for '{city_name}' could not be loaded: {e}",
            )

    try:
        return _predict_from_cache(city_name)
    except Exception as e:
        logger.error(
            "predict: inference failed for %s", city_name, exc_info=True
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/batch")
def predict_batch(request: BatchPredictRequest) -> list:
    """Return live congestion predictions for multiple cities.

    Invalid or failed cities are returned as error dicts rather than
    raising an HTTP exception — the list always has len == city_names.
    """
    results: list = []

    for city_name in request.city_names:
        if city_name not in VALID_CITIES:
            logger.warning(
                "predict_batch: invalid city '%s' — skipping", city_name
            )
            results.append({"city": city_name, "error": f"Not a valid city. Valid: {VALID_CITIES}"})
            continue

        if city_name not in _model_cache:
            logger.warning(
                "predict_batch: model not loaded for '%s'", city_name
            )
            results.append({"city": city_name, "error": "Model not loaded for this city."})
            continue

        try:
            results.append(_predict_from_cache(city_name).model_dump())
        except Exception as e:
            logger.error(
                "predict_batch: inference failed for %s", city_name, exc_info=True
            )
            results.append({"city": city_name, "error": str(e)})

    return results


@app.post("/predict/area")
def predict_area(request: AreaPredictRequest) -> dict:
    """Return live congestion prediction for any India bbox area."""
    bbox = request.bbox.model_dump()

    # Basic geographic sanity checks for India-ish extents.
    if not (6.0 <= bbox["south"] <= 38.5 and 6.0 <= bbox["north"] <= 38.5):
        raise HTTPException(status_code=422, detail="bbox latitude must be within India range (6.0 to 38.5)")
    if not (68.0 <= bbox["west"] <= 97.5 and 68.0 <= bbox["east"] <= 97.5):
        raise HTTPException(status_code=422, detail="bbox longitude must be within India range (68.0 to 97.5)")
    if bbox["north"] <= bbox["south"]:
        raise HTTPException(status_code=422, detail="bbox north must be greater than south")
    if bbox["east"] <= bbox["west"]:
        raise HTTPException(status_code=422, detail="bbox east must be greater than west")

    try:
        return run_prediction_for_bbox(
            bbox=bbox,
            config=_config,
            device=_device,
            area_id=request.area_id,
            weather_context_city=request.weather_context_city,
            reference_city=request.reference_city,
        )
    except Exception as e:
        logger.error("predict_area: inference failed", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/model/info", response_model=ModelInfoResponse)
def model_info() -> ModelInfoResponse:
    """Return architecture metadata for the loaded model."""
    if not _model_cache:
        raise HTTPException(
            status_code=503,
            detail="No models are loaded. Check startup logs.",
        )

    # Use the first cached model for parameter count
    first_city = next(iter(_model_cache))
    model, *_ = _model_cache[first_city]

    ckpt_path = str(
        Path(_config["training"]["checkpoint_dir"]) / "best_model.pt"
    )

    return ModelInfoResponse(
        model_name="EmergencyTrafficModel (LSTM+GCN)",
        lstm_hidden_size=_config["model"]["lstm_hidden_size"],
        gcn_hidden_dim=_config["model"]["gcn_hidden_dim"],
        num_prediction_horizons=_config["model"]["num_prediction_horizons"],
        checkpoint_path=ckpt_path,
        parameter_count=count_parameters(model),
    )


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    # Config is also loaded inside lifespan; load here only for host/port
    with open(_CONFIG_PATH, "r") as f:
        _launch_config = yaml.safe_load(f)

    uvicorn.run(
        "inference.api:app",
        host=_launch_config["inference"]["host"],
        port=_launch_config["inference"]["port"],
        log_level="info",
    )
