from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class ConversionRequest(BaseModel):
    source_ddl: str
    source_dialect: str

class ConversionResponse(BaseModel):
    converted_ddl: str
    logs: List[str]
    report: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    source_ddl: Optional[str] = None
    output_ddl: Optional[str] = None
    selection: Optional[Dict[str, Any]] = None  # {code, startLine, endLine, source}

class SuggestedFix(BaseModel):
    explanation: str
    fixed_ddl: str

class ChatResponse(BaseModel):
    response: str
    suggested_fix: Optional[SuggestedFix] = None

class ValidateRequest(BaseModel):
    ddl: str

class AnalyzeRequest(BaseModel):
    source_ddl: str
    generated_ddl: str
    error_message: str

class AnalyzeResponse(BaseModel):
    explanation: str
    fixed_ddl: str



class SpannerConnectionConfig(BaseModel):
    project_id: str
    instance_id: str
    database_id: str

class SpannerConnectionResponse(BaseModel):
    success: bool
    message: str
    session_id: Optional[str] = None

class QueryConversionRequest(BaseModel):
    source_query: str
    spanner_session_id: str
    source_dialect: Optional[str] = None

class SpannerQueryRequest(BaseModel):
    session_id: str
    sql: str

class AppMigrationRequest(BaseModel):
    github_url: str
