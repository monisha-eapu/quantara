"""
Q-SHIELD AP: Quantum Ledger Intelligence Engine (QLIE) Configuration
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATASET_PATH = BASE_DIR / "dataset" / "data.csv"
MODELS_DIR = BASE_DIR / "qml" / "models"
BENCHMARK_PATH = BASE_DIR / "qml" / "benchmark.json"

RANDOM_SEED = 42
NUM_QUBITS = 4  # 4-qubit Quantum Kernel for low-latency live hackathon API scoring
FULL_QUBITS = 8 # 8-qubit architecture for the deep VQC ledger model

SELECTED_FEATURES = [
    "transaction_frequency",
    "transaction_velocity",
    "ownership_change_frequency",
    "geographical_distance",
]

FEATURE_DESCRIPTIONS = {
    "transaction_frequency": "Frequency of transactions for this entity within 30 days",
    "transaction_velocity": "Rate of state/ownership change velocity (0 to 1)",
    "transaction_value": "Normalized economic/area scale of the transaction",
    "ownership_change_frequency": "Number of recorded ownership transfers in past 12 months",
    "historical_owner_count": "Total cumulative historical transfer count",
    "time_since_previous_transaction": "Days elapsed since the previous confirmed block anchor",
    "geographical_distance": "Geographic distance (km) between successive registration centers",
    "timestamp_deviation": "Offset in minutes between submission timestamp and block commitment",
}
