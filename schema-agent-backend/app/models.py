from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class ConversionRequest(BaseModel):
    source_ddl: str
    source_dialect: str
    verify_ddl: bool = False

class ConversionResponse(BaseModel):
    converted_ddl: str
    logs: List[str]

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
