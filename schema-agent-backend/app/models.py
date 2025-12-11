from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class ConversionRequest(BaseModel):
    source_ddl: str
    source_dialect: str

class ConversionResponse(BaseModel):
    converted_ddl: str
    logs: List[str]

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
