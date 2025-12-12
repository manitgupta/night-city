from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.agent import agent_service
from app.models import ConversionRequest, ConversionResponse, ChatRequest, ChatResponse, AnalyzeRequest, AnalyzeResponse

import os
from pathlib import Path

# Load .env from current directory or parent directory
env_path = Path('.') / '.env'
if not env_path.exists():
    env_path = Path('..') / '.env'
load_dotenv(dotenv_path=env_path)

app = FastAPI()

# Input CORS here (wildcard for dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/convert", response_model=ConversionResponse)
async def convert_schema(request: ConversionRequest):
    try:
        result = await agent_service.convert_schema(
            request.source_ddl, 
            request.source_dialect, 
            verify_ddl=request.verify_ddl
        )
        return ConversionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        response_text = await agent_service.chat(
            request.message,
            source_ddl=request.source_ddl,
            output_ddl=request.output_ddl,
            selection=request.selection
        )
        return ChatResponse(response=response_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

@app.post("/validate")
async def validate_ddl(request: ValidateRequest):
    try:
        from app.tools import SpannerVerificationTool
        verifier = SpannerVerificationTool()
        result = await verifier.verify_ddl(request.ddl)
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

@app.post("/migrate", response_model=MigrateResponse)
async def migrate_database(request: MigrateRequest):
    try:
        from app.tools import SpannerMigrationTool
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
