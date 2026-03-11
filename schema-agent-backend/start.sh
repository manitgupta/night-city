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
             }' || echo "Notice: Instance test-instance creation failed. It might already exist."
             
    if [[ -n "$SPANNER_PROJECT_ID" ]] && [[ -n "$SPANNER_INSTANCE_ID" ]]; then
        echo "Initializing Spanner Emulator instance '$SPANNER_INSTANCE_ID' in '$SPANNER_PROJECT_ID'..."
        curl -s -X POST http://localhost:9020/v1/projects/$SPANNER_PROJECT_ID/instances \
             -H "Content-Type: application/json" \
             -d "{
                   \"instanceId\": \"$SPANNER_INSTANCE_ID\", 
                   \"instance\": {\"config\": \"emulator-config\", \"displayName\": \"$SPANNER_INSTANCE_ID\", \"nodeCount\": 1}
                 }" || echo "Notice: Instance $SPANNER_INSTANCE_ID creation failed. It might already exist."
    fi

    echo "Spanner Emulator initialization completed."
fi

# Boot the actual application
echo "Starting application..."
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
