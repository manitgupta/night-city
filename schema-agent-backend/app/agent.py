import os
import logging
from typing import Dict, Any, List, Optional
from google.adk import Agent
from google.genai import types
from toolbox_core import ToolboxClient
from app.tools import SpannerVerificationTool

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SchemaAgentService:
    _instance = None

    def __init__(self):
        self.model_name = "gemini-3-pro-preview"
        # ADK Agent
        # We can configure tools here. For now starting with basic agent.
        # Tools will be added dynamically or at init.
        self.agent = Agent(
            name="SchemaAgent",
            model=self.model_name,
            static_instruction="You are an expert Database Engineer specialized in migrating SQL schemas to Google Cloud Spanner. You provide clear, correct Spanner DDL.",
            # tools=[...] # We will add MCP tools here
        )
        
        # In ADK, 'Agent' manages state via 'InvocationContext' if using 'run_async'.
        # For simplified usage in this API service, we might need to manage session/context manually 
        # or use ADK's native flow if we can persist the context object.
        # For this MVP, we will treat each request as a new turn in a maintained history list
        # BUT ADK agents are often designed to run a full flow.
        
        # We will use a simple in-memory CLI-like store for active chats for now to demonstrate "Pair Programming"
        self.active_chats: Dict[str, Any] = {} # session_id -> history/context
        
        # Toolbox Client
        self.toolbox_client = None 
        # self.toolbox_client = ToolboxClient(...) # Initialize if server details known

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def convert_schema(self, source_ddl: str, dialect: str, verify_ddl: bool = False) -> Dict[str, Any]:
        """
        Orchestrates conversion with verification loop.
        """
        logs = []
        logger.info(f"Starting conversion for dialect: {dialect}, verify_ddl={verify_ddl}")
        logger.info(f"Source DDL: {source_ddl[:50]}...")
        
        # Initial Prompt
        prompt = f"""
        You are an expert Database Engineer. Convert this {dialect} DDL to Google Cloud Spanner DDL.
        
        Source DDL:
        ```sql
        {source_ddl}
        ```
        """
        
        # Verifier is now initialized at module level or top of method if preferred, 
        # but let's keep it simple.
        verifier = SpannerVerificationTool()
        
        current_ddl = ""
        attempt = 0
        max_attempts = 3 if verify_ddl else 1
        
        while attempt < max_attempts:
            attempt += 1
            logs.append(f"Attempt {attempt}: Generating DDL...")
            
            # Call Agent
            logger.info(f"Sending prompt to agent (Attempt {attempt})")
            response_text = await self.chat(prompt)
            logger.info("Received response from agent")
            current_ddl = self._extract_sql(response_text)
            
            if not verify_ddl:
                logs.append("Verification skipped (user disabled).")
                break

            # Verify
            verification = await verifier.verify_ddl(current_ddl)
            if verification["valid"]:
                logs.append("Verification passed!")
                break
            else:
                errors = "\n".join(verification["errors"])
                logs.append(f"Verification failed: {errors}")
                prompt = f"""
                The generated DDL had the following errors:
                {errors}
                
                Please fix the DDL and provide the corrected version in a ```sql block.
                """
        
        return {
            "converted_ddl": current_ddl,
            "logs": logs
        }

    async def chat(self, message: str, source_ddl: Optional[str] = None, output_ddl: Optional[str] = None, selection: Optional[Dict[str, Any]] = None) -> str:
        logger.info(f"Received chat message: {message[:50]}...")
        
        # Build Context-Aware Prompt
        context_parts = []
        if source_ddl:
            context_parts.append(f"SOURCE_DDL:\n```sql\n{source_ddl}\n```")
        if output_ddl:
            context_parts.append(f"CURRENT_SPANNER_DDL:\n```sql\n{output_ddl}\n```")
        
        if selection:
            sel_code = selection.get("code", "")
            sel_source = selection.get("source", "unknown")
            sel_lines = f"{selection.get('startLine')}-{selection.get('endLine')}"
            context_parts.append(f"USER_SELECTION (from {sel_source} lines {sel_lines}):\n```sql\n{sel_code}\n```\nUser is specifically referring to this selection.")

        system_context = "\n\n".join(context_parts)
        full_prompt = f"""
        {system_context}
        
        USER QUERY: {message}
        
        Answer the user's query based on the provided schema context.
        If they ask for a fix, provide specific DDL snippets.
        """

        # Simple stateless chat for now (or persistent via client.chats)
        from google import genai
        client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        
        # TODO: Persist chat object properly
        chat = client.chats.create(
            model=self.model_name,
            config=types.GenerateContentConfig(
                system_instruction="You are an expert Database Engineer specialized in migrating SQL schemas to Google Cloud Spanner. You provide clear, correct Spanner DDL."
            )
        )
        response = chat.send_message(full_prompt)
        return response.text

    def _extract_sql(self, text: str) -> str:
        if "```sql" in text:
            return text.split("```sql")[1].split("```")[0].strip()
        if "```" in text:
            return text.split("```")[1].split("```")[0].strip()
        return text

# Global instance
agent_service = SchemaAgentService.get_instance()
