# KisaanNavi

KisaanNavi is a full-stack farming support app for Indian users. It combines advisory chat, crop and fertilizer recommendations, weather guidance, disease detection, feedback tracking, and analytics in one project.

## Stack

- Frontend: React + Vite
- Backend: FastAPI
- Database: MongoDB
- ML: scikit-learn models for crop and fertilizer prediction, plus a CNN-based disease model

## Recommended Way To Run

Docker is the intended local workflow.

Before you start:

- Make sure Docker Desktop is running
- Create `backend/.env` from `backend/.env.example`

From the project root:

```powershell
docker compose up --build
```

App URLs:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:5000`
- MongoDB: `mongodb://localhost:27017`

## Data And Models

The `backend/data/` directory is part of the repository and is tracked in Git.

Generated ML artifacts stay out of Git:

- `backend/models/results/`
- `backend/models/versions/`
- `backend/models/feedback_summary.json`

Large runtime model binaries in `backend/models/` are tracked with Git LFS so pushes remain reliable.

Before pushing for the first time on a machine:

```powershell
git lfs install
```

## Environment

Backend values live in `backend/.env`.

Important variables:

- `GROQ_API_KEY`
- `SARVAM_API_KEY`
- `SARVAM_BASE_URL`
- `SARVAM_TRANSLATE_MODEL`
- `MONGODB_URI`
- `JWT_SECRET`
- `ANALYTICS_ACCESS_KEY`

The Docker frontend build uses `VITE_API_URL=http://localhost:5000/api`.

## Model Training

Train models from the project root with Docker:

```powershell
docker compose run --rm backend python ml/train_crop_model.py
docker compose run --rm backend python ml/train_fertilizer_model.py
docker compose run --rm backend python ml/train_disease_model.py
```

Train everything:

```powershell
docker compose run --rm backend python ml/train_all_models.py
```

Export feedback summary or retrain:

```powershell
docker compose run --rm backend python ml/retrain_from_feedback.py --export-only
docker compose run --rm backend python ml/retrain_from_feedback.py --models crop fertilizer
docker compose run --rm backend python ml/retrain_from_feedback.py --models all
```

Optional disease training controls in PowerShell:

```powershell
$env:DISEASE_EPOCHS="22"
$env:DISEASE_BATCH_SIZE="32"
$env:DISEASE_LR="0.0006"
docker compose run --rm backend python ml/train_disease_model.py
```

## Notes

- `JWT_SECRET` is required. The backend no longer falls back to a shared default secret.
- Training commands in Docker require the backend image dependencies from `backend/requirements.txt`.
- The frontend production build is currently working.
