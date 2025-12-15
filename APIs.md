# Backend API Documentation

This document outlines the API endpoints provided by the `schema-agent-backend` application. The backend is built using FastAPI and exposes endpoints for schema conversion, chat interaction, validation, and database migration.

## Base URL
The API is typically served at `http://localhost:8001` (or the configured port).

## Endpoints

### 1. Health Check
Checks if the API is running and responsive.

- **URL**: `/health`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "status": "ok"
  }
  ```

### 2. Convert Schema
Converts a source SQL schema (MySQL, PostgreSQL, Oracle, SQL Server, Cassandra) to Google Cloud Spanner DDL.

- **URL**: `/convert`
- **Method**: `POST`
- **Request Body**: `ConversionRequest`
  ```json
  {
    "source_ddl": "string",     // The input SQL schema
    "source_dialect": "string"  // Source dialect (e.g., 'mysql', 'postgres')
  }
  ```
- **Response**: Streaming Response (`application/x-ndjson`)
  The response is a stream of newline-delimited JSON objects.
  - **Types**:
    - `thought`: Represents the agent's internal reasoning.
    - `log`: detailed logs of the process.
    - `result`: The final conversion output (only if fully successful/buffered).

### 3. Chat with Agent
Allows the user to chat with the agent for schema refinement or questions.

- **URL**: `/chat`
- **Method**: `POST`
- **Request Body**: `ChatRequest`
  ```json
  {
    "message": "string",
    "source_ddl": "string",       // Optional context
    "output_ddl": "string",       // Optional context
    "selection": {                // Optional active selection in editor
      "code": "string",
      "startLine": 0,
      "endLine": 0,
      "source": "string"
    }
  }
  ```
- **Response**: `ChatResponse`
  ```json
  {
    "response": "string",
    "suggested_fix": {            // Optional
      "explanation": "string",
      "fixed_ddl": "string"
    }
  }
  ```

### 4. Validate DDL
Validates the generated Spanner DDL using a real Spanner instance (dry-run or verification tool).

- **URL**: `/validate`
- **Method**: `POST`
- **Request Body**: `ValidateRequest`
  ```json
  {
      "ddl": "string"
  }
  ```
- **Response**: JSON Object
  ```json
  {
    "valid": boolean,
    "errors": ["string"]
  }
  ```

### 5. Analyze Error
Analyzes validation errors using the agent to propose a fix.

- **URL**: `/analyze_error`
- **Method**: `POST`
- **Request Body**: `AnalyzeRequest`
  ```json
  {
    "source_ddl": "string",
    "generated_ddl": "string",
    "error_message": "string"
  }
  ```
- **Response**: `AnalyzeResponse`
  ```json
  {
    "explanation": "string",
    "fixed_ddl": "string"
  }
  ```

### 6. Migrate Database
Creates a new Spanner database and applies the DDL.

- **URL**: `/migrate`
- **Method**: `POST`
- **Request Body**: `MigrateRequest`
  ```json
  {
    "project_id": "string",
    "instance_id": "string",
    "database_id": "string",
    "ddl": "string"
  }
  ```
- **Response**: `MigrateResponse`
  ```json
  {
    "success": boolean,
    "message": "string",
    "database_uri": "string"
  }
  ```

### 7. Get Configuration
Retrieves the current backend configuration (project and instance IDs).

- **URL**: `/config`
- **Method**: `GET`
- **Response**: `ConfigResponse`
  ```json
  {
    "spanner_project_id": "string",
    "spanner_instance_id": "string"
  }
  ```

## Data Models

### ConversionRequest
- `source_ddl` (str): The SQL schema to convert.
- `source_dialect` (str): The dialect of the input SQL (e.g., 'mysql', 'postgres').

### ChatRequest
- `message` (str): User's message.
- `source_ddl` (Optional[str]): Source schema context.
- `output_ddl` (Optional[str]): Current Spanner schema context.
- `selection` (Optional[Dict]): Details of text selected in the editor.

### ChatResponse
- `response` (str): Agent's reply.
- `suggested_fix` (Optional[SuggestedFix]): Structured fix proposal if applicable.

### SuggestedFix / AnalyzeResponse
- `explanation` (str): Description of the change.
- `fixed_ddl` (str): The modified full DDL.
