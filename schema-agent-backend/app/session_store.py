from typing import Dict, Optional, Any
import uuid

class SessionStore:
    _instance = None
    
    def __init__(self):
        self._sessions: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def create_session(self, config: Dict[str, Any]) -> str:
        """
        Creates a new session with the given configuration and returns the session_id.
        """
        session_id = str(uuid.uuid4())
        self._sessions[session_id] = config
        return session_id

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves the configuration for a given session_id.
        """
        return self._sessions.get(session_id)

    def delete_session(self, session_id: str) -> bool:
        """
        Deletes a session.
        """
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False
