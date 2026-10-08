"""
Q-SHIELD AP: Feature Preprocessing and Scaling Pipeline
Ensures proper data normalization into quantum state angles without data leakage.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import List
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from .config import SELECTED_FEATURES, MODELS_DIR


class QLIEPreprocessor:
    def __init__(self, features: List[str] = SELECTED_FEATURES):
        self.features = features
        self.scaler = MinMaxScaler(feature_range=(0.0, 2 * np.pi))
        self.is_fitted = False
        self.feature_min_: np.ndarray | None = None
        self.feature_max_: np.ndarray | None = None

    def fit(self, df: pd.DataFrame) -> "QLIEPreprocessor":
        X = df[self.features].values.astype(float)
        self.scaler.fit(X)
        self.feature_min_ = self.scaler.data_min_
        self.feature_max_ = self.scaler.data_max_
        self.is_fitted = True
        return self

    def transform(self, df: pd.DataFrame | dict) -> np.ndarray:
        if not self.is_fitted:
            raise RuntimeError("Preprocessor must be fitted before transforming.")
        if isinstance(df, dict):
            # Extract row from dict, providing sensible defaults if missing
            row = [float(df.get(f, 0.0)) for f in self.features]
            X = np.array([row], dtype=float)
        else:
            X = df[self.features].values.astype(float)
        return self.scaler.transform(X)

    def fit_transform(self, df: pd.DataFrame) -> np.ndarray:
        return self.fit(df).transform(df)

    def save(self, filepath: Path | str | None = None):
        if filepath is None:
            MODELS_DIR.mkdir(parents=True, exist_ok=True)
            filepath = MODELS_DIR / "preprocessor.json"
        data = {
            "features": self.features,
            "data_min": self.feature_min_.tolist() if self.feature_min_ is not None else [],
            "data_max": self.feature_max_.tolist() if self.feature_max_ is not None else [],
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    @classmethod
    def load(cls, filepath: Path | str | None = None) -> "QLIEPreprocessor":
        if filepath is None:
            filepath = MODELS_DIR / "preprocessor.json"
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        inst = cls(features=data["features"])
        inst.feature_min_ = np.array(data["data_min"])
        inst.feature_max_ = np.array(data["data_max"])
        inst.scaler.data_min_ = inst.feature_min_
        inst.scaler.data_max_ = inst.feature_max_
        inst.scaler.data_range_ = np.maximum(inst.feature_max_ - inst.feature_min_, 1e-8)
        inst.scaler.scale_ = (2 * np.pi) / inst.scaler.data_range_
        inst.scaler.min_ = -inst.feature_min_ * inst.scaler.scale_
        inst.is_fitted = True
        return inst
