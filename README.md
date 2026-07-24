# ReviewShield - AI-Powered Fake Review Detection System

Detects fake, AI-generated, and spam customer reviews using an NLP + Machine
Learning pipeline (TF-IDF + Logistic Regression), wrapped in a full-stack web
app: React/TypeScript frontend, Express/MongoDB backend, and a Python/Flask
ML microservice.

Built from the project PRD, using the real **Kaggle "Fake Reviews Dataset"**
(Salminen et al. - 40,432 labelled Amazon-style reviews) rather than a mocked
dataset. The bundled model was trained end-to-end during this build and
reaches:

| Metric | Result | PRD Target |
|---|---|---|
| Accuracy | **90.9%** | > 90% ✅ |
| Precision | **90.9%** | > 88% ✅ |
| Recall | **90.9%** | > 88% ✅ |
| F1 Score | **90.9%** | > 89% ✅ |
| ROC-AUC | **97.2%** | - |

(See `ml/model/metrics.json` for the exact numbers and confusion matrix from
the training run.)

---

## 1. Architecture

```
React (Vite + TS + Tailwind)  --->  Express API  --->  MongoDB Atlas
        (client/)                   (server/)              |
                                        |                   |
                                        v                   |
                                Python ML API (Flask) -------
                                    (ml/)
                          TF-IDF Vectorizer + Logistic Regression
```

- **client/** talks only to the Express API (`/api/*`), never directly to the
  ML service - matching the PRD's system architecture.
- **server/** authenticates users (JWT), persists reviews/predictions/reports
  to MongoDB, and proxies scoring requests to the Python ML API over HTTP.
- **ml/** is a standalone Flask microservice so the model can be retrained,
  redeployed, or swapped (e.g. for a future BERT model) independently of the
  Node backend.

## 2. Folder structure

```
reviewshield/
├── client/      React + TypeScript + Tailwind frontend
├── server/      Express + MongoDB backend (JWT auth, REST API)
├── ml/          Python ML microservice (Flask, TF-IDF + LogReg)
└── README.md
```

Each of `client/`, `server/`, and `ml/` is runnable independently.

---

## 3. Running it locally

You'll need **Node.js 18+**, **Python 3.10+**, and a **MongoDB** connection
string (a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster works
fine - the code was written against Atlas).

### 3.1 ML API (`ml/`)

```bash
cd ml
pip install -r requirements.txt
python train.py        # trains on ml/dataset/fake_reviews_dataset.csv, saves model/*.pkl
python app.py           # serves the API on http://localhost:5001
```

Model artifacts (`model.pkl`, `vectorizer.pkl`, `metrics.json`,
`explain_terms.json`) are already included in `ml/model/` from this build, so
you can skip straight to `python app.py` if you don't want to retrain.

NLTK will auto-download the small corpora it needs (stopwords, wordnet,
punkt) the first time `preprocessing.py` runs.

### 3.2 Backend (`server/`)

```bash
cd server
cp .env.example .env    # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev              # http://localhost:5000
```

### 3.3 Frontend (`client/`)

```bash
cd client
npm install
npm run dev               # http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:5000` (see
`vite.config.ts`), so just open http://localhost:5173 and register an
account.

---

## 4. Environment variables (`server/.env`)

```
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/reviewshield
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
ML_API_URL=http://localhost:5001
```

---

## 5. API reference

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | - | Create an account |
| POST | `/api/auth/login` | - | Get a JWT |
| GET | `/api/auth/me` | ✔ | Current user |
| POST | `/api/predict` | ✔ | Analyze one review `{ text, rating?, platform? }` |
| POST | `/api/upload` | ✔ | Upload a CSV of reviews (`multipart/form-data`, field `file`) |
| GET | `/api/history` | ✔ | Paginated past analyses (`?page=&limit=&label=`) |
| GET | `/api/dashboard` | ✔ | Quick per-user stats |
| GET | `/api/analytics` | ✔ | Trends, platform mix, model accuracy (`?days=`) |
| GET | `/api/admin/users` | ✔ (admin) | List users |
| GET | `/api/admin/model-performance` | ✔ (admin) | Latest training metrics |
| POST | `/api/admin/retrain` | ✔ (admin) | Retrain the model on the current dataset |
| GET | `/api/admin/logs` | ✔ (admin) | Retrain history |

The **first registered user is `role: "user"` by default** - promote an
account to `admin` directly in MongoDB (`db.users.updateOne(...)`) to use the
admin routes.

ML service (called by the backend, not the frontend directly):

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Liveness + whether a model is loaded |
| GET | `/metrics` | Stored evaluation metrics |
| POST | `/predict` | `{ text }` -> label, confidence, human_score, risk_level, signals |
| POST | `/predict/batch` | `{ reviews: [...] }` -> array of the above |
| POST | `/retrain` | Re-runs `train.py` |

---

## 6. How the ML pipeline works

1. **Cleaning** - lowercase, strip URLs/HTML/digits/punctuation.
2. **Tokenizing + lemmatizing** - NLTK tokenizer, stopword removal (negations
   like "not"/"never" are kept, since they matter for authenticity signals),
   WordNet lemmatization.
3. **Vectorizing** - `TfidfVectorizer` (unigrams + bigrams, 15,000 features).
4. **Classifying** - `LogisticRegression` (`class_weight="balanced"`).
5. **Explainability** - for a given review, the words that are actually in
   the model's vocabulary are ranked by their learned coefficient, so the
   "pushed toward fake / genuine" chips shown in the UI reflect the model's
   real decision boundary, not a separate heuristic.

Retraining (`python train.py` or `POST /api/admin/retrain`) regenerates
`model.pkl`, `vectorizer.pkl`, `metrics.json`, and `explain_terms.json`.

---

## 7. What's implemented vs. PRD "Future Features"

Implemented: single review scoring, CSV batch scoring, confidence score,
history, per-user dashboard, analytics (trends / platform mix / suspicious-
rate heatmap), JWT auth, admin retrain endpoint, REST API.

Deliberately left for a v2 (per the PRD's own "Future Features" list, so
scope stays honest about what's real vs. aspirational):
sentiment analysis, seller reputation scoring, BERT/RoBERTa/DistilBERT
fine-tuning, a browser extension, multilingual support, and a dedicated
admin UI (the admin **API** routes already exist and can be wired to a UI
later).

---

## 8. Deployment notes

- **Frontend** -> Vercel (`client/`, framework preset: Vite).
- **Backend** -> Render/Railway (`server/`), set the env vars from section 4.
- **ML API** -> Render/Railway (`ml/`), run with
  `gunicorn -w 2 -b 0.0.0.0:$PORT app:app`.
- **Database** -> MongoDB Atlas.

Update `CLIENT_ORIGIN` (server) and `ML_API_URL` (server) and the Vite proxy
target (or switch the frontend to an absolute API URL via an env var) once
you have real deployed URLs.

---

## 9. Dataset & licensing note

`ml/dataset/fake_reviews_dataset.csv` is the Salminen et al. Fake Reviews
Dataset, the same one Kaggle hosts as "Fake Reviews Dataset". It's widely
used for academic fake-review-detection research; check the dataset's
license/terms before any commercial use, and consider adding your own
platform's labelled data before relying on this in production.
