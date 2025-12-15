import os
import logging
from typing import Dict, Any, List, Optional
from google.adk import Agent
from google.genai import types
from google import genai
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
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-3-pro-preview")
        logger.info(f"SchemaAgentService initialized with model: {self.model_name}")
        # ADK Agent
        self.agent = Agent(
            name="SchemaAgent",
            model=self.model_name,
            static_instruction="You are an expert Database Engineer specialized in migrating SQL schemas to Google Cloud Spanner. You provide clear, correct Spanner DDL. You MUST IGNORE database-level commands (CREATE DATABASE, USE, etc) and focus only on schema objects.",
        )
        # Initialize Gemini Client once (Singleton)
        # Check API key existence? It's done in main.py but good to be safe.
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY not found in environment variables during AgentService init.")
        self.client = genai.Client(api_key=api_key)
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
        
        # Get Key Hints
        ddl_hints = context_manager.get_ddl_hints(source_ddl)
        feature_hints = context_manager.get_feature_hints(source_ddl)
        mapping_rules = context_manager.get_mapping_rules(dialect)
        
        formatted_hints = context_manager.format_hints_for_prompt(ddl_hints, feature_hints, mapping_rules)
        
        if formatted_hints:
            logger.info(f"Found {len(ddl_hints)} DDL hints, {len(feature_hints)} Feature hints, {len(mapping_rules)} Mapping rules.")
            logs.append(f"Injected {len(ddl_hints)} DDL hints, {len(feature_hints)} Feature hints, {len(mapping_rules)} Mapping rules.")
        else:
            logger.info("No specific hints found.")
        
        # Initial Prompt
        prompt = generate_cot_prompt(source_ddl, dialect, hints=formatted_hints)
        
        logs.append(f"Generating DDL...")
        logger.info(f"Sending prompt to agent")
        
        try:
            # Switch to Async Client
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1
                )
            )
        except Exception as e:
            logger.error(f"Gemini API call failed in convert_schema: {str(e)}", exc_info=True)
            logs.append(f"CRITICAL ERROR: Gemini API call failed: {str(e)}")
            return {
                "converted_ddl": "",
                "logs": logs,
                "report": f"Conversion failed due to API error: {str(e)}"
            }
        
        if not response.text:
            finish_reason = "Unknown"
            if response.candidates and response.candidates[0].finish_reason:
                finish_reason = str(response.candidates[0].finish_reason)
            
            error_msg = f"Gemini response contained no text. Finish Reason: {finish_reason}"
            logger.error(error_msg)
            logs.append(f"CRITICAL ERROR: {error_msg}")
            
            return {
                "converted_ddl": "",
                "logs": logs,
                "report": f"Conversion failed. The model returned no content. Reason: {finish_reason}."
            }

        response_text = response.text
        logger.info("Received response from agent")
        
        extracted_ddl = self._extract_sql(response_text)
        
        if not extracted_ddl:
            logs.append("Error: No SQL block found in agent response.")
            current_ddl = ""
        else:
            current_ddl = extracted_ddl
            
        report = self._extract_report(response_text)

        return {
            "converted_ddl": current_ddl,
            "logs": logs,
            "report": report
        }

    async def convert_schema_stream(self, source_ddl: str, dialect: str):
        """
        Orchestrates conversion with streaming response.
        Yields NDJSON chunks:
        - {"type": "log", "content": "..."}
        - {"type": "thought", "content": "..."}
        - {"type": "chunk", "content": "..."} (Optional, if we decide to stream validation/other info, but for now we buffer DDL)
        - {"type": "result", "converted_ddl": "...", "report": "...", "logs": [...]}
        """
        logs = []
        logger.info(f"Starting streaming conversion for dialect: {dialect}")
        
        # 1. Setup Phase - Yield Logs
        # Get Key Hints based on Source DDL and Dialect
        ddl_hints = context_manager.get_ddl_hints(source_ddl)
        feature_hints = context_manager.get_feature_hints(source_ddl)
        mapping_rules = context_manager.get_mapping_rules(dialect)
        
        formatted_hints = context_manager.format_hints_for_prompt(ddl_hints, feature_hints, mapping_rules)
        
        if formatted_hints:
            msg = f"Injected {len(ddl_hints)} DDL hints, {len(feature_hints)} Feature hints, {len(mapping_rules)} Mapping rules."
            logger.info(msg)
            logs.append(msg)
            yield {"type": "log", "content": msg}
        else:
            logger.info("No specific hints found.")

        # Initial Prompt with CoT and Hints
        prompt = generate_cot_prompt(source_ddl, dialect, hints=formatted_hints)
        
        yield {"type": "log", "content": "Generating DDL..."}
        logs.append(f"Generating DDL...")
        
        # 2. Generation Phase - Stream Thoughts
        logger.info(f"Sending prompt to agent (Stream)")
        
        full_response_text = ""
        
        try:
            # Use generate_content_stream
            # We assume google-genai SDK 0.x/1.x conventions. 
            # If ThinkingConfig is available in types.
            
            # Defensive check for ThinkingConfig
            config_args = {"temperature": 0.1}
            
            # Try to add thinking config if available
            try:
                # Note: The user mentioned ThinkingConfig. 
                # We interpret this as a config for the model to output thoughts.
                # In standard Gemini 1.5/2.0 protocols, thoughts might be part of the content or 'candidates'.
                # For this implementation, we will try to use the `thinking_config` if strictly required,
                # BUT standard `generate_content` often interleaves thoughts if prompted or if it's a specific model feature.
                # If the SDK version supports it:
                if hasattr(types, "ThinkingConfig"):
                    config_args["thinking_config"] = types.ThinkingConfig(include_thoughts=True)
                else:
                    # Fallback: Just rely on prompt or standard output if the SDK is older
                    # But the user specifically asked for it. 
                    # We'll try to just pass it in config if possible or assume it's part of the API.
                    # Since we can't easily see the SDK, we'll try to instantiate it dynamically or just rely on standard config.
                    pass
            except Exception as e:
                logger.warning(f"Could not configure ThinkingConfig: {e}")

            response_stream = await self.client.aio.models.generate_content_stream(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(**config_args)
            )

            async for chunk in response_stream:
                # Handle Thoughts
                # Check for 'candidates' and 'content' and 'parts'
                # In some SDK versions, thoughts are in a specific part or metadata.
                # Use a heuristic: if we have 'thought' in part or if strict thinking model is used.
                
                # For now, we'll assume chunks contain `text`.
                # If usage of "ThinkingConfig" puts thoughts in `text` but with a specific structure,/
                # OR if it's a separate part type.
                
                # Inspect chunk for thoughts
                # Note: The actual API for "thoughts" is new. 
                # We will check if `chunk.candidates[0].content.parts[0].thought` exists (conceptual).
                
                # If we can't strictly distinguish "thought" object from text, we might treat all initial text as thought 
                # if it looks like it? No, that's risky.
                
                # Let's try to find thoughts in the candidates.
                try:
                    candidates = chunk.candidates
                    if candidates:
                        for cand in candidates:
                            if hasattr(cand, "content") and cand.content and cand.content.parts:
                                for part in cand.content.parts:
                                    # Check for thought
                                    if hasattr(part, "thought") and part.thought:
                                        yield {"type": "thought", "content": part.text if part.text else "..."}
                                    elif hasattr(part, "text") and part.text:
                                        # It's text (content) - Buffer distinct text
                                        full_response_text += part.text
                except Exception as loop_e:
                    # Fallback standard extraction
                    if hasattr(chunk, "text") and chunk.text:
                        full_response_text += chunk.text

        except Exception as e:
            logger.error(f"Gemini API stream failed: {str(e)}", exc_info=True)
            logs.append(f"CRITICAL ERROR: Gemini API call failed: {str(e)}")
            yield {
                "type": "result",
                "converted_ddl": "",
                "logs": logs,
                "report": f"Conversion failed due to API error: {str(e)}"
            }
            return

        # 3. Finalization Phase
        # Extract DDL and Report from buffered text
        extracted_ddl = self._extract_sql(full_response_text)
        if not extracted_ddl:
            logs.append("Error: No SQL block found in agent response.")
            current_ddl = ""
        else:
            current_ddl = extracted_ddl
            
        report = self._extract_report(full_response_text)

        yield {
            "type": "result", # Final payload
            "converted_ddl": current_ddl,
            "logs": logs,
            "report": report
        }

    async def chat(self, message: str, source_ddl: Optional[str] = None, output_ddl: Optional[str] = None, selection: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
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

        try:
            # Switch to Async Client
            response = await self.client.aio.models.generate_content(
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
                    temperature=0.1
                )
            )
        except Exception as e:
            logger.error(f"Gemini API call failed in chat: {str(e)}", exc_info=True)
            return {
                "response": f"I encountered an error communicating with the model: {str(e)}",
                "suggested_fix": None
            }

        suggested_fix = None
        response_text = ""
        
        if not response.text and not response.function_calls:
            finish_reason = "Unknown"
            if response.candidates and response.candidates[0].finish_reason:
                finish_reason = str(response.candidates[0].finish_reason)
            logger.error(f"Chat response blocked/empty. Finish Reason: {finish_reason}")
            return {
                "response": f"I was unable to generate a response. The model may have been blocked or timed out. (Reason: {finish_reason})",
                "suggested_fix": None
            }

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
            
            if not suggested_fix:
                extracted_ddl = self._extract_sql(response_text)
                if extracted_ddl and len(extracted_ddl) > 20 and "CREATE TABLE" in extracted_ddl.upper():
                    suggested_fix = {
                        "explanation": "Please review the changes.",
                        "fixed_ddl": extracted_ddl
                    }

        from app.models import SuggestedFix
        fix_obj = None
        if suggested_fix:
            fix_obj = SuggestedFix(**suggested_fix)

        if suggested_fix and response_text:
            import re
            params = suggested_fix
            fixed_ddl = params.get("fixed_ddl", "")
            
            if fixed_ddl:
                escaped_ddl = re.escape(fixed_ddl.strip())
                pattern = r"```(?:sql)?\s*" + escaped_ddl + r"\s*```"
                
                if re.search(pattern, response_text, re.DOTALL):
                    response_text = re.sub(pattern, "", response_text, flags=re.DOTALL)
                else:
                    if fixed_ddl in response_text:
                        response_text = response_text.replace(fixed_ddl, "")
                    response_text = re.sub(r"```(?:sql)?\s*```", "", response_text)
                    response_text = re.sub(r"```(?:sql)?\s+\n\s*```", "", response_text)

            response_text = re.sub(r"Here is the updated (?:Spanner )?DDL.*?:?\s*$", "", response_text.strip(), flags=re.IGNORECASE)

        return {
            "response": response_text.strip() or "I've proposed a change based on your request.",
            "suggested_fix": fix_obj
        }


    async def analyze_fix(self, source_ddl: str, generated_ddl: str, error_message: str) -> Dict[str, str]:
        """
        Legacy/Sync-like wrapper for analyze_fix_stream to maintain API compatibility.
        """
        import json
        
        full_text = ""
        async for chunk in self.analyze_fix_stream(source_ddl, generated_ddl, error_message):
            if chunk["type"] == "thought":
                full_text += chunk["content"]
        
        # Now parse the full text
        return self._parse_analysis_response(full_text, generated_ddl)

    def _parse_analysis_response(self, text: str, original_ddl: str) -> Dict[str, str]:
        import json
        try:
            # Clean potential markdown
            clean_text = text
            if "```json" in text:
                clean_text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                clean_text = text.split("```")[0]
            
            # Attempt to parse
            return json.loads(clean_text)
        except Exception as e:
            logger.error(f"Failed to parse analysis JSON: {e}")
            # If parsing fails, maybe we can extract fields with regex or just fail gracefully
            return {
                "explanation": f"Failed to parse model response. Raw text: {text[:100]}...",
                "fixed_ddl": original_ddl 
            }

    async def multi_turn_convert_schema_stream(self, source_ddl: str, dialect: str, max_retries: int = 10):
        """
        Multi-turn conversion with self-correction loop.
        """
        from app.spanner_tool import SpannerVerificationTool
        
        # 1. Initial Generation
        current_ddl = ""
        current_report = ""
        logs = []
        
        logger.info(f"Starting Multi-Turn Conversion (Max Retries: {max_retries})")
        
        initial_stream = self.convert_schema_stream(source_ddl, dialect)
        
        async for chunk in initial_stream:
            yield chunk
            if chunk["type"] == "result":
                current_ddl = chunk.get("converted_ddl", "")
                current_report = chunk.get("report", "")
                if chunk.get("logs"):
                    logs.extend(chunk["logs"])
        
        if not current_ddl:
            yield {"type": "log", "content": "Initial generation failed to produce DDL. Aborting auto-loop."}
            return

        # 2. Loop
        verifier = SpannerVerificationTool()
        
        for i in range(max_retries):
            yield {"type": "log", "content": f"--- Auto-Correction Pass {i+1}/{max_retries} ---"}
            yield {"type": "thought", "content": f"\n\n**Analysis & Repair Loop (Pass {i+1})**\nVerifying DDL with Spanner..."}
            
            verification = await verifier.verify_ddl(current_ddl, background_tasks=None)
            
            if verification["valid"]:
                yield {"type": "log", "content": "Verification Successful! ✅"}
                yield {"type": "thought", "content": "\n\nLimit testing passed. Schema is valid."}
                yield {
                    "type": "result", 
                    "converted_ddl": current_ddl, 
                    "report": current_report + f"\n\n**Auto-Correction**: Verified valid after {i+1} pass(es).",
                    "logs": logs
                }
                return
            else:
                errors = verification["errors"]
                error_str = "\n".join(errors)
                yield {"type": "log", "content": f"Validation Errors: {error_str}"}
                yield {"type": "thought", "content": f"\n\nFound issues: \n```\n{error_str}\n```\nAnalyzing and repairing...\n\n"}
                
                # Streaming Fix
                full_analysis_text = ""
                async for fix_chunk in self.analyze_fix_stream(source_ddl, current_ddl, error_str):
                    if fix_chunk["type"] == "thought":
                        yield fix_chunk
                    elif fix_chunk["type"] == "raw":
                        full_analysis_text += fix_chunk["content"]
                
                # Parse using the full raw JSON text
                analysis = self._parse_analysis_response(full_analysis_text, current_ddl)
                
                if analysis.get("fixed_ddl"):
                    current_ddl = analysis["fixed_ddl"]
                    yield {"type": "log", "content": "Applied fix provided by agent."}
                else:
                    yield {"type": "log", "content": "Agent failed to provide a valid fix structure."}
                    if analysis.get("fixed_ddl") == current_ddl:
                         yield {"type": "log", "content": "Agent returned same DDL. Stopping loop."}
                         break

        yield {"type": "log", "content": f"Max retries ({max_retries}) reached. Returning last best effort."}
        yield {
            "type": "result", 
            "converted_ddl": current_ddl, 
            "report": current_report + f"\n\n**Auto-Correction**: Max retries reached. Validation may still verify errors.",
            "logs": logs
        }

    async def analyze_fix_stream(self, source_ddl: str, generated_ddl: str, error_message: str):
        """
        Analyzes validation error and streams explanation + fix.
        Yields:
          - {"type": "thought", "content": clean_text_segment} -> For UI display
          - {"type": "raw", "content": raw_text_segment} -> For reconstructing full JSON response
        """
        from app.prompts import generate_analyze_prompt
        
        prompt = generate_analyze_prompt(
            source_ddl=source_ddl,
            generated_ddl=generated_ddl,
            error_message=error_message
        )
        
        try:
            # Switch to Async Client
            chat = self.client.aio.chats.create(
                model=self.model_name,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json" 
                )
            )
            
            response_stream = await chat.send_message_stream(
                prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            
            # Streaming Parser State
            in_explanation_value = False
            escape_next = False
            
            # We scan for the sequence: "explanation": "
            detection_buffer = ""
            key_pattern = '"explanation": "'
            
            # Output buffer to reduce yield frequency
            output_buffer = ""
            BUFFER_SIZE = 20 # Yield every ~20 chars or newline
            
            async for chunk in response_stream:
                text = chunk.text
                if not text:
                    continue
                
                # Always yield raw for reconstruction
                yield {"type": "raw", "content": text}
                
                if not in_explanation_value:
                    detection_buffer += text
                    if key_pattern in detection_buffer:
                        start_index = detection_buffer.find(key_pattern) + len(key_pattern)
                        in_explanation_value = True
                        
                        value_part = detection_buffer[start_index:]
                        
                        for char in value_part:
                            if escape_next:
                                if char == 'n': output_buffer += "\n"
                                elif char == 't': output_buffer += "\t"
                                elif char == '"': output_buffer += '"'
                                else: output_buffer += char 
                                escape_next = False
                            elif char == '\\':
                                escape_next = True
                            elif char == '"':
                                in_explanation_value = False
                                break 
                            else:
                                output_buffer += char
                            
                            # Check buffer
                            if len(output_buffer) >= BUFFER_SIZE or output_buffer.endswith("\n"):
                                yield {"type": "thought", "content": output_buffer}
                                output_buffer = ""

                        detection_buffer = ""
                        
                else:
                    for char in text:
                        if escape_next:
                            if char == 'n': output_buffer += "\n"
                            elif char == 't': output_buffer += "\t"
                            elif char == '"': output_buffer += '"'
                            else: output_buffer += char
                            escape_next = False
                        elif char == '\\':
                            escape_next = True
                        elif char == '"':
                            in_explanation_value = False
                            break
                        else:
                            output_buffer += char
                        
                        # Check buffer
                        if len(output_buffer) >= BUFFER_SIZE or output_buffer.endswith("\n"):
                            yield {"type": "thought", "content": output_buffer}
                            output_buffer = ""
            
            # Yield remaining buffer
            if output_buffer:
                yield {"type": "thought", "content": output_buffer}
        except Exception as e:
            logger.error(f"Gemini API call failed in analyze_fix_stream: {str(e)}", exc_info=True)
            yield {"type": "log", "content": f"Error during analysis: {str(e)}"}


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
# Global instance
agent_service = SchemaAgentService.get_instance()
