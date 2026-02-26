#!/bin/bash
set -e

# Initialize the Spanner Emulator instance if we are pointing to a local emulator
if [[ "$SPANNER_EMULATOR_HOST" == *"localhost"* ]]; then
    echo "Initializing Spanner Emulator instance 'test-instance' in 'test-project'..."
    # The Spanner emulator REST API usually listens on 9020
    curl -s -X POST http://localhost:9020/v1/projects/test-project/instances \
         -H "Content-Type: application/json" \
         -d '{
               "instanceId": "test-instance", 
               "instance": {"config": "emulator-config", "displayName": "Test Instance", "nodeCount": 1}
             }' || echo "Notice: Instance creation failed. It might already exist."
    echo "Spanner Emulator initialization completed."
fi

# Boot the actual application
echo "Starting application..."
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
