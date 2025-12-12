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

from app.prompts import generate_cot_prompt
from app.context_manager import context_manager

# ... (Logging config remains same)

class SchemaAgentService:
    _instance = None

    def __init__(self):
        self.model_name = "gemini-3-pro-preview"
        # ADK Agent
        self.agent = Agent(
            name="SchemaAgent",
            model=self.model_name,
            static_instruction="You are an expert Database Engineer specialized in migrating SQL schemas to Google Cloud Spanner. You provide clear, correct Spanner DDL. You MUST IGNORE database-level commands (CREATE DATABASE, USE, etc) and focus only on schema objects.",
        )
        self.active_chats: Dict[str, Any] = {}

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
        
        # Get Key Hints based on Source DDL and Dialect
        ddl_hints = context_manager.get_ddl_hints(source_ddl)
        feature_hints = context_manager.get_feature_hints(source_ddl)
        mapping_rules = context_manager.get_mapping_rules(dialect)
        
        formatted_hints = context_manager.format_hints_for_prompt(ddl_hints, feature_hints, mapping_rules)
        
        if formatted_hints:
            logger.info(f"Found {len(ddl_hints)} DDL hints, {len(feature_hints)} Feature hints, {len(mapping_rules)} Mapping rules.")
            logs.append(f"Injected {len(ddl_hints)} DDL hints, {len(feature_hints)} Feature hints, {len(mapping_rules)} Mapping rules.")
        else:
            logger.info("No specific hints found.")
        
        # Initial Prompt with CoT and Hints
        prompt = generate_cot_prompt(source_ddl, dialect, hints=formatted_hints)
        
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
            # Log the thought process briefly (or full debug)
            logger.info("Received response from agent")
            
            extracted_ddl = self._extract_sql(response_text)
            
            if not extracted_ddl:
                logs.append("Error: No SQL block found in agent response.")
                break
                
            current_ddl = extracted_ddl
            
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
                # For retry, we give it the error and ask to fix
                prompt = f"""
                The previous DDL had the following errors:
                {errors}
                
                Please fix the DDL based on your previous analysis. 
                Provide the corrected version in a ```sql block.
                """
        
        return {
            "converted_ddl": current_ddl,
            "logs": logs,
            # We could optionally return the full "thoughts" if we wanted to show them in UI
            # "full_response": response_text 
        }

    async def chat(self, message: str, source_ddl: Optional[str] = None, output_ddl: Optional[str] = None, selection: Optional[Dict[str, Any]] = None) -> str:
        # Same chat logic, just ensuring imports are correct
        # ... (keeping existing chat logic mostly as is, just ensuring prompt flow works)
        logger.info(f"Received chat message: {message[:50]}...")
        
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
        """

        from google import genai
        client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        
        chat = client.chats.create(
            model=self.model_name,
            config=types.GenerateContentConfig(
                system_instruction="You are an expert Database Engineer specialized in migrating SQL schemas to Google Cloud Spanner. You provide clear, correct Spanner DDL. You MUST IGNORE database-level commands (CREATE DATABASE, USE, etc) and focus only on schema objects."
            )
        )
        response = chat.send_message(full_prompt)
        return response.text

    async def analyze_fix(self, source_ddl: str, generated_ddl: str, error_message: str) -> Dict[str, str]:
        """
        Analyzes validation error and returns explanation + fix.
        """
        from app.prompts import generate_analyze_prompt
        import json
        import re

        prompt = generate_analyze_prompt(
            source_ddl=source_ddl,
            generated_ddl=generated_ddl,
            error_message=error_message
        )
        
        from google import genai
        client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        
        chat = client.chats.create(
            model=self.model_name,
            config=types.GenerateContentConfig(
                response_mime_type="application/json" 
            )
        )
        response = chat.send_message(prompt)
        text = response.text
        
        try:
            # Clean potential markdown
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[0]
                
            return json.loads(text)
        except Exception as e:
            logger.error(f"Failed to parse analysis JSON: {e}")
            return {
                "explanation": "Failed to parse model response.",
                "fixed_ddl": generated_ddl # Fallback
            }

    def _extract_sql(self, text: str) -> str:
        """
        Extracts SQL from markdown code blocks. 
        Supports ```sql and ``` blocks.
        Finds the LAST block if multiple exist (often the final result after reasoning),
        OR the largest block.
        For CoT, usually the last block is the final output.
        """
        import re
        
        # Regex for ```sql ... ``` or ``` ... ```
        # Flags: dotall (dot matches newline)
        matches = re.findall(r"```(?:sql)?\s*(.*?)```", text, re.DOTALL)
        
        if not matches:
            return text.strip() # Fallback: return whole text if no blocks
            
        # Heuristic: Return the longest block, as it's likely the full DDL.
        # Alternatively, prompt instructions say "Output the final clean DDL inside a ```sql block"
        # usually at the end.
        longest_match = max(matches, key=len)
        return longest_match.strip()

# Global instance
agent_service = SchemaAgentService.get_instance()
