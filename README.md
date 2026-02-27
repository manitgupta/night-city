# <img src="schema-agent-ui/assets/logo.png" width="48" height="48" style="vertical-align: middle;" /> Night City: Agentic Spanner Migration Assistant

**Night City** is an intelligent, human-in-the-loop migration assistant designed to modernize legacy databases and their associated applications for Google Cloud Spanner. It combines a powerful LLM-based agent with a developer-focused UI to make **Schema Migration**, **Query Conversion**, and **Application Migration** interactive and seamless.

<p align="center">
  <img src="schema-agent-ui/assets/output.gif" alt="Demo" />
</p>

## 🚀 Key Features

### 1. Comprehensive Migration Workflows
Night City provides three distinct, specialized workflows, tackling migration challenges in order of their increasing complexity:
- **Schema Conversion**: Migrate legacy DDL (Tables, Indexes, Constraints) to Spanner-optimized schemas.
- **Query Conversion**: Translate complex legacy SQL queries into performant Spanner GoogleSQL.
- **Application Migration**: Automatically refactor entire application codebases (via GitHub URL or local directory) to integrate with Google Cloud Spanner's client libraries and best practices.

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

### 3. Deploying to Google Cloud Run (with Spanner Emulator Sidecar)

To allow the migration agent to run compatibility tests natively, we deploy the app alongside a Cloud Spanner emulator using Cloud Run's multi-container (sidecar) feature. Our container also includes a `start.sh` pre-boot script to automatically provision a test instance inside the emulator sidecar before the app starts.

#### Step 1: Build the Image
Before deploying, you **must** build and submit your container image to Artifact Registry or Container Registry:
```bash
gcloud builds submit --tag gcr.io/your-project-id/night-city
```

#### Step 2: Define the Service Infrastructure
Define the multi-container configuration in `services.yaml`. *Note: You only need to apply this file when making structural changes like adding new containers, modifying memory/CPU limits, or updating environment variables.*

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: night-city
  labels:
    cloud.googleapis.com/location: us-central1
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/container-dependencies: '{"migration-agent": ["spanner-emulator"]}'
        run.googleapis.com/execution-environment: gen2
    spec:
      timeoutSeconds: 3600
      containers:
        - image: gcr.io/your-project-id/night-city
          name: migration-agent
          ports:
            - containerPort: 8080
          resources:
            limits:
              cpu: "6"
              memory: "24Gi"
          env:
            - name: GEMINI_API_KEY
              value: "your-gemini-api-key"
            - name: SPANNER_PROJECT_ID
              value: "your-project-id"
            - name: SPANNER_INSTANCE_ID
              value: "your-instance-id"
            - name: SPANNER_EMULATOR_HOST
              value: "localhost:9010"
        - image: gcr.io/cloud-spanner-emulator/emulator
          name: spanner-emulator
          resources:
            limits:
              cpu: "2"
              memory: "8Gi"
          startupProbe:
            tcpSocket:
              port: 9010
            initialDelaySeconds: 2
            timeoutSeconds: 2
            periodSeconds: 2
            failureThreshold: 10
```

Apply the infrastructure changes:
```bash
gcloud run services replace services.yaml
```

#### Step 3: Deploying Code Updates (The Latest Image)
If you only changed application code (and ran Step 1 to rebuild the image), using `services replace` will **not** deploy your new code if the `:latest` tag is cached.

Instead, use the `deploy` command to force Cloud Run to resolve the newest SHA256 digest of your image and deploy exactly that:
```bash
gcloud run deploy night-city \
  --image gcr.io/your-project-id/night-city:latest \
  --region us-central1 \
  --project your-project-id
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

### Application Migration
1.  **Select Mode**: Switch to "App Migration" from the landing page.
2.  **Provide Source**: Input a GitHub repository URL or provide a local directory path.
3.  **Migrate**: The agent iteratively refactors your code, identifying database interactions and rewriting them for Spanner.
4.  **Guide the Agent**: Provide real-time guidance via the chat interface to steer the agent's technical decisions during migration.
5.  **Review**: Inspect the refactored workspace, execute the application against a Spanner Emulator, and verify the modernized codebase.

## 🤝 Contributing
Contributions are welcome! Please ensure tests are added for new features.
