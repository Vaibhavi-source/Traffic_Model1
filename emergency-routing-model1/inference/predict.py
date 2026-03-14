"""
Live inference pipeline for the LSTM+GCN emergency traffic model.

Fetches real-time traffic and weather, builds the inference window,
and returns congestion predictions at T+5, T+10, T+20, T+30 minutes.

Target: full city inference in <500 ms (config["inference"]["max_latency_ms"]).
"""

import os
import time
import pickle
import logging
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import joblib
from pathlib import Path
from datetime import datetime, timezone
from scipy.sparse import csr_matrix
from dotenv import load_dotenv
from sklearn.preprocessing import StandardScaler

from models.lstm_gcn import EmergencyTrafficModel, build_model
from data.build_graph import build_city_graph
from data.fetch_traffic import fetch_all_sources
from data.fetch_weather import fetch_city_weather, merge_weather_with_traffic
from data.preprocess import FEATURE_COLUMNS

load_dotenv()
logger = logging.getLogger(__name__)

# Node feature columns for spatial projection (4 → gcn_input_dim)
_SPATIAL_COLS = ["avg_speed_limit", "avg_road_weight", "is_signal", "street_count"]

# Features that may be absent from live data — fill with safe defaults
_LIVE_DEFAULTS: dict = {
    "festival_intensity": 0.0,
    "incident_severity":  0.0,
    "incident_flag":      0.0,
}


# ---------------------------------------------------------------------------
# load_model_and_graph
# ---------------------------------------------------------------------------

def load_model_and_graph(
    city_name: str,
    config: dict,
    device: torch.device,
) -> tuple[EmergencyTrafficModel, nn.Linear, csr_matrix, pd.DataFrame, StandardScaler]:
    """Load all inference artifacts for a city.

    Loads the model checkpoint, spatial projection layer, road graph,
    and the MinMaxScaler fitted during preprocessing.

    Parameters
    ----------
    city_name: City name (e.g. "Delhi").
    config:    Parsed config.yaml dict.
    device:    Torch device (cpu / cuda).

    Returns
    -------
    tuple  (model, spatial_proj, adj_matrix, node_features, scaler)

    Raises
    ------
    FileNotFoundError  If checkpoint or scaler is missing.
    Exception          Re-raised on any load failure.
    """
    ckpt_path = (
        Path(config["training"]["checkpoint_dir"]) / "best_model.pt"
    )
    if not ckpt_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {ckpt_path}")

    try:
        ckpt = torch.load(str(ckpt_path), map_location=device)

        model = build_model(config).to(device)
        model.load_state_dict(ckpt["model_state_dict"])
        model.eval()

        gcn_input_dim = config["model"]["gcn_input_dim"]
        spatial_proj  = nn.Linear(4, gcn_input_dim).to(device)
        if "spatial_proj_state_dict" in ckpt:
            spatial_proj.load_state_dict(ckpt["spatial_proj_state_dict"])
        else:
            logger.warning(
                "load_model_and_graph: 'spatial_proj_state_dict' not in checkpoint "
                "— using random init for %s", city_name,
            )
        spatial_proj.eval()

        logger.info(
            "load_model_and_graph: model loaded from %s for %s",
            ckpt_path, city_name,
        )
    except Exception:
        logger.error(
            "load_model_and_graph: failed to load model for %s",
            city_name, exc_info=True,
        )
        raise

    # Road graph
    try:
        _, adj_matrix, node_features = build_city_graph(city_name, config)
    except Exception:
        logger.error(
            "load_model_and_graph: failed to load graph for %s",
            city_name, exc_info=True,
        )
        raise

    # Scaler
    scaler_path = (
        Path(config["data"]["processed_data_dir"]) / city_name / "scaler.pkl"
    )
    if not scaler_path.exists():
        raise FileNotFoundError(f"Scaler not found: {scaler_path}")

    try:
        scaler = joblib.load(str(scaler_path))
        logger.info("load_model_and_graph: scaler loaded from %s", scaler_path)
    except Exception:
        logger.error(
            "load_model_and_graph: failed to load scaler for %s",
            city_name, exc_info=True,
        )
        raise

    return model, spatial_proj, adj_matrix, node_features, scaler


