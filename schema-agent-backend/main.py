from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv


import os
import logging
from pathlib import Path

# Setup logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load .env from project root
# We use resolve() to get the absolute path of main.py, then go up one level to project root
base_dir = Path(__file__).resolve().parent
env_path = base_dir.parent / '.env'

if env_path.exists():
    logger.info(f"Loading environment from {env_path}")
    load_dotenv(dotenv_path=env_path, override=True)
else:
    logger.warning(f"No .env file found at {env_path}")


# Mandatory Environment Variables
REQUIRED_ENV_VARS = ["GEMINI_API_KEY", "SPANNER_PROJECT_ID", "SPANNER_INSTANCE_ID"]

# Import app modules AFTER loading environment variables
# This ensures that any module-level initialization (like ADK Agent) picks up the correct env vars
from app.agent import agent_service
from app.models import ConversionRequest, ConversionResponse, ChatRequest, ChatResponse, AnalyzeRequest, AnalyzeResponse, SpannerConnectionConfig, SpannerConnectionResponse, QueryConversionRequest, SpannerQueryRequest, AppMigrationRequest
from app.session_store import SessionStore

from app.query.spanner_tool import SpannerDatabaseTool
import uuid



app = FastAPI()

@app.on_event("startup")
async def startup_event():
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        logger.info(f"Startup: Loaded GEMINI_API_KEY starting with: {api_key[:10]}...")
    else:
        logger.error("Startup: GEMINI_API_KEY is NOT set.")
        
    missing_vars = [var for var in REQUIRED_ENV_VARS if not os.getenv(var)]

    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing_vars)}")


# Input CORS here (wildcard for dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Serve static files from the "static" directory (which will contain the built React app)
# We mount it at /static just in case, but really we want the root catch-all.
# Actually, standard pattern is to mount /assets (vite output) and then have a catch-all.

static_dir = Path("app/static")
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")



@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/convert")
async def convert_schema(request: ConversionRequest):
    try:
        from fastapi.responses import StreamingResponse
        import json

        async def generate():
            async for chunk in agent_service.convert_schema_stream(
                request.source_ddl, 
                request.source_dialect
            ):
                yield json.dumps(chunk) + "\n"

        return StreamingResponse(generate(), media_type="application/x-ndjson")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        result = await agent_service.chat(
            request.message,
            source_ddl=request.source_ddl,
            output_ddl=request.output_ddl,
            selection=request.selection
        )
        # Result is now a dict or object matching keys of ChatResponse
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/multi_turn_convert_schema_stream")
async def multi_turn_convert_schema_stream(request: ConversionRequest):
    try:
        from fastapi.responses import StreamingResponse
        import json

        async def generate():
            async for chunk in agent_service.multi_turn_convert_schema_stream(
                request.source_ddl, 
                request.source_dialect
            ):
                yield json.dumps(chunk) + "\n"

        return StreamingResponse(generate(), media_type="application/x-ndjson")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/multi_turn_convert_schema_stream_v2")
async def multi_turn_convert_schema_stream_v2(request: ConversionRequest):
    try:
        from fastapi.responses import StreamingResponse
        import json

        async def generate():
            async for chunk in agent_service.multi_turn_convert_schema_stream_v2(
                request.source_ddl, 
                request.source_dialect
            ):
                yield json.dumps(chunk) + "\n"

        return StreamingResponse(generate(), media_type="application/x-ndjson")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/multi_turn_convert_query_stream_v2")
async def multi_turn_convert_query_stream_v2(request: QueryConversionRequest):
    try:
        from fastapi.responses import StreamingResponse
        import json

        async def generate():
            async for chunk in agent_service.multi_turn_convert_query_stream(
                request.source_query,
                request.spanner_session_id,
                request.source_dialect
            ):
                yield json.dumps(chunk) + "\n"

        return StreamingResponse(generate(), media_type="application/x-ndjson")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

