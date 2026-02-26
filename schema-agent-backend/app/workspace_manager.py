import os
import shutil
import tempfile
import uuid
import logging
import subprocess
from typing import Optional

logger = logging.getLogger(__name__)

class WorkspaceManager:
    """Manages temporary workspaces for application migration."""
    
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = base_dir or os.path.join(tempfile.gettempdir(), "nightcity-workspaces")
        os.makedirs(self.base_dir, exist_ok=True)
        
    def create_workspace(self, git_url: str) -> str:
        """
        Creates a new workspace, clones the repo, and returns the path.
        """
        session_id = str(uuid.uuid4())
        workspace_path = os.path.join(self.base_dir, session_id)
        
        logger.info(f"Creating workspace for {git_url} at {workspace_path}")
        try:
            # Clone the repository
            result = subprocess.run(
                ["git", "clone", git_url, workspace_path],
                capture_output=True,
                text=True,
                check=True
            )
            logger.info("Clone successful.")
            return workspace_path
        except subprocess.CalledProcessError as e:
            logger.error(f"Clone failed: {e.stderr}")
            if os.path.exists(workspace_path):
                shutil.rmtree(workspace_path)
            raise RuntimeError(f"Failed to clone repository: {e.stderr}")
            
    def create_workspace_from_local(self, local_path: str) -> str:
        """
        Creates a new workspace by copying a local directory, and returns the path.
        """
        session_id = str(uuid.uuid4())
        workspace_path = os.path.join(self.base_dir, session_id)
        
        logger.info(f"Creating workspace from local directory {local_path} at {workspace_path}")
        try:
            abs_local_path = os.path.abspath(local_path)
            if not os.path.exists(abs_local_path):
                raise Exception(f"Local directory does not exist: {abs_local_path}")
            if not os.path.isdir(abs_local_path):
                raise Exception(f"Path is not a directory: {abs_local_path}")

            shutil.copytree(abs_local_path, workspace_path, dirs_exist_ok=True)
            logger.info("Local directory copied successfully.")
            
            # Initialize git and create a baseline commit to ensure accurate 'git diff' later
            try:
                subprocess.run(["git", "init"], cwd=workspace_path, check=True, capture_output=True)
                subprocess.run(["git", "config", "user.email", "agent@nightcity.local"], cwd=workspace_path, check=True, capture_output=True)
                subprocess.run(["git", "config", "user.name", "Migration Agent"], cwd=workspace_path, check=True, capture_output=True)
                subprocess.run(["git", "add", "-A"], cwd=workspace_path, check=True, capture_output=True)
                subprocess.run(["git", "commit", "-m", "Initial baseline"], cwd=workspace_path, capture_output=True)
            except Exception as git_e:
                logger.warning(f"Failed to initialize baseline git repo in workspace: {git_e}")
                
            return workspace_path
        except Exception as e:
            logger.error(f"Failed to copy local directory: {e}")
            raise

    def cleanup_workspace(self, workspace_path: str):
        """Removes the workspace directory."""
        if os.path.exists(workspace_path):
            logger.info(f"Cleaning up workspace {workspace_path}")
            shutil.rmtree(workspace_path)
