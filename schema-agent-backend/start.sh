#!/bin/bash
set -e

# Initialize the Spanner Emulator instance if we are pointing to a local emulator
if [[ "$VERIFICATION_EMULATOR_HOST" == *"localhost"* ]]; then
    # gcloud requires explicit overrides to use the emulator
    export CLOUDSDK_AUTH_DISABLE_CREDENTIALS=true
    # Emulator REST port is typically 9020 when gRPC is 9010
    export CLOUDSDK_API_ENDPOINT_OVERRIDES_SPANNER=http://localhost:9020/
    
    echo "Initializing Spanner Emulator instance 'test-instance' in 'test-project'..."
    gcloud spanner instances create test-instance \
        --config=emulator-config \
        --description="Test Instance" \
        --nodes=1 \
        --project=test-project || echo "Notice: Instance test-instance creation failed. It might already exist."


    echo "Spanner Emulator initialization completed."
fi

# Boot the actual application
echo "Starting application..."
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