active_migrations = {}

@app.post("/api/migrate-app")
async def migrate_app(request: AppMigrationRequest):
    try:
        from fastapi.responses import StreamingResponse
        import json
        from app.workspace_manager import WorkspaceManager
        from app.migration_agent import AppMigrationAgent

        async def generate():
            wm = WorkspaceManager()
            try:
                # 1. Setup Workspace
                if request.local_directory:
                    yield json.dumps({"type": "live_activity", "content": f"Copying local directory {request.local_directory}..."}) + "\n"
                    workspace_path = wm.create_workspace_from_local(request.local_directory)
                    yield json.dumps({"type": "live_activity", "content": f"Directory copied successfully to temporary workspace."}) + "\n"
                elif request.github_url:
                    yield json.dumps({"type": "live_activity", "content": f"Cloning repository {request.github_url}..."}) + "\n"
                    workspace_path = wm.create_workspace(request.github_url)
                    yield json.dumps({"type": "live_activity", "content": f"Repository cloned successfully to temporary workspace."}) + "\n"
                else:
                    raise ValueError("Either github_url or local_directory must be provided")
                
                # 2. Start Agent
                agent = AppMigrationAgent(
                    workspace_dir=workspace_path,
                    custom_instructions=request.custom_instructions
                )
                
                if request.migration_id:
                    active_migrations[request.migration_id] = agent
                    
                yield json.dumps({"type": "live_activity", "content": "Initializing Migration Agent..."}) + "\n"
                
                async for chunk in agent.migrate_app_stream():
                    yield json.dumps(chunk) + "\n"
                    
                yield json.dumps({"type": "live_activity", "content": "Migration process completed."}) + "\n"
            except Exception as e:
                logger.error(f"Migration failed: {e}")
                yield json.dumps({"type": "error", "content": f"Migration failed: {str(e)}"}) + "\n"
            finally:
                if request.migration_id and request.migration_id in active_migrations:
                    del active_migrations[request.migration_id]
                # 3. Cleanup Deferred for Download
                # We return the workspace path in the final chunk so the UI can trigger a download
                yield json.dumps({"type": "live_activity", "content": f"Workspace {workspace_path} preserved for download."}) + "\n"

        return StreamingResponse(generate(), media_type="application/x-ndjson")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download-workspace")
async def download_workspace(workspace_path: str, background_tasks: BackgroundTasks):
    from fastapi.responses import FileResponse
    import shutil
    import os
    
    if not workspace_path or not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="Workspace not found or already cleaned up.")
        
    try:
        # Create a zip archive of the workspace
        # We'll store the zip in the parent directory temporarily
        parent_dir = os.path.dirname(workspace_path)
        base_name = os.path.basename(workspace_path)
        zip_path = os.path.join(parent_dir, f"{base_name}_migrated")
        
        # shutil.make_archive adds the .zip extension
        created_zip = shutil.make_archive(zip_path, 'zip', workspace_path)
        
        # Cleanup routine to run after the response is sent
        def cleanup():
            try:
                if os.path.exists(workspace_path):
                    shutil.rmtree(workspace_path)
                if os.path.exists(created_zip):
                    os.remove(created_zip)
            except Exception as e:
                logger.error(f"Failed to cleanup after download: {e}")
                
        background_tasks.add_task(cleanup)
        
        return FileResponse(
            path=created_zip,
            filename="migrated_app.zip",
            media_type="application/zip",
            background=background_tasks
        )
    except Exception as e:
         logger.error(f"Failed to create workspace zip: {e}")
         raise HTTPException(status_code=500, detail="Failed to prepare download")

@app.post("/api/stop-migration/{migration_id}")
async def stop_migration(migration_id: str):
    if migration_id in active_migrations:
        active_migrations[migration_id].stop_requested = True
        return {"success": True, "message": "Migration stop requested."}
    else:
        raise HTTPException(status_code=404, detail="Migration not found or already completed.")

