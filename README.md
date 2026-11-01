# 🩺 MedCausal AI — Multimodal Medical Diagnostic Agent

### AI-Powered Multimodal Clinical Decision Support System

MedCausal AI is an AI-powered medical diagnostic assistance platform that integrates deep learning, Large Language Models (LLMs), and causal reasoning to support medical professionals in analyzing medical images and patient information.

The platform combines multiple diagnostic modalities, including **Chest X-rays and Brain MRI scans**, with patient medical history, symptoms, and clinical information to generate comprehensive AI-assisted diagnostic reports.

Unlike traditional image classification systems that provide predictions independently, MedCausal AI aims to combine image-based findings with relevant clinical context through an intelligent agent workflow.

The system provides dedicated interfaces for doctors, radiologists, and administrators, enabling collaboration throughout the diagnostic process.

---

## ✨ Key Features

* **Multimodal Medical Image Analysis:** AI-assisted analysis of Chest X-rays and MRI images.
* **Deep Learning Integration:** DenseNet121-based architecture for Chest X-ray analysis.
* **AI-Powered Medical Reporting:** Combines model-generated findings with patient history and clinical symptoms.
* **LLM Integration:** Uses Large Language Models to generate structured, context-aware diagnostic assistance.
* **Agentic AI Workflow:** LangChain and LangGraph integration for orchestrating AI processing tasks.
* **Doctor–Radiologist Collaboration:** Enables doctors to assign radiologists and review diagnostic reports.
* **Role-Based Access Control:** Dedicated access and functionality for different hospital users.
* **Interactive Dashboard:** Provides patient management, diagnostic information, and report visualization.
* **Medical Image Management:** Supports uploading and processing medical images.
* **Causal Reasoning:** Incorporates causal reasoning concepts to explore relationships between clinical variables and diagnostic outcomes.

---

## 🏗️ System Architecture

MedCausal AI follows a modular architecture consisting of three major components:

1. React frontend for user interaction and dashboard management.
2. Node.js backend for authentication, authorization, patient management, and report handling.
3. Python AI backend for medical image analysis, model inference, and intelligent report generation.

### Architecture Overview

```text
                 ┌──────────────────────────┐
                 │       USERS              │
                 │                          │
                 │   Admin | Doctor         │
                 │       Radiologist       │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │     REACT FRONTEND      │
                 │                          │
                 │ Dashboard & UI           │
                 │ Patient Management       │
                 │ Image Upload              │
                 │ Report Visualization     │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │   NODE.JS + EXPRESS      │
                 │                          │
                 │ Authentication           │
                 │ Role-Based Access        │
                 │ Patient Management       │
                 │ Report Management        │
                 └────────────┬─────────────┘
                              │
                   ┌──────────┴──────────┐
                   │                     │
                   ▼                     ▼
          ┌────────────────┐   ┌─────────────────┐
          │    MongoDB     │   │  Python AI API  │
          │                │   │    FastAPI      │
          │ Users          │   └────────┬────────┘
          │ Patients       │            │
          │ Reports        │            ▼
          │ Clinical Data  │   ┌─────────────────┐
          └────────────────┘   │  AI PROCESSING  │
                               │                 │
                               │ DenseNet121     │
                               │ MRI Model       │
                               │ LLM Integration │
                               │ LangGraph       │
                               │ Causal Engine   │
                               └────────┬────────┘
                                        │
                                        ▼
                               ┌─────────────────┐
                               │ AI-Generated    │
                               │ Findings &      │
                               │ Diagnostic      │
                               │ Report          │
                               └────────┬────────┘
                                        │
                                        ▼
                               ┌─────────────────┐
                               │ Doctor /        │
                               │ Radiologist     │
                               │ Review          │
                               └─────────────────┘
```

---

## 🔄 Diagnostic Workflow

The platform follows a collaborative workflow between doctors, radiologists, and AI services.

### Step 1: Patient Registration

The doctor or authorized hospital user registers a patient and enters relevant information, including:

* Patient details
* Medical history
* Current symptoms
* Previous clinical information

### Step 2: Radiologist Assignment

The doctor assigns the patient’s diagnostic case to an available radiologist.

The radiologist receives the case and can access the relevant patient information.

### Step 3: Medical Image Upload

The radiologist uploads the required medical image, such as:

* Chest X-ray
* Brain MRI

### Step 4: Deep Learning Analysis

The uploaded image is forwarded to the Python AI backend.

The appropriate deep learning model processes the image and generates prediction results.

**Chest X-ray Analysis:**

* DenseNet121-based deep learning model.
* Image preprocessing.
* Model inference.
* Disease classification and prediction results.

