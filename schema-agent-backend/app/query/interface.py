from abc import ABC, abstractmethod
from typing import Dict, Any

class SourceDatabaseTool(ABC):
    """
    Abstract base class for source database tools.
    """

    @abstractmethod
    async def verify_connection(self) -> bool:
        """
        Verifies if the connection to the database is successful.
        """
        pass

    @abstractmethod
    async def run_query(self, sql: str) -> Dict[str, Any]:
        """
        Executes a query and returns the results.
        Returns:
            Dict containing:
            - columns: List[str]
            - rows: List[List[Any]]
            - error: Optional[str]
        """
        pass
    
    @abstractmethod
    async def explain_query(self, sql: str) -> Dict[str, Any]:
        """
        Executes an EXPLAIN query and returns the explanation.
        """
        pass
