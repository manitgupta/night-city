import os
import uuid
import logging

import asyncio
from typing import Optional, Dict, Any, List
from google.cloud import spanner
from google.api_core import exceptions


from fastapi import BackgroundTasks

logger = logging.getLogger(__name__)

class SpannerSingleton:
    _instance = None
    _client = None
    _spanner_instance_obj = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            project_id = os.getenv("SPANNER_PROJECT_ID")
            if project_id:
                try:
                    cls._client = spanner.Client(project=project_id)
                    logger.info("Initialized global Spanner Client.")
                except Exception as e:
                    logger.error(f"Failed to initialize global Spanner Client: {e}")
            else:
                logger.warning("SPANNER_PROJECT_ID not set. Global client not initialized.")
        return cls._client

    @classmethod
    def get_instance_obj(cls):
        """
        Returns the spanner.Instance object using the global client and SPANNER_INSTANCE_ID.
        """
        if cls._spanner_instance_obj is None:
            client = cls.get_client()
            instance_id = os.getenv("SPANNER_INSTANCE_ID")
            if client and instance_id:
                cls._spanner_instance_obj = client.instance(instance_id)
                logger.info(f"Initialized global Spanner Instance object: {instance_id}")
            else:
                logger.warning("Client or SPANNER_INSTANCE_ID missing. Instance object not initialized.")
        return cls._spanner_instance_obj

class SpannerVerificationTool:
    def __init__(self):
        """
        Initializes the SpannerVerificationTool.
        Uses the Singleton Spanner Client/Instance for efficiency.
        """
        self.instance = SpannerSingleton.get_instance_obj()
        self.client = SpannerSingleton.get_client()
        
        # Fallback logging if singleton failed
        if not self.instance:
            logger.warning("SpannerVerificationTool initialized without a valid Spanner Instance connection.")

    async def verify_ddl(self, ddl: str, background_tasks: Optional[BackgroundTasks] = None) -> Dict[str, Any]:
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
            await loop.run_in_executor(None, self._create_db_sync, database_id, ddl_statements)
            
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
        finally:
            # Schedule cleanup to run after the response is sent (or immediately in background if no BT)
            # We do this in finally to ensure we always try to clean up, even if create failed/timed out.
            if background_tasks:
                background_tasks.add_task(self._drop_db_background, database_id)
            else:
                # Fire-and-forget async task
                # Crucial: This is now triggered AFTER _create_db_sync has completed (or failed).
                # So there is no race condition where drop happens before create finishes.
                asyncio.create_task(self._drop_db_background(database_id))

    def _create_db_sync(self, database_id: str, ddl_statements: List[str]):
        """
        Synchronous helper to create the database.
        """
        # Create a database object bound to the singleton instance
        database = self.instance.database(database_id, ddl_statements=ddl_statements)
        
        try:
            # Create database
            operation = database.create()
            # Wait for result
            operation.result(timeout=120)  # 2 minutes timeout should be enough for metadata only
            logger.info(f"Database {database_id} created successfully. DDL is valid.")
        except Exception as e:
            raise e

    async def _drop_db_background(self, database_id: str):
        """
        Background task to drop the temp database.
        """
        if not self.instance:
            return

        try:
            database = self.instance.database(database_id)
            database.drop()
            logger.info(f"Database {database_id} dropped successfully (async cleanup).")
        except exceptions.NotFound:
            pass # It wasn't created, perfectly fine
        except Exception as drop_error:
            logger.error(f"Failed to drop temp database {database_id} in background: {drop_error}")


class SpannerMigrationTool:
    def __init__(self):
        """
        Initializes the SpannerMigrationTool.
        The client is initialized per request to allow different projects/instances.
        Future optimization: Could use a LRU cache of clients if needed.
        """
        pass

    async def migrate_database(self, project_id: str, instance_id: str, database_id: str, ddl: str) -> Dict[str, Any]:
        """
        Creates a database in the specified Spanner instance and applies the DDL.
        Returns a dictionary with 'success': bool, 'message': str, 'database_uri': str.
        """
        logger.info(f"Starting migration to projects/{project_id}/instances/{instance_id}/databases/{database_id}")
        
        loop = asyncio.get_running_loop()
        
        try:
            ddl_statements = [stmt.strip() for stmt in ddl.split(";") if stmt.strip()]
            
            if not ddl_statements:
                return {"success": False, "message": "No DDL statements found."}

            # Run creation in thread pool
            await loop.run_in_executor(
                None, 
                self._create_database, 
                project_id, 
                instance_id, 
                database_id, 
                ddl_statements
            )
            
            database_uri = f"projects/{project_id}/instances/{instance_id}/databases/{database_id}"
            return {
                "success": True, 
                "message": "Database created and schema applied successfully.",
                "database_uri": database_uri
            }

        except exceptions.AlreadyExists:
            return {"success": False, "message": f"Database '{database_id}' already exists."}
        except exceptions.PermissionDenied:
            return {"success": False, "message": "Permission denied. Please check if the service account has permission to create databases."}
        except exceptions.InvalidArgument as e:
            return {"success": False, "message": f"Invalid argument (possibly DDL syntax): {str(e)}"}
        except exceptions.GoogleAPICallError as e:
            return {"success": False, "message": f"Spanner API Error: {e.message}"}
        except Exception as e:
            logger.error(f"Unexpected error during migration: {e}")
            return {"success": False, "message": f"Unexpected Error: {str(e)}"}

    def _create_database(self, project_id: str, instance_id: str, database_id: str, ddl_statements: List[str]):
        """
        Synchronous helper to create the database.
        """
        try:
            client = spanner.Client(project=project_id)
            instance = client.instance(instance_id)
            database = instance.database(database_id, ddl_statements=ddl_statements)
            
            operation = database.create()
            operation.result(timeout=600)  # 10 minutes timeout for actual creation
            logger.info(f"Database {database_id} created successfully.")
            
        except Exception as e:
            raise e
