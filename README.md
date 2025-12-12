# <img src="schema-agent-ui/assets/logo.png" width="48" height="48" style="vertical-align: middle;" /> Night City: Agentic Spanner Schema Converter

**Night City** is an intelligent, human-in-the-loop schema conversion tool designed to modernize SQL schemas for Google Cloud Spanner. It combines a powerful LLM-based agent with a slick, developer-focused UI to make database migration valid, interactive, and seamless.

## 🚀 Key Features

- **Agentic Conversion**: An AI agent that doesn't just translate, but *understands* and *verifies* your schema.
- **Human-in-the-Loop**: Dual-pane editors allow you to review source and output, with an integrated **Diff View** for reviewing agent-proposed fixes.
- **Real-World Verification**: Integrates with a live Spanner instance to validate DDL against actual database constraints.
- **Analyze & Fix**: If verification fails, the agent analyzes the error and proposes specific fixes you can review and accept/reject.
- **Direct Migration**: One-click deployment of your converted schema to a new Cloud Spanner database directly from the UI.
- **Interactive Chat**: Ask questions, request refactors (e.g., "Use UUIDs instead of SERIAL"), and get context-aware answers with markdown support.

## 🏗️ Architecture

The project consists of two main components:

1.  **Backend (`schema-agent-backend`)**: A FastAPI Python service that hosts the AI agent (using Google Gemini models). It includes specialized tools for **Schema Verification**, **Error Analysis**, and **Spanner Migration**.
2.  **Frontend (`schema-agent-ui`)**: A text-based, dark-mode React application providing the conversion interface.

### 🧠 Agentic Architecture

The core of Night City is a sophisticated AI pipeline that goes beyond simple translation:

#### 1. Contextual Augmentation (RAG)
Before the agent sees your schema, a **Context Manager** analyzes the Source DDL to inject relevant knowledge:
- **DDL Hints**: Scans for specific SQL keywords (e.g., `AUTO_INCREMENT`, `FOREIGN KEY`) and injects the exact Spanner DDL syntax rules for those features.
- **Feature Hints**: Detects patterns dependent on Spanner topology (e.g., identifying parent-child relationships for `INTERLEAVE IN PARENT`).
- **Mapping Rules**: Enforces deterministic data type conversions (e.g., PostgreSQL `JSONB` → Spanner `JSON`) based on the selected dialect.

#### 2. Chain of Thought (CoT) Reasoning
The agent is prompted to follow a rigid "Principal Engineer" workflow:
1.  **Analyze**: Parse the source schema and identify constraints.
2.  **Plan**: Propose Spanner-specific optimizations (Interleaving, Sharding keys).
3.  **Generate**: Output clean, valid DDL.

#### 3. Human-in-the-Loop Validation
- **Verification Loop**: If enabled, the agent attempts to create the schema on a real Spanner instance.
- **Self-Correction**: If verification fails, the error is fed back to the agent ("Analyze & Fix"), which decompiles the error and attempts a targeted fix.

## 🛠️ Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 16+
- Google Cloud Project with Spanner API enabled (for verification)

### 1. Environment Configuration

Create a `.env` file in this root directory with the following variables:

```env
# Google Cloud Configuration
SPANNER_PROJECT_ID="your-project-id"
SPANNER_INSTANCE_ID="your-instance-id"

# Model Configuration
GOOGLE_API_KEY="your-gemini-api-key"
```

### 2. Backend Setup

```bash
cd schema-agent-backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```
The backend will start at `http://localhost:8001`.

### 3. Frontend Setup

```bash
cd schema-agent-ui
npm install
npm run dev
```
The frontend will start at `http://localhost:5173` (or similar).

## 💡 Usage Guide

1.  **Paste Schema**: Paste your MySQL/PostgreSQL schema into the left panel.
2.  **Select Dialect**: Choose the source dialect.
3.  **Enable Verification (Optional)**: Check "Enable verification?" for deep validation (requires active Spanner credentials).
4.  **Convert**: Click the "Convert" button.
    - *Tip*: The agent will iterate on the schema if verification fails, fixing errors automatically.
5.  **Refine**:
    - Highlight code to ask the agent specific questions.
    - Chat with the agent to request changes (e.g., "Add a `shard_id` column").
    - Click "Apply Fix" or "Review Fix" when the agent proposes code changes.
6.  **Migrate**: 
    - Once satisfied, click "Migrate" to deploy the schema to a new Google Cloud Spanner database.

## 🤝 Contributing
We welcome contributions! Please follow the `standard` code style and ensured all new features have appropriate tests.
