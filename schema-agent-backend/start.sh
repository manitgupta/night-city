#!/bin/bash
set -e

# Initialize the Spanner Emulator instance if we are pointing to a local emulator
if [[ "$SPANNER_EMULATOR_HOST" == *"localhost"* ]]; then
    echo "Initializing Spanner Emulator instance 'test-instance' in 'test-project'..."
    gcloud spanner instances create test-instance \
        --config=emulator-config \
        --description="Test Instance" \
        --nodes=1 \
        --project=test-project || echo "Notice: Instance test-instance creation failed. It might already exist."
             
    if [[ -n "$SPANNER_PROJECT_ID" ]] && [[ -n "$SPANNER_INSTANCE_ID" ]]; then
        echo "Initializing Spanner Emulator instance '$SPANNER_INSTANCE_ID' in '$SPANNER_PROJECT_ID'..."
        gcloud spanner instances create "$SPANNER_INSTANCE_ID" \
            --config=emulator-config \
            --description="$SPANNER_INSTANCE_ID" \
            --nodes=1 \
            --project="$SPANNER_PROJECT_ID" || echo "Notice: Instance $SPANNER_INSTANCE_ID creation failed. It might already exist."
    fi

    echo "Spanner Emulator initialization completed."
fi

# Boot the actual application
echo "Starting application..."
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
