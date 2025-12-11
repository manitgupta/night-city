from pydantic import BaseModel
from typing import List, Optional, Any

class ConversionRequest(BaseModel):
    source_ddl: str
    source_dialect: str  # e.g., 'mysql', 'postgres', 'oracle'

class ConversionResponse(BaseModel):
    converted_ddl: str
    logs: List[str] = []
    error: Optional[str] = None

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    # We might add 'context_used' or debugging info here later