# ---------------------------------------------------------------------------
# fetch_live_features
# ---------------------------------------------------------------------------

def fetch_live_features(
    city_name: str,
    bbox: dict,
    config: dict,
) -> pd.DataFrame:
    """Fetch real-time traffic + weather and merge them.

    Parameters
    ----------
    city_name: City name  (used by fetch_city_weather for IMD lookup).
    bbox:      Dict with north, south, east, west keys.
    config:    Parsed config.yaml dict.

    Returns
    -------
    pd.DataFrame  Merged traffic + weather (18+ columns).

    Raises
    ------
    RuntimeError  If the merged DataFrame is empty.
    """
    try:
        traffic_df = fetch_all_sources(bbox, config, city_name)
    except Exception:
        logger.error(
            "fetch_live_features: fetch_all_sources failed for %s",
            city_name, exc_info=True,
        )
        raise

    try:
        weather_dict = fetch_city_weather(
            city_name,
            lat=bbox["north"],
            lon=bbox["east"],
            config=config,
        )
    except Exception:
        logger.error(
            "fetch_live_features: fetch_city_weather failed for %s",
            city_name, exc_info=True,
        )
        raise

    merged_df = merge_weather_with_traffic(traffic_df, weather_dict)

    if merged_df.empty:
        raise RuntimeError(
            f"fetch_live_features: merged DataFrame is empty for {city_name}"
        )

    logger.info(
        "fetch_live_features: %d rows fetched for %s",
        len(merged_df), city_name,
    )
    return merged_df


# ---------------------------------------------------------------------------
# build_inference_window
# ---------------------------------------------------------------------------

def build_inference_window(
    live_df: pd.DataFrame,
    scaler: StandardScaler,
    config: dict,
) -> np.ndarray:
    """Build a single (1, window_size, 12) inference tensor from live data.

    Fills missing FEATURE_COLUMNS with safe defaults, pads if fewer rows
    than window_size, truncates if more.

    Parameters
    ----------
    live_df: Merged traffic + weather DataFrame.
    scaler:  Fitted scaler from preprocessing.
    config:  Parsed config.yaml dict.

    Returns
    -------
    np.ndarray  Shape (1, window_size, 12) dtype float32.
    """
    window_size = config["data"]["window_size"]

    # Fill defaults for feature columns that live data may not supply
    for col, default in _LIVE_DEFAULTS.items():
        if col not in live_df.columns:
            live_df = live_df.copy()
            live_df[col] = default

    # fog_flag: bool → float
    if "fog_flag" in live_df.columns:
        live_df = live_df.copy()
        live_df["fog_flag"] = live_df["fog_flag"].astype(float)

    # Ensure all FEATURE_COLUMNS present
    for col in FEATURE_COLUMNS:
        if col not in live_df.columns:
            logger.warning(
                "build_inference_window: missing column '%s' — filling 0.0", col
            )
            live_df = live_df.copy()
            live_df[col] = 0.0

    feature_array = live_df[FEATURE_COLUMNS].values.astype(np.float64)
    feature_array = np.nan_to_num(feature_array, nan=0.0)

    n_rows = len(feature_array)

    if n_rows < window_size:
        # Pad by repeating the first row
        pad_rows   = window_size - n_rows
        first_row  = feature_array[0:1]
        padding    = np.repeat(first_row, pad_rows, axis=0)
        feature_array = np.concatenate([padding, feature_array], axis=0)
    else:
        # Take the most recent window_size rows
        feature_array = feature_array[-window_size:]

    scaled = scaler.transform(feature_array).astype(np.float32)
    # Return shape (1, window_size, 12)
    return scaled[np.newaxis, :, :]


# ---------------------------------------------------------------------------
# run_prediction
# ---------------------------------------------------------------------------

