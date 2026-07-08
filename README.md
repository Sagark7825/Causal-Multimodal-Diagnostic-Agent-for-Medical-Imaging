# MedCausal AI 🩺

> **AI-Powered Multi-Modal Causal Diagnostic Platform for Hospitals.**

MedCausal AI is a production-ready medical platform designed to assist clinicians by integrating multiple diagnostic modalities (Chest X-rays, Brain MRIs, ECGs, Lab Reports, Clinical Text) into a unified patient diagnostic graph. It moves beyond standard black-box machine learning models by incorporating **Causal Inference (Causal DAGs, Backdoor Adjustments, Counterfactual Sliders)** to reduce hospital selection bias and let doctors query "What-if" scenarios interactively.

---

## 📂 Project Architecture

```
multidiagonostic-agent/
├── docker-compose.yml       # Docker orchestrator
├── verify_apis.py           # Unit testing suite
├── backend/                 # Node.js + Express + WebSockets API
│   ├── models/              # Mongoose schemas (User, Patient, Report, Log)
│   ├── routes/              # Express API endpoints
│   ├── middleware/          # JWT and RBAC checks
│   └── server.js            # Node Entry point
├── ai_backend/              # FastAPI Python AI Services
│   ├── requirements.txt     # Python packages
│   ├── main.py              # FastAPI endpoints
│   ├── models_hub.py        # Modality Neural Net simulators (cv2 heatmaps)
│   ├── causal_engine.py     # Causal DAG and Backdoor adjustments
│   └── agents_workflow.py   # LangGraph StateGraph pipeline
└── frontend/                # React + Vite + Tailwind CSS SPA
    ├── src/
    │   ├── store/           # Redux Toolkit config
    │   ├── components/      # DICOM Canvas Viewer & Causal SVG DAG Viewer
    │   ├── App.jsx          # Dashboard layout & routers
    │   └── main.jsx         # App bootstrapping
    └── tailwind.config.js   # Style custom parameters
```

---

## 🛠️ Installation Guide

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- MongoDB (running locally or in a container)

### Step 1: Run Express Backend
1. Open a terminal and navigate to `./backend`
2. Configure `.env` if custom MongoDB URI or JWT secrets are desired (defaults are included in code).
3. Install dependencies and start server:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   *Server will boot on `http://localhost:5000`*

### Step 2: Run Python AI Backend
1. Open a terminal and navigate to `./ai_backend`
2. Initialize virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install packages and boot FastAPI:
   ```bash
   pip install -r requirements.txt
   python main.py
   ```
   *FastAPI server will boot on `http://localhost:8000`*

### Step 3: Run React Frontend
1. Open a terminal and navigate to `./frontend`
2. Install packages and start Vite dev server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *Dev server will host on `http://localhost:5173`*

---

## 🐳 Docker Deployment Guide

To deploy the entire production stack (MongoDB, Express API, FastAPI Engine) using containers:

1. Ensure Docker Desktop is running.
2. From the root directory, run:
   ```bash
   docker-compose up --build
   ```
3. Access the services:
   - Frontend app: Use local dev server proxying port 5000.
   - Backend Gateway: `http://localhost:5000`
   - AI Engine Docs: `http://localhost:8000/docs`

---

## 🧪 Verification & Testing Suite

We have created a dedicated python unit testing suite `verify_apis.py` to check the math behind causal adjustments and confirm LangGraph compiles successfully.

Run the test suite with:
```bash
python verify_apis.py
```

---

## 📖 API Documentation

### Node.js REST API
- `POST /api/auth/seed` - Generates test login credentials for Admin, Doctor, Radiologist, Lab Tech, Patient, and Receptionist.
- `POST /api/auth/login` - Authenticates user and returns JWT Token.
- `POST /api/patients` - Registers a new patient record (RBAC restricted to Receptionist/Doctor).
- `POST /api/reports/upload` - Receives medical file, forwards it to FastAPI AI server, and inserts compiled report in MongoDB.
- `POST /api/reports/:id/comment` - Approves/rejects/annotates AI predictions.

### FastAPI AI Engine
- `POST /api/v1/diagnose` - Runs file uploads through modality deep learning networks and LangGraph agent workflow.
- `POST /api/v1/causal/what-if` - Receives interventional symptom variables and outputs counterfactual disease probabilities.