**MRI Analysis:**

* MRI-specific image processing and model inference.
* Analysis based on the implemented MRI model.

### Step 5: AI-Assisted Report Generation

The AI reporting pipeline combines:

* Patient medical history.
* Doctor-provided symptoms.
* Deep learning model findings.

The LLM processes the available information and generates a structured diagnostic report.

LangGraph coordinates the relevant AI processing steps.

### Step 6: Radiologist Review

The radiologist reviews the AI-generated findings and report.

The radiologist can provide clinical input and finalize the report according to the implemented workflow.

### Step 7: Doctor Reviews the Report

The doctor accesses the finalized report and uses it as additional information for clinical decision-making.

---

## 🧠 AI & Machine Learning Components

### 1. Chest X-ray Analysis — DenseNet121

MedCausal AI incorporates DenseNet121 for Chest X-ray image analysis.

DenseNet121 is a convolutional neural network architecture that uses dense connections between layers to improve feature propagation and feature reuse.

**Implementation Details:**

* Architecture: DenseNet121
* Framework: PyTorch
* Input: Preprocessed Chest X-ray images
* Model checkpoint: `best_densenet121.pth`
* Dataset: NIH ChestX-ray14

The model checkpoint is maintained in:

```text
ai_backend/
└── checkpoints/
    └── best_densenet121.pth
```

### 2. MRI Image Analysis

The platform also incorporates a dedicated MRI analysis pipeline.

The MRI workflow is designed to process brain MRI images and generate model-based findings.

The MRI processing implementation includes:

* MRI image preprocessing.
* Dataset handling.
* Model training and inference components.
* Integration with the Python AI backend.

Relevant training and dataset scripts:

```text
ai_backend/
└── training/
    ├── models.py
    ├── mri_dataset.py
    ├── train_chestxray.py
    └── train_mri.py
```

### 3. LLM-Based Diagnostic Assistance

The LLM integration provides an additional reasoning layer over the available clinical information.

The information supplied to the reporting workflow includes:

1. Patient medical history.
2. Doctor-provided primary symptoms.
3. Deep learning model-generated findings.

The LLM uses this information to generate structured diagnostic assistance.

**Important:** LLM-generated reports are intended for professional review and should not be treated as independent medical diagnoses.

### 4. LangChain and LangGraph

LangChain and LangGraph are used to support the intelligent AI processing workflow.

LangGraph provides a structured approach to coordinating multiple processing steps and maintaining workflow state.

The architecture supports modular AI processing, making it easier to extend the system with additional diagnostic capabilities.

### 5. Causal Reasoning Engine

MedCausal AI also incorporates causal reasoning concepts.

The intended capabilities include:

* Directed Acyclic Graphs (DAGs).
* Backdoor adjustment concepts.
* Relationships between clinical variables.
* Counterfactual reasoning.

These components aim to explore relationships between patient characteristics and diagnostic outcomes.

Causal estimates should only be interpreted within the assumptions and validation limits of the underlying implementation.

---

## 🛠️ Technology Stack

| Category          | Technologies           |
| ----------------- | ---------------------- |
| Frontend          | React.js, Vite         |
| UI Framework      | Tailwind CSS           |
| State Management  | Redux Toolkit          |
| Backend           | Node.js, Express.js    |
| Database          | MongoDB                |
| AI Backend        | Python, FastAPI        |
| Deep Learning     | PyTorch, DenseNet121   |
| AI Orchestration  | LangChain, LangGraph   |
| LLM Integration   | LLM APIs               |
| Authentication    | JWT                    |
| API Communication | REST APIs              |
| Containerization  | Docker, Docker Compose |
| Development Tools | Git, GitHub, Postman   |

---

## 📂 Project Structure

```text
multidiagonostic-agent/
│
├── backend/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   └── server.js
│
├── ai_backend/
│   ├── checkpoints/
│   │   └── best_densenet121.pth
│   │
│   ├── training/
│   │   ├── models.py
│   │   ├── mri_dataset.py
│   │   ├── train_chestxray.py
│   │   └── train_mri.py
│   │
│   ├── main.py
│   ├── causal_engine.py
│   ├── agents_workflow.py
│   ├── models_hub.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   └── UI/
│   │   ├── services/
│   │   ├── store/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   └── package.json
│
├── docker-compose.yml
├── verify_apis.py
└── README.md
```

---

## ⚙️ Installation and Setup

### Prerequisites

Install the following before running the project:

* Node.js 18 or later.
* Python 3.10 or later.
* MongoDB.
* Git.
* Docker Desktop (optional).

### 1. Clone the Repository

