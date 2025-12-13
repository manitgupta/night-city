import os
import logging
from typing import Dict, Any, List, Optional
from google.adk import Agent
from google.genai import types
from toolbox_core import ToolboxClient


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

    async def convert_schema(self, source_ddl: str, dialect: str) -> Dict[str, Any]:
        """
        Orchestrates conversion.
        """
        logs = []
        logger.info(f"Starting conversion for dialect: {dialect}")
        
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
        
        logs.append(f"Generating DDL...")
        
        # Call Agent
        logger.info(f"Sending prompt to agent")
        # Direct generation call to avoid chat tools/system logic which is for interactive mode
        from google import genai
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        
        response = client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1 # Low temp for code
            )
        )
        
        response_text = response.text
        # Log the thought process briefly (or full debug)
        logger.info("Received response from agent")
        
        extracted_ddl = self._extract_sql(response_text)
        
        if not extracted_ddl:
            logs.append("Error: No SQL block found in agent response.")
            current_ddl = ""
        else:
            current_ddl = extracted_ddl
            
        # Extract report from the response
        report = self._extract_report(response_text)

        return {
            "converted_ddl": current_ddl,
            "logs": logs,
            "report": report
        }

    async def chat(self, message: str, source_ddl: Optional[str] = None, output_ddl: Optional[str] = None, selection: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
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

        # Define the tool for the model
        def suggest_changes(explanation: str, fixed_ddl: str):
            """
            Propose changes to the Spanner DDL.
            Use this tool when the user asks to modify the schema (e.g. rename columns, change types, add tables).
            
            Args:
                explanation: A clear explanation of what changes were made and why.
                fixed_ddl: The complete, valid Spanner DDL matching the new requirements.
            """
            return {"explanation": explanation, "fixed_ddl": fixed_ddl}

        tools = [suggest_changes]

        from google import genai
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        
        # We need to act as a proxy for the chat session vs single turn
        # For simplicity in this stateless API, we'll treat it as a single turn with history if we had it,
        # but here we just send the full prompt.
        
        # ACTUALLY, to use tools effectively with the new SDK, we should use the chat context or generate_content
        # Let's use generate_content with tools config
        
        response = client.models.generate_content(
            model=self.model_name,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                tools=tools,
                system_instruction="""You are an expert Database Engineer specialized in migrating SQL schemas to Google Cloud Spanner. 
                
                YOUR GOAL: Provide clear, correct Spanner DDL. 
                
                RULES:
                1. IGNORE database-level commands (CREATE DATABASE, USE, etc).
                2. Focus only on schema objects.
                3. CRITICAL: If the user requests ANY change to the schema (e.g., rename column, change type, add table, fix error), you MUST use the 'suggest_changes' tool. 
                4. IMPORTANT: If you use the tool, ALSO output the full valid Spanner DDL in the text response as a markdown block. This ensures the user sees the code.
                5. If the user is just asking a question (e.g., "why is this INT64?"), answer normally key text.
                """,
                temperature=0.1 # Low temp for code
            )
        )

        # Check for tool calls
        suggested_fix = None
        response_text = ""

        # Handle potentially multiple parts, but usually it's text then function call or just function call
        if response.function_calls:
            for fc in response.function_calls:
                if fc.name == "suggest_changes":
                    args = fc.args
                    suggested_fix = {
                        "explanation": args["explanation"],
                        "fixed_ddl": args["fixed_ddl"]
                    }
                    if not response_text:
                        response_text = f"I've analyzed your request. {args['explanation']}"
        
        if response.text:
            response_text = response.text
            
            # Fallback: If no tool call but we have DDL in text, treat it as a suggestion
            if not suggested_fix:
                extracted_ddl = self._extract_sql(response_text)
                # Ensure it's not just the same text or empty
                if extracted_ddl and len(extracted_ddl) > 20 and "CREATE TABLE" in extracted_ddl.upper():
                    suggested_fix = {
                        "explanation": "Please review the changes.",
                        "fixed_ddl": extracted_ddl
                    }

        # If we got a function call, we should ideally return that structured data
        # BUT our chat API returns a string or struct.
        # We updated ChatResponse model to have optional suggested_fix.
        
        from app.models import SuggestedFix
        
        fix_obj = None
        if suggested_fix:
            fix_obj = SuggestedFix(**suggested_fix)

        if suggested_fix and response_text:
            # Clean up the response text: Remove the DDL block to avoid pollution
            # We already have the DDL in suggested_fix
            import re
            # Remove ```sql ... ``` or ``` ... ``` blocks that contain CREATE/ALTER
            # This logic mimics _extract_sql but for removal
            
            # Simple approach: Remove the extracted DDL string if it exists in the text
            if isinstance(suggested_fix, dict):
                 params = suggested_fix
            else:
                 params = suggested_fix.model_dump() # access fields if pydantic
            
            fixed_ddl = params.get("fixed_ddl", "")
            
            if fixed_ddl:
                # Use regex to find the block containing this specific DDL, handling variations in whitespace/ticks
                # escape the DDL for use in regex
                escaped_ddl = re.escape(fixed_ddl.strip())
                # Pattern: ```(optional sql) \s* DDL \s* ```
                # We use specific DDL match to avoid removing wrong blocks if there are multiple (unlikely but safe)
                # We need to account that fixed_ddl might have been stripped max block, so we match loosely on whitespace
                
                # Actually, simpler: just remove valid code blocks that look like DDL if we have a suggested fix.
                # But let's try to remove the specific one first.
                
                pattern = r"```(?:sql)?\s*" + escaped_ddl + r"\s*```"
                
                # Check if it matches
                if re.search(pattern, response_text, re.DOTALL):
                     response_text = re.sub(pattern, "", response_text, flags=re.DOTALL)
                else:
                     # Fallback: if exact match fails (whitespace issues), fallback to string replace of content
                     # THEN remove empty blocks
                     if fixed_ddl in response_text:
                         response_text = response_text.replace(fixed_ddl, "")
                     
                     # aggressive cleanup of empty/near-empty DDL blocks
                     response_text = re.sub(r"```(?:sql)?\s*```", "", response_text)
                     # cleanup blocks that only contain whitespace
                     response_text = re.sub(r"```(?:sql)?\s+\n\s*```", "", response_text)

            # Cleanup "Here is..." text if it's trailing
            response_text = re.sub(r"Here is the updated (?:Spanner )?DDL.*?:?\s*$", "", response_text.strip(), flags=re.IGNORECASE)

        return {
            "response": response_text.strip() or "I've proposed a change based on your request.",
            "suggested_fix": fix_obj
        }

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
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        
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

    def _extract_report(self, text: str) -> str:
        """
        Extracts the 'Conversion Report' section from the response.
        """
        import re
        # Look for ## Conversion Report ... until the next header or end of string, 
        # or until the SQL block starts.
        # Simple extraction: find "## Conversion Report" and take everything until "### STEP 4" or "```sql"
        
        match = re.search(r"(## Conversion Report.*?)(\n### STEP|\n```sql|$)", text, re.DOTALL)
        if match:
            return match.group(1).strip()
        
        return "Conversion report not available."

# Global instance
agent_service = SchemaAgentService.get_instance()
