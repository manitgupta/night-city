import os
import logging
from typing import Dict, Any, List, Optional
from google import genai
from google.genai import types
import subprocess
from app.prompts import generate_migration_agent_prompt

logger = logging.getLogger(__name__)

class AppMigrationAgent:
    def __init__(self, workspace_dir: str):
        self.workspace_dir = workspace_dir
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-3-pro-preview")
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY not found.")
        self.client = genai.Client(api_key=api_key)

    async def _execute_shell_command_stream(self, command: str):
        """Executes a shell command in the workspace directory asynchronously and yields output."""
        logger.info(f"Executing: {command} in {self.workspace_dir}")
        import asyncio
        import signal
        try:
            process = await asyncio.create_subprocess_shell(
                command,
                cwd=self.workspace_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                stdin=asyncio.subprocess.DEVNULL,
                start_new_session=True
            )
            
            stdout_chunks = []
            stderr_chunks = []
            queue = asyncio.Queue()

            async def read_stream(stream, chunks, is_stderr=False):
                try:
                    while True:
                        line = await stream.readline()
                        if not line:
                            break
                        line_str = line.decode('utf-8', errors='replace')
                        chunks.append(line_str)
                        await queue.put(("output", line_str))
                except Exception as e:
                    logger.error(f"Error reading stream: {e}")
                finally:
                    await queue.put(("done", is_stderr))

            tasks = [
                asyncio.create_task(read_stream(process.stdout, stdout_chunks, False)),
                asyncio.create_task(read_stream(process.stderr, stderr_chunks, True))
            ]

            active_streams = 2
            try:
                while active_streams > 0:
                    item_type, content = await asyncio.wait_for(queue.get(), timeout=900)
                    if item_type == "output":
                        yield ("output", content)
                    elif item_type == "done":
                        active_streams -= 1
                    queue.task_done()
                    
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                yield ("result", "ERROR: Command timed out after 900 seconds.")
                return

            stdout_str = "".join(stdout_chunks)
            stderr_str = "".join(stderr_chunks)
            
            # Truncate to prevent token explosion
            max_chars = 4000
            if len(stdout_str) > max_chars:
                stdout_str = f"...[TRUNCATED]...\n{stdout_str[-max_chars:]}"
            if len(stderr_str) > max_chars:
                stderr_str = f"...[TRUNCATED]...\n{stderr_str[-max_chars:]}"
            
            output = f"EXIT CODE: {process.returncode}\nSTDOUT:\n{stdout_str}\nSTDERR:\n{stderr_str}"
            yield ("result", output)
        except Exception as e:
            yield ("result", f"ERROR: {str(e)}")

    async def _read_file(self, filepath: str) -> str:
        """Reads a file from the workspace."""
        full_path = os.path.join(self.workspace_dir, filepath)
        if not os.path.abspath(full_path).startswith(os.path.abspath(self.workspace_dir)):
            return "ERROR: Cannot read outside workspace."
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                content = f.read()
                return content
        except Exception as e:
             return f"ERROR reading file: {str(e)}"

    async def _write_file(self, filepath: str, content: str) -> str:
        """Writes content to a file in the workspace."""
        full_path = os.path.join(self.workspace_dir, filepath)
        if not os.path.abspath(full_path).startswith(os.path.abspath(self.workspace_dir)):
            return "ERROR: Cannot write outside workspace."
        try:
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)
            return f"Successfully wrote to {filepath}"
        except Exception as e:
             return f"ERROR writing file: {str(e)}"

    async def _search_web(self, query: str) -> str:
        """Helper method that uses a separate Gemini call for Google Search Grounding.
        This bypasses the limitation of mixing function calling and search tools."""
        try:
            search_config = types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.0
            )
            response = await self.client.aio.models.generate_content(
                model="gemini-3-pro-preview", 
                contents=f"Search the web to answer this query: {query}",
                config=search_config
            )
            if response.text:
                return response.text
            return "No relevant information found."
        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return f"ERROR performing web search: {str(e)}"

    # Tool Declarations
    _tools = [
        types.Tool(function_declarations=[
            types.FunctionDeclaration(
                name="execute_shell_command",
                description="Run shell commands (like 'mvn test', 'ls', 'grep') in the root directory of the application.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "command": types.Schema(type=types.Type.STRING, description="The shell command to execute.")
                    },
                    required=["command"]
                )
            ),
            types.FunctionDeclaration(
                name="read_file",
                description="Read contents of a file in the workspace. Path should be relative to workspace root.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "filepath": types.Schema(type=types.Type.STRING, description="Relative path to file.")
                    },
                    required=["filepath"]
                )
            ),
            types.FunctionDeclaration(
                name="write_file",
                description="Modify or create a file in the workspace. Will overwrite if exists.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "filepath": types.Schema(type=types.Type.STRING, description="Relative path to file."),
                        "content": types.Schema(type=types.Type.STRING, description="New contents of the file.")
                    },
                    required=["filepath", "content"]
                )
            ),
            types.FunctionDeclaration(
                name="search_web",
                description="Search the web for information, documentation, or solutions to errors.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "query": types.Schema(type=types.Type.STRING, description="The search query.")
                    },
                    required=["query"]
                )
            )
        ])
    ]

    async def migrate_app_stream(self, max_turns: int = 5000):
        """
        Runs the autonomous migration loop. Yields ndjson chunks to be sent to frontend.
        """
        system_instruction = generate_migration_agent_prompt()

        config = types.GenerateContentConfig(
            tools=self._tools,
            temperature=0.1,
            thinking_config=types.ThinkingConfig(include_thoughts=True),
            system_instruction=system_instruction
        )

        contents = [
            types.Content(
                role="user",
                parts=[types.Part(text="Start the migration process. First, list files to identify the project structure.")]
            )
        ]

        turn_count = 0
        
        while turn_count < max_turns:
            logger.info(f"Model turn {turn_count}")
            yield {"type": "live_activity", "content": f"Analyzing codebase and determining next steps (Step {turn_count + 1})..."}
            
            # Implement sliding window to prevent token explosion
            MAX_RETAINED_TURNS = 10 # 20 messages (model + tool)
            if len(contents) > (MAX_RETAINED_TURNS * 2) + 1:
                # Keep initial user prompt + latest N turns
                windowed_contents = [contents[0]] + contents[-(MAX_RETAINED_TURNS * 2):]
            else:
                windowed_contents = contents
            
            import asyncio
            try:
                max_retries = 50
                retry_delay = 20
                
                for attempt in range(max_retries):
                    try:
                        response_stream = await self.client.aio.models.generate_content_stream(
                            model=self.model_name,
                            contents=windowed_contents,
                            config=config
                        )
                        
                        model_parts = []
                        function_calls = []
                        full_text = ""
                        
                        async for chunk in response_stream:
                            if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                                 for part in chunk.candidates[0].content.parts:
                                     model_parts.append(part)
                                     
                                     if part.text:
                                         is_thought = hasattr(part, "thought") and part.thought
                                         if is_thought:
                                             yield {"type": "thought", "content": part.text}
                                         else:
                                             full_text += part.text
                                     
                                     if part.function_call:
                                         function_calls.append(part.function_call)
                                         
                        break # Success!
                    except Exception as api_e:
                        if attempt < max_retries - 1:
                            logger.warning(f"API stream failed (attempt {attempt + 1}/{max_retries}): {api_e}. Retrying in {retry_delay}s...")
                            yield {"type": "log", "content": f"API stream failed, retrying in {retry_delay}s..."}
                            await asyncio.sleep(retry_delay)
                            retry_delay *= 2 # Exponential backoff
                        else:
                            logger.error(f"API stream failed after {max_retries} attempts: {api_e}")
                            raise api_e # Re-raise to be caught by the outer try-except loop
                
                if not model_parts:
                    yield {"type": "log", "content": "Model returned empty response. Halting."}
                    break
                    
                contents.append(types.Content(role="model", parts=model_parts))
                
                if function_calls:
                    turn_count += 1
                    tool_outputs = []
                    
                    for fc in function_calls:
                        args_dict = {k: v for k,v in fc.args.items()} if fc.args else {}
                        
                        tool_desc = fc.name
                        if fc.name == "execute_shell_command":
                            tool_desc = f"Running shell command: {args_dict.get('command', '')}"
                        elif fc.name == "read_file":
                            tool_desc = f"Reading file: {args_dict.get('filepath', '')}"
                        elif fc.name == "write_file":
                            tool_desc = f"Modifying file: {args_dict.get('filepath', '')}"
                        elif fc.name == "search_web":
                            tool_desc = f"Searching web for: {args_dict.get('query', '')}"
                            
                        yield {"type": "live_activity", "content": tool_desc}
                        yield {"type": "log", "content": f"🔧 Executing Tool: {fc.name}({args_dict})"}
                        
                        response_data = ""
                        if fc.name == "execute_shell_command":
                            async for item_type, content in self._execute_shell_command_stream(args_dict.get("command", "")):
                                if item_type == "output":
                                    yield {"type": "log", "content": content.rstrip('\r\n')}
                                elif item_type == "result":
                                    response_data = content
                        elif fc.name == "read_file":
                            response_data = await self._read_file(args_dict.get("filepath", ""))
                        elif fc.name == "write_file":
                            response_data = await self._write_file(args_dict.get("filepath", ""), args_dict.get("content", ""))
                        elif fc.name == "search_web":
                            response_data = await self._search_web(args_dict.get("query", ""))
                        
                        tool_outputs.append(
                            types.Part(
                                function_response=types.FunctionResponse(
                                    name=fc.name,
                                    response={"result": response_data}
                                )
                            )
                        )
                        
                        
                        yield {"type": "log", "content": f"Result of {fc.name}:\n{response_data}"}
                        
                    contents.append(types.Content(role="tool", parts=tool_outputs))
                    
                else:
                    # No more function calls, we are done
                    logger.info("No function calls, migration complete.")
                    yield {"type": "log", "content": "Migration agent has decided to finish."}
                    termination_reason = "success"
                    break
                    
            except Exception as e:
                 logger.error(f"Error in agent stream: {e}", exc_info=True)
                 yield {"type": "log", "content": f"Pipeline Error: {str(e)}"}
                 termination_reason = "error"
                 error_message = str(e)
                 break
        
        if turn_count >= max_turns:
            yield {"type": "log", "content": "Max turns reached. Halting migration."}
            termination_reason = "max_turns"

        # Grab a git diff of the workspace to show the user
        git_diff = ""
        try:
            diff_result = subprocess.run(
                "git diff",
                shell=True,
                cwd=self.workspace_dir,
                capture_output=True,
                text=True
            )
            git_diff = diff_result.stdout
        except Exception as e:
            logger.error(f"Could not get git diff: {e}")
            
        yield {"type": "live_activity", "content": "Generating final detailed migration report..."}
        
        report_prompt = f"""You are an expert Application Migration Engineer. You must create a detailed Markdown report summarizing the refactoring changes made to migrate the application to Google Cloud Spanner based on the provided Git diff.
Include sections such as 'Executive Summary', 'Key Changes', 'Modified Files', and 'Next Steps'. Create it beautifully formatted in Markdown.

Here is the Git diff:
```diff
{git_diff}
```
"""
        final_report = full_text if 'full_text' in locals() else ""
        try:
            report_response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=report_prompt
            )
            if report_response and hasattr(report_response, 'text') and report_response.text:
                final_report = report_response.text
            else:
                final_report = "Completed changes. (Model returned empty report)"
        except Exception as repr_e:
            logger.error(f"Report generation failed: {repr_e}")
            final_report = f"Failed to generate detailed report: {str(repr_e)}"

        is_success = (termination_reason == "success")

        yield {
            "type": "result",
            "report": final_report,
            "workspace_dir": self.workspace_dir,
            "git_diff": git_diff,
            "success": is_success
        }
