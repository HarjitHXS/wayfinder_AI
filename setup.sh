#!/bin/bash

# Wayfinder AI Setup Script
# Run this script to set up the complete development environment

set -e

echo "🚀 Wayfinder AI - Setup Script"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js is not installed. Please install Node.js 18+${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js $(node --version) is installed"

# Backend Setup
echo -e "\n${BLUE}📦 Setting up Backend...${NC}"
cd backend
  
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please update backend/.env with your Google Cloud credentials${NC}"
fi

echo "Installing dependencies..."
npm install
echo -e "${GREEN}✓${NC} Backend dependencies installed"

# Frontend Setup
echo -e "\n${BLUE}📦 Setting up Frontend...${NC}"
cd ../frontend

if [ ! -f ".env.local" ]; then
    echo "Creating .env.local file..."
    echo "REACT_APP_API_URL=http://localhost:3001" > .env.local
fi

echo "Installing dependencies..."
npm install
echo -e "${GREEN}✓${NC} Frontend dependencies installed"

cd ..

echo -e "\n${GREEN}================================"
echo "✅ Setup Complete!${NC}"
echo -e "\n${BLUE}Next Steps:${NC}"
echo "1. Update backend/.env with your Google Cloud Project ID:"
echo "   - GOOGLE_CLOUD_PROJECT_ID=your-project-id"
echo ""
echo "2. Start the backend:"
echo "   cd backend && npm run dev"
echo ""
echo "3. In another terminal, start the frontend:"
echo "   cd frontend && npm start"
echo ""
echo "4. Open http://localhost:3000 in your browser"
echo ""
echo "📚 For more details, see README.md"
