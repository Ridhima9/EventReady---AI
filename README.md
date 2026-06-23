# 🚦 EventReady AI

### AI-Powered Event-Driven Congestion Management Platform

---

## Problem Statement

Traffic disruptions caused by rallies, festivals, construction activities, accidents, and sudden gatherings are often handled reactively. Resource deployment relies heavily on operator experience and lacks a mechanism to learn from past events.

**EventReady AI** transforms historical traffic incidents into proactive operational intelligence by forecasting impact, recommending resources, and continuously improving from field outcomes.

---

## Key Features

* Historical similarity-based event retrieval
* Road closure probability prediction
* Disruption duration estimation
* Operational Readiness Score (0–100)
* Resource recommendation engine
* Dynamic field checklist generation
* Interactive hotspot visualization
* Event Memory feedback loop
* Learning Analytics dashboard
* Evidence-backed decision support

---

## Solution Workflow

```text
User Input
      ↓
Historical Similar Event Retrieval
      ↓
ML-Based Impact Assessment
      ↓
Operational Readiness Score
      ↓
Resource Recommendation
      ↓
Field Checklist Generation
      ↓
Outcome Logging
      ↓
Continuous Learning Loop
```

---

## Machine Learning Approach

EventReady AI uses historical Bengaluru traffic incidents to support operational decisions.

### Models Used

* **Random Forest Classifier**

  * Predicts road closure probability.

* **Random Forest Regressor**

  * Estimates disruption duration.

### Similarity Engine

Historical events are grouped using:

* Event Cause
* Corridor
* Priority
* Hour Bucket

For each group, the system stores:

* Closure likelihood
* Median duration
* Frequent junctions
* Historical patterns
* Standard operational checklist

This enables fast and reproducible recommendations.

---

## Model Performance

Two Random Forest models were trained on **8,173 Bengaluru traffic incidents**.

| Model                  | Task                    | Performance                        |
| ---------------------- | ----------------------- | ---------------------------------- |
| RandomForestClassifier | Road Closure Prediction | Recall: **0.538** · AUC: **0.734** |
| RandomForestRegressor  | Duration Prediction     | MAE: **0.76 hrs** · R²: **0.182**  |

### Input Features

* Event Cause
* Corridor
* Priority
* Hour Bucket

Event cause emerged as the strongest predictor for both tasks.

---

## Operational Readiness Score

The readiness score combines:

* Closure probability
* Junction criticality
* Peak-hour patterns
* Event priority
* Historical trends

The score helps determine:

* Officer deployment
* Barricading requirements
* Operational urgency
* Resource intensity

---

## Event Memory & Learning

EventReady AI incorporates a post-event feedback loop.

Field operators log whether resources were:

* Understaffed
* Sufficient
* Overstaffed

These outcomes are stored and analyzed to identify recurring patterns and improve future recommendations.

---

## Technology Stack

| Layer            | Technologies                          |
| ---------------- | ------------------------------------- |
| Frontend         | React, TypeScript, Tailwind CSS, Vite |
| Backend          | FastAPI, Python, Uvicorn              |
| Machine Learning | Scikit-Learn, Pandas, NumPy           |
| Storage          | CSV, JSON, Pickle Artifacts           |
| Models           | Random Forest Classifier & Regressor  |

---

## Getting Started

### Clone Repository

```bash
git clone https://github.com/Ridhima9/EventReady---AI.git
cd EventReady---AI
```

### Install Backend Dependencies

```bash
pip install -r requirements.txt
```

### Start Backend

```bash
python backend/backend.py
```

Backend API docs:

```text
http://localhost:8000/docs
```

### Start Frontend

```bash
cd frontend

npm install

npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

## API Endpoints

### POST `/api/assess`

Returns:

* Readiness Score
* Closure Probability
* Duration Estimate
* Resource Recommendations
* Operational Checklist
* Historical Evidence

### POST `/api/log`

Stores field outcomes for continuous learning.

### GET `/api/analytics`

Returns deployment and learning statistics.

### GET `/api/memory/stats`

Returns corridor-wise feedback trends.

---

## Future Scope

* Real-time traffic feed integration
* Dynamic route diversion recommendations
* CCTV-assisted event detection
* Multi-city deployment
* Smart signal coordination
* Adaptive resource optimization

---

## Vision

**EventReady AI aims to shift traffic management from reactive operations to proactive, data-driven decision making through prediction, operational guidance, and continuous learning.**

---

