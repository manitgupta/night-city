import os
import uuid
import logging

import asyncio
from typing import Optional, Dict, Any, List
from google.cloud import spanner

logger = logging.getLogger(__name__)

class SpannerVerificationTool:
    def __init__(self):
        """
        Initializes the SpannerVerificationTool.
        Expects SPANNER_PROJECT_ID and SPANNER_INSTANCE_ID to be set in environment variables.
        """
        self.project_id = os.getenv("SPANNER_PROJECT_ID")
        self.instance_id = os.getenv("SPANNER_INSTANCE_ID")
        
        if not self.project_id or not self.instance_id:
            logger.warning("SPANNER_PROJECT_ID or SPANNER_INSTANCE_ID not set. Verification will fail if attempted.")
            self.client = None
            self.instance = None
        else:
            try:
                self.client = spanner.Client(project=self.project_id)
                self.instance = self.client.instance(self.instance_id)
            except Exception as e:
                logger.error(f"Failed to initialize Spanner client: {e}")
                self.client = None
                self.instance = None

    async def verify_ddl(self, ddl: str) -> Dict[str, Any]:
        """
        Verifies the given DDL by attempting to create a temporary database in Spanner.
        Returns a dictionary with 'valid': bool, 'errors': list[str].
        """
        if not self.instance:
             return {
                "valid": False, 
                "errors": ["Spanner Client not initialized. Check server logs and environment variables."]
            }

        # Generate a unique database ID for this verification attempt
        short_uuid = str(uuid.uuid4()).replace("-", "")[:8]
        database_id = f"verify_{short_uuid}"
        
        logger.info(f"Starting DDL verification. Temp DB: {database_id}")
        
        loop = asyncio.get_running_loop()
        
        try:
            # Simple splitting by ';' might be fragile if ';' is in comments or strings.
            # For now, we assume standard valid DDL scripts.
            ddl_statements = [stmt.strip() for stmt in ddl.split(";") if stmt.strip()]
            
            if not ddl_statements:
                 return {"valid": False, "errors": ["No DDL statements found."]}

            # We'll run the creation logic in a separate thread to avoid blocking the event loop
            await loop.run_in_executor(None, self._create_and_drop_db, database_id, ddl_statements)
            
            return {"valid": True, "errors": []}

        except exceptions.InvalidArgument as e:
            # DDL syntax error usually throws InvalidArgument
            error_msg = str(e)
            logger.info(f"DDL Verification failed with syntax error: {error_msg}")
            return {"valid": False, "errors": [f"Syntax Error: {error_msg}"]}
        except exceptions.GoogleAPICallError as e:
            error_msg = f"{e.code.name}: {e.message}"
            logger.error(f"Spanner API Error: {error_msg}")
            return {"valid": False, "errors": [f"Spanner API Error: {error_msg}"]}
        except Exception as e:
            # Clean generic exception message
            logger.error(f"Unexpected error during verification: {e}")
            return {"valid": False, "errors": [f"Unexpected Error: {str(e)}"]}

    def _create_and_drop_db(self, database_id: str, ddl_statements: List[str]):
        """
        Synchronous helper to create and then drop the database.
        """
        database = self.instance.database(database_id, ddl_statements=ddl_statements)
        
        try:
            # Create database
            operation = database.create()
            # Wait for result
            operation.result(timeout=120)  # 2 minutes timeout should be enough for metadata only
            logger.info(f"Database {database_id} created successfully. DDL is valid.")
        except Exception as e:
            # Re-raise to be caught by the async wrapper
            raise e
        finally:
            # CLEANUP: Always try to drop the database
            try:
                # Convert database object to one that we can reload/drop? 
                # database.drop() exists on the object.
                database.drop()
                logger.info(f"Database {database_id} dropped.")
            except exceptions.NotFound:
                pass # It wasn't created, perfectly fine
            except Exception as drop_error:
                logger.error(f"Failed to drop temp database {database_id}: {drop_error}")
