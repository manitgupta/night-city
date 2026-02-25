import os
import logging
from typing import Dict, Any, List, Optional
from google import genai
from google.genai import types
import subprocess

logger = logging.getLogger(__name__)

class AppMigrationAgent:
    def __init__(self, workspace_dir: str):
        self.workspace_dir = workspace_dir
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-3-pro-preview")
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY not found.")
        self.client = genai.Client(api_key=api_key)

    async def _execute_shell_command(self, command: str) -> str:
        """Executes a shell command in the workspace directory asynchronously."""
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
            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=900)
            except asyncio.TimeoutError:
                # Kill the entire process group
                os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                stdout, stderr = await process.communicate()
                return "ERROR: Command timed out after 900 seconds."
            
            stdout_str = stdout.decode('utf-8') if stdout else ""
            stderr_str = stderr.decode('utf-8') if stderr else ""
            
            # Truncate to prevent token explosion
            max_chars = 4000
            if len(stdout_str) > max_chars:
                stdout_str = f"...[TRUNCATED]...\n{stdout_str[-max_chars:]}"
            if len(stderr_str) > max_chars:
                stderr_str = f"...[TRUNCATED]...\n{stderr_str[-max_chars:]}"
            
            output = f"EXIT CODE: {process.returncode}\nSTDOUT:\n{stdout_str}\nSTDERR:\n{stderr_str}"
            return output
        except Exception as e:
            return f"ERROR: {str(e)}"

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
            )
        ])
    ]

    async def migrate_app_stream(self, max_turns: int = 5000):
        """
        Runs the autonomous migration loop. Yields ndjson chunks to be sent to frontend.
        """
        system_instruction = """You are an autonomous Application Migration Agent.
Your job is to migrate the codebase in the current workspace to work with Google Cloud Spanner instead of its original database (e.g., MySQL or Postgres).

Follow these steps iteratively:
1. EXPLORE: Read the configuration files (like pom.xml, application.properties) to find database dependencies and URLs.
2. REFACTOR CONFIG 1: Swap out dialects/drivers for Spanner (e.g., replace mysql-connector with google-cloud-spanner-jdbc).
3. COMPILE/TEST: Run the application's tests (`mvn test`, `gradle test`, etc).
4. OBSERVE & FIX: If a test fails due to a SQL syntax error, incompatible type, or unsupported Spanner feature, use `read_file` to see the source code, `write_file` to replace it with Spanner-compatible code, and rerun the tests.
5. COMPLETE: Once all database-related tests pass (or you have exhausted your ability to fix them), stop. State your final report in your text block and end the process.

IMPORTANT: If you cannot find a specific dependency version in a package manager (like Maven) after a few attempts, DO NOT get stuck in an endless loop trying to find it. Change course, try a different version, or remove the dependency if it's not strictly necessary.
IMPORTANT: Do not write the final text block until you are absolutely finished or stuck. Use your tools sequentially to solve the problem.
"""

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
                            
                        yield {"type": "live_activity", "content": tool_desc}
                        yield {"type": "log", "content": f"🔧 Executing Tool: {fc.name}({args_dict})"}
                        
                        response_data = ""
                        if fc.name == "execute_shell_command":
                            response_data = await self._execute_shell_command(args_dict.get("command", ""))
                        elif fc.name == "read_file":
                            response_data = await self._read_file(args_dict.get("filepath", ""))
                        elif fc.name == "write_file":
                            response_data = await self._write_file(args_dict.get("filepath", ""), args_dict.get("content", ""))
                        
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
                        
                    yield {
                        "type": "result",
                        "report": full_text,
                        "workspace_dir": self.workspace_dir,
                        "git_diff": git_diff
                    }
                    break
                    
            except Exception as e:
                 logger.error(f"Error in agent stream: {e}", exc_info=True)
                 yield {"type": "log", "content": f"Pipeline Error: {str(e)}"}
                 yield {"type": "result", "report": f"Failed due to error: {str(e)}"}
                 break
        
        if turn_count >= max_turns:
            yield {"type": "log", "content": "Max turns reached. Halting migration."}
            yield {"type": "result", "report": "Migration halted as it hit the maximum number of automated steps."}