def run_prediction(
    city_name: str,
    config: dict,
    device: torch.device,
) -> dict:
    """Full end-to-end live inference for one city.

    Latency is measured over steps 2–7 only (not model/graph loading).

    Parameters
    ----------
    city_name: City name (e.g. "Delhi").
    config:    Parsed config.yaml dict.
    device:    Torch device.

    Returns
    -------
    dict  Prediction result including congestion scores, uncertainty, and latency_ms.
    """
    # Step 1: Load model and graph (not counted in latency)
    model, spatial_proj, adj_matrix, node_features, scaler = load_model_and_graph(
        city_name, config, device,
    )

    # Find city bbox
    bbox = None
    for city_entry in config["data"]["cities"]:
        cname = city_entry if isinstance(city_entry, str) else city_entry.get("name", "")
        if cname == city_name:
            bbox = city_entry.get("bbox") if isinstance(city_entry, dict) else None
            break

    if bbox is None:
        raise ValueError(f"run_prediction: no bbox found in config for city '{city_name}'")

    # Steps 2–7 — timed
    t_start = time.perf_counter()

    # Step 2: Fetch live features
    live_df = fetch_live_features(city_name, bbox, config)

    # Step 3: Build inference window
    x_window = build_inference_window(live_df, scaler, config)
    x_temporal = torch.tensor(x_window, dtype=torch.float32).to(device)

    # Step 4: Build graph tensors
    coo = adj_matrix.tocoo()
    edge_index  = torch.tensor(
        np.vstack([coo.row, coo.col]), dtype=torch.long
    ).to(device)
    edge_weight = torch.tensor(coo.data, dtype=torch.float32).to(device)

    # Step 5: Project node features
    x_spatial_raw = torch.tensor(
        node_features[_SPATIAL_COLS].values, dtype=torch.float32
    ).to(device)
    with torch.no_grad():
        x_spatial = spatial_proj(x_spatial_raw)

    # Step 6/7: Predict
    result = model.predict_congestion(x_temporal, x_spatial, edge_index, edge_weight)

    latency_ms = (time.perf_counter() - t_start) * 1000.0

    logger.info(
        "run_prediction: %s congestion_t5=%.4f latency=%.1f ms",
        city_name,
        float(result["congestion_t5"].mean()),
        latency_ms,
    )

    return {
        "city":            city_name,
        "timestamp":       datetime.now(timezone.utc).isoformat(),
        "congestion_t5":   float(np.mean(result["congestion_t5"])),
        "congestion_t10":  float(np.mean(result["congestion_t10"])),
        "congestion_t20":  float(np.mean(result["congestion_t20"])),
        "congestion_t30":  float(np.mean(result["congestion_t30"])),
        "uncertainty_t5":  float(np.mean(result["uncertainty_t5"])),
        "uncertainty_t10": float(np.mean(result["uncertainty_t10"])),
        "uncertainty_t20": float(np.mean(result["uncertainty_t20"])),
        "uncertainty_t30": float(np.mean(result["uncertainty_t30"])),
        "latency_ms":      latency_ms,
    }


# ---------------------------------------------------------------------------
# run_batch_prediction
# ---------------------------------------------------------------------------

def run_batch_prediction(
    city_names: list[str],
    config: dict,
    device: torch.device,
) -> list[dict]:
    """Run predictions for multiple cities sequentially.

    Per-city failures are caught and appended as error dicts so the
    list always has the same length as city_names.

    Parameters
    ----------
    city_names: List of city name strings.
    config:     Parsed config.yaml dict.
    device:     Torch device.

    Returns
    -------
    list[dict]  One dict per city — either a full prediction or an error dict.
    """
    results: list[dict] = []
    for city_name in city_names:
        try:
            results.append(run_prediction(city_name, config, device))
        except Exception as e:
            logger.error(
                "run_batch_prediction: failed for city %s — %s",
                city_name, e, exc_info=True,
            )
            results.append({"city": city_name, "error": str(e)})
    return results