from pydantic import BaseModel

class ValidateRequest(BaseModel):
    ddl: str

class MigrateRequest(BaseModel):
    project_id: str
    instance_id: str
    database_id: str
    ddl: str

class MigrateResponse(BaseModel):
    success: bool
    message: str
    database_uri: str = ""

class ConfigResponse(BaseModel):
    spanner_project_id: str
    spanner_instance_id: str


@app.post("/validate")
async def validate_ddl(request: ValidateRequest, background_tasks: BackgroundTasks):
    try:
        from app.spanner_tool import SpannerVerificationTool
        verifier = SpannerVerificationTool()
        result = await verifier.verify_ddl(request.ddl, background_tasks)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze_error", response_model=AnalyzeResponse)
async def analyze_error(request: AnalyzeRequest):
    try:
        result = await agent_service.analyze_fix(
            request.source_ddl,
            request.generated_ddl,
            request.error_message
        )
        return AnalyzeResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ConfidenceRequest(BaseModel):
    source_code: str
    target_code: str
    conversion_report: str
    type: str # 'schema' or 'query'

class ConfidenceResponse(BaseModel):
    score: int
    explanation: str

@app.post("/confidence", response_model=ConfidenceResponse)
async def get_confidence_score(request: ConfidenceRequest):
    try:
        result = await agent_service.calculate_confidence_score(
            request.source_code,
            request.target_code,
            request.conversion_report,
            request.type
        )
        return ConfidenceResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/migrate", response_model=MigrateResponse)
async def migrate_database(request: MigrateRequest):
    try:
        from app.spanner_tool import SpannerMigrationTool
        tool = SpannerMigrationTool()
        result = await tool.migrate_database(
            request.project_id,
            request.instance_id,
            request.database_id,
            request.ddl
        )
        return MigrateResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/config", response_model=ConfigResponse)
async def get_config():
    return ConfigResponse(
        spanner_project_id=os.getenv("SPANNER_PROJECT_ID", ""),
        spanner_instance_id=os.getenv("SPANNER_INSTANCE_ID", "")
    )



@app.post("/spanner/connect", response_model=SpannerConnectionResponse)
async def connect_spanner(config: SpannerConnectionConfig):
    try:
        # Create tool and verify
        tool = SpannerDatabaseTool(config)
        is_valid = await tool.verify_connection()
        
        if not is_valid:
             return SpannerConnectionResponse(
                success=False,
                message="Failed to connect to Spanner database. Check credentials and permissions."
            )
            
        # Store in session
        session_id = str(uuid.uuid4())
        SessionStore.get_instance().set_tool(session_id, tool)
        
        return SpannerConnectionResponse(
            success=True,
            message="Successfully connected to Spanner database",
            session_id=session_id
        )
    except Exception as e:
        logger.error(f"Spanner Connection Error: {e}")
        return SpannerConnectionResponse(
            success=False,
            message=f"Connection Error: {str(e)}"
        )

@app.post("/spanner/query")
async def run_spanner_query_endpoint(request: SpannerQueryRequest):
    try:
        session_id = request.session_id
        tool = SessionStore.get_instance().get_tool(session_id)
        
        if not tool:
            raise HTTPException(status_code=404, detail="Spanner session not found. Please reconnect.")
            
        # Run query using the tool
        result = await tool.run_query(request.sql)
        return result
    except Exception as e:
        logger.error(f"Spanner Query Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def serve_root():
    if static_dir.exists():
        index_path = static_dir / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
    return {"message": "Welcome to Night City Schema Agent API. Please check documentation for API usage."}

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Check if file exists in static dir
    if static_dir.exists():
        file_path = static_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        
        # SPA Fallback: If not found, serve index.html
        index_path = static_dir / "index.html"
        if index_path.exists():
            return FileResponse(index_path)

    return {"status": "not found", "message": "Static content not found"}
