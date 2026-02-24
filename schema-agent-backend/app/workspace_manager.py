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
            
    def cleanup_workspace(self, workspace_path: str):
        """Removes the workspace directory."""
        if os.path.exists(workspace_path):
            logger.info(f"Cleaning up workspace {workspace_path}")
            shutil.rmtree(workspace_path)
