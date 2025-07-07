#!/bin/bash

# EAFC Draft - Google Cloud VPS Deployment Script
set -e

# Configuration
VM_NAME="eafc-draft-vm"
ZONE="europe-west3-a"
PROJECT_ID=$(gcloud config get-value project)

echo "🚀 Deploying EAFC Draft to Google Cloud VPS..."
echo "📍 Project: $PROJECT_ID"
echo "📍 VM: $VM_NAME"
echo "📍 Zone: $ZONE"

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
    echo "❌ .env.prod file not found. Please create it with production values"
    exit 1
fi

# Check if VM exists
echo "🔍 Checking if VM exists..."
if ! gcloud compute instances describe $VM_NAME --zone=$ZONE &>/dev/null; then
    echo "❌ VM '$VM_NAME' not found in zone '$ZONE'"
    echo "💡 Please create the VM first following DEPLOYMENT.md"
    exit 1
fi

# Check if VM is running
VM_STATUS=$(gcloud compute instances describe $VM_NAME --zone=$ZONE --format="value(status)")
if [ "$VM_STATUS" != "RUNNING" ]; then
    echo "🔄 Starting VM..."
    gcloud compute instances start $VM_NAME --zone=$ZONE
    echo "⏳ Waiting for VM to start..."
    sleep 30
fi

# Create deployment archive
echo "📦 Creating deployment package..."
tar --exclude-from=<(cat .gitignore; echo ".git"; echo "node_modules"; echo "*.log") \
    -czf eafc-draft-deploy.tar.gz .

# Copy files to VM
echo "📤 Uploading code to VM..."
gcloud compute scp eafc-draft-deploy.tar.gz $VM_NAME:~/ --zone=$ZONE

# Read environment variables from local .env.prod file
echo "📋 Reading production environment variables..."
if [ ! -f .env.prod ]; then
    echo "❌ .env.prod file not found"
    echo "💡 Create .env.prod with your production values"
    exit 1
fi

# Export environment variables to pass to VM
export $(cat .env.prod | grep -v '^#' | xargs)

# Deploy on VM
echo "🚀 Deploying on VM..."
gcloud compute ssh $VM_NAME --zone=$ZONE --command="
    set -e
    echo '🔄 Extracting code...'
    rm -rf eafc-draft-old
    if [ -d eafc-draft ]; then
        mv eafc-draft eafc-draft-old
    fi
    mkdir eafc-draft
    cd eafc-draft
    tar -xzf ../eafc-draft-deploy.tar.gz
    
    echo '🔧 Ensuring Docker permissions...'
    sudo usermod -aG docker \$USER || true
    
    echo '🐳 Stopping old containers...'
    sudo docker compose -f docker-compose.prod.yml down || true
    
    echo '🔨 Building and starting new containers...'
    sudo -E DATABASE_URL='$DATABASE_URL' \
    SERVER_ADDRESS='$SERVER_ADDRESS' \
    ALLOWED_ORIGIN='$ALLOWED_ORIGIN' \
    POSTGRES_DB='$POSTGRES_DB' \
    POSTGRES_USER='$POSTGRES_USER' \
    POSTGRES_PASSWORD='$POSTGRES_PASSWORD' \
    docker compose -f docker-compose.prod.yml up -d --build
    
    echo '🧹 Cleaning up...'
    rm ../eafc-draft-deploy.tar.gz
    sudo docker system prune -f
    
    echo '✅ Deployment complete!'
    echo '📊 Container status:'
    sudo docker compose -f docker-compose.prod.yml ps
"

# Clean up local files
rm eafc-draft-deploy.tar.gz

echo ""
echo "🎉 Deployment successful!"
echo "🌐 Frontend: https://fifadraft.kak.dev"
echo "🌐 Backend: https://fifadraftapi.kak.dev"
echo ""
echo "📊 To check status: make status-prod"
echo "📋 To view logs: make logs-prod" 