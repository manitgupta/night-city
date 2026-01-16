# <img src="schema-agent-ui/assets/logo.png" width="48" height="48" style="vertical-align: middle;" /> Night City: Agentic Spanner Migration Assistant

**Night City** is an intelligent, human-in-the-loop migration assistant designed to modernize legacy databases for Google Cloud Spanner. It combines a powerful LLM-based agent with a developer-focused UI to make both **Schema Migration** and **Query Conversion** interactive and seamless.

<p align="center">
  <img src="schema-agent-ui/assets/output.gif" alt="Demo" />
</p>

## 🚀 Key Features

### 1. Dual-Mode Migration
Night City provides two distinct, specialized workflows:
- **Schema Conversion**: Migrate DDL (Tables, Indexes, Constraints) from legacy databases to Spanner.
- **Query Conversion**: Translate complex SQL queries to optimized Spanner GoogleSQL.

### 2. Agentic Intelligence
- **Smart Validation Loop**: The agent doesn't just guess. It generates code, *automatically verifies* it against a real Spanner instance, and self-corrects errors in a multi-turn loop until the result is valid.
- **Context-Aware Chat**: Ask specific questions about your code (e.g., "Why did you choose `INT64` here?") by selecting it in the editor.
- **Analyze & Fix**: If you encounter an error (or the agent does), it performs a deep root-cause analysis and proposes a structured fix that you can review and apply with one click.

### 3. Developer Experience
- **Live Spanner Integration**: Connect directly to your Google Cloud Spanner instance to validate DDL and execute queries in real-time.
- **IDE-like Interface**: Dark-mode Monaco editors with syntax highlighting, diff views, and dual-pane layouts.
- **One-Click Migration**: Deploy your validated schema to a new Spanner database directly from the UI.

## ✅ Supported Dialects
Night City supports conversion from:
- **PostgreSQL**
- **MySQL**
- **Oracle**
- **SQL Server**
- **Cassandra**

## 🏗️ Architecture

The project consists of two main components:

1.  **Backend (`schema-agent-backend`)**: A FastAPI Python service hosting the AI agent.
    -   **Agent**: Uses Google Gemini Pro (1.5/2.0) with Tool Use capabilities.
    -   **Spanner Tool**: Interfaces with Cloud Spanner for validation and query execution.
    -   **Streaming**: Uses Server-Sent Events (NDJSON) to stream agent "thoughts" and logs to the UI.

2.  **Frontend (`schema-agent-ui`)**: A React + Vite application.
    -   **State Management**: Zustand global store.
    -   **Components**: Specialized editors for DDL and SQL, chat interface, and rigorous state management for spanner sessions.

## 🛠️ Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 16+
- Google Cloud Project with Spanner API enabled
- [Gemini API Key](https://ai.google.dev/gemini-api/docs/api-key)
- Docker (optional)

### 1. Environment Configuration
Create a `.env` file in the root directory.

```env
# Google Cloud Configuration
SPANNER_PROJECT_ID="your-project-id"
SPANNER_INSTANCE_ID="your-instance-id"

# Model Configuration
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-3-pro-preview" # or gemini-1.5-pro
```

### 2. Running Locally

#### Backend
```bash
cd schema-agent-backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

#### Frontend
```bash
cd schema-agent-ui
npm install
npm run dev
```

### 3. Deploying to Google Cloud Run
```bash
gcloud run deploy night-city \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_API_KEY=your-key,SPANNER_PROJECT_ID=your-project,SPANNER_INSTANCE_ID=your-instance"
```

## 💡 Usage Guide

### Schema Conversion
1.  **Paste Schema**: Input your source DDL (MySQL/Postgres/etc).
2.  **Convert**: The agent will generate Spanner DDL.
3.  **Validate**: The agent automatically attempts basic validation, but you can manually trigger "Validate" against your Spanner instance.
4.  **Migrate**: Use the "Migrate" button to apply the schema to a new database.

### Query Conversion
1.  **Select Mode**: Switch to "Query Conversion" from the landing page.
2.  **Paste Query**: Input your legacy SQL query.
3.  **Connect Spanner**: Ensure you are connected to the target Spanner database (to verify column existence/types).
4.  **Convert**: The agent will generate the equivalent GoogleSQL.
5.  **Run**: Click "Validate" (or Run) to execute the query specifically against your Spanner database and see live results.

## 🤝 Contributing
Contributions are welcome! Please ensure tests are added for new features.