```bash
git clone https://github.com/Sagark7825/Causal-Multimodal-Diagnostic-Agent-for-Medical-Imaging.git

cd Causal-Multimodal-Diagnostic-Agent-for-Medical-Imaging
```

### 2. Configure the Backend

```bash
cd backend

npm install
```

Configure the backend environment variables using your `.env` file.

Example configuration (adjust variable names to match your implementation):

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
```

Start the backend:

```bash
npm run dev
```

Backend URL:

```text
http://localhost:5000
```

### 3. Configure the Python AI Backend

Open another terminal:

```bash
cd ai_backend
```

Create a virtual environment:

**Windows:**

```powershell
python -m venv venv
venv\Scripts\activate
```

**Linux / macOS:**

```bash
python -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI service using the configured application entry point.

For example, if the application exposes a FastAPI instance named `app` in `main.py`:

```bash
uvicorn main:app --reload --port 8000
```

AI backend URL:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

### 4. Configure the Frontend

Open another terminal:

```bash
cd frontend

npm install

npm run dev
```

Frontend development server:

```text
http://localhost:5173
```

Make sure the frontend API configuration points to the correct backend URLs.

---

## 🐳 Docker Setup

The project includes Docker Compose configuration for containerized deployment.

Make sure Docker Desktop is running.

From the project root:

```bash
docker compose up --build
```

To stop the containers:

```bash
docker compose down
```

The services and ports depend on the current `docker-compose.yml` configuration.

---

## 📡 API Documentation

### Node.js Backend APIs

| Method | Endpoint                   | Description                           |
| ------ | -------------------------- | ------------------------------------- |
| POST   | `/api/auth/login`          | User authentication                   |
| POST   | `/api/auth/seed`           | Initialize test users                 |
| POST   | `/api/patients`            | Register a patient                    |
| POST   | `/api/reports/upload`      | Upload medical reports and images     |
| POST   | `/api/reports/:id/comment` | Add report comments or review actions |

### Python AI Backend

| Method | Endpoint           | Description                                               |
| ------ | ------------------ | --------------------------------------------------------- |
| POST   | `/api/v1/diagnose` | Process medical images through the AI diagnostic pipeline |

For detailed request and response schemas, refer to the FastAPI Swagger documentation at:

```text
http://localhost:8000/docs
```

---

## 📊 Dataset Information

### NIH ChestX-ray14

The project uses the publicly available NIH ChestX-ray14 dataset for Chest X-ray research and model development.

The dataset contains more than 100,000 frontal-view chest radiographs associated with 14 disease labels.

Dataset reference:

https://nihcc.app.box.com/v/ChestXray-Nihcc

MRI dataset details should be documented separately with the exact dataset name, source, preprocessing methodology, and licensing information used in the implementation.

---

## 🧪 Testing and Verification

The project includes a verification script:

```bash
python verify_apis.py
```

This can be used to verify supported API functionality and AI workflow components.

Additional testing should cover:

* Backend API functionality.
* Authentication and authorization.
* Patient registration.
* Medical image upload.
* Model inference.
* LangGraph workflow execution.
* Report generation.
* Frontend integration.

Model performance should be reported using actual evaluation results, including accuracy, precision, recall, F1-score, and confusion matrices where applicable.

---

## 🔒 Security and Privacy

Medical information is sensitive and requires appropriate protection.

The system incorporates authentication and role-based access control.

For real-world deployment, additional safeguards are required, including:

* Secure handling of patient information.
* HTTPS communication.
* Protected API endpoints.
* Secure storage of medical images.
* Access logging and audit trails.
* Data encryption.
* Compliance with applicable healthcare privacy regulations.

---

## 🚀 Future Enhancements

Potential improvements include:

* Integration of additional medical imaging modalities.
* Improved multimodal fusion.
* More comprehensive clinical reasoning.
* Explainable AI visualizations.
* Enhanced model evaluation and external validation.
* Integration with hospital information systems.
* Secure cloud deployment.
* Clinical validation with qualified medical professionals.

---

## ⚠️ Medical Disclaimer

MedCausal AI is an academic and research-oriented project developed for educational and experimental purposes.

The AI-generated predictions and reports are not substitutes for professional medical diagnosis, clinical judgment, or treatment recommendations.

The system has not been established as a clinically validated medical device. All outputs must be independently reviewed by qualified healthcare professionals.

---

## 👨‍💻 Developer

**Sagar Khandagale**

Computer Engineering Student
D. Y. Patil College of Engineering, Akurdi, Pune

* GitHub: https://github.com/Sagark7825
* LinkedIn: https://linkedin.com/in/sagar-khandagale-617a992a3

---

⭐ If you find this project interesting, consider giving the repository a star!
