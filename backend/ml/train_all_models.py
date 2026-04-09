from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from ml.train_crop_model import train as train_crop_model
from ml.train_fertilizer_model import train as train_fertilizer_model
from ml.train_disease_model import train as train_disease_model


def train_all() -> None:
    print("Starting full model training pipeline...")
    train_crop_model()
    train_fertilizer_model()
    train_disease_model()
    print("All model training jobs completed.")


if __name__ == "__main__":
    train_all()
