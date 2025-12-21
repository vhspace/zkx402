#!/bin/bash

# Vercel Deployment Script for zkx402 Demo
# This script helps deploy both backend and frontend to Vercel

set -e

echo "🚀 zkx402 Vercel Deployment Script"
echo "==================================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "✅ Vercel CLI found"
echo ""

# Deploy Backend
echo "📦 Step 1: Deploy Backend API"
echo "=============================="
cd apps/demo/server

echo ""
echo "Make sure you have set the following environment variables in Vercel:"
echo "  - CDP_API_KEY_ID"
echo "  - CDP_API_KEY_SECRET"
echo "  - RECEIVER_WALLET"
echo "  - ALLOWED_ORIGINS (comma-separated list of frontend URLs)"
echo ""
read -p "Press Enter to continue with backend deployment..."

echo "Deploying backend..."
vercel --prod

echo ""
echo "✅ Backend deployed!"
echo ""
read -p "Enter your backend URL (e.g., https://zkx402-api.vercel.app): " BACKEND_URL

# Deploy Frontend
echo ""
echo "📦 Step 2: Deploy Frontend"
echo "=========================="
cd ../client

echo ""
echo "Make sure you have set the following environment variables in Vercel:"
echo "  - NEXT_PUBLIC_API_URL=$BACKEND_URL"
echo "  - NEXT_PUBLIC_CDP_PROJECT_ID"
echo "  - NEXT_PUBLIC_CELO_BRIDGE_ADDRESS (optional)"
echo "  - NEXT_PUBLIC_BASE_REGISTRY_ADDRESS (optional)"
echo ""
read -p "Press Enter to continue with frontend deployment..."

echo "Deploying frontend..."
vercel --prod

echo ""
echo "✅ Frontend deployed!"
echo ""
read -p "Enter your frontend URL (e.g., https://zkx402-client.vercel.app): " FRONTEND_URL

# Reminder
echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo ""
echo "📝 Post-Deployment Checklist:"
echo ""
echo "1. Update backend ALLOWED_ORIGINS environment variable:"
echo "   cd apps/demo/server"
echo "   vercel env add ALLOWED_ORIGINS production"
echo "   Enter value: $FRONTEND_URL"
echo ""
echo "2. Verify environment variables are set:"
echo "   Backend: vercel env ls (in server directory)"
echo "   Frontend: vercel env ls (in client directory)"
echo ""
echo "3. Test your deployments:"
echo "   Backend: curl $BACKEND_URL/health"
echo "   Frontend: Open $FRONTEND_URL in browser"
echo ""
echo "4. Monitor logs:"
echo "   Backend: vercel logs (in server directory)"
echo "   Frontend: vercel logs (in client directory)"
echo ""
echo "📚 For detailed documentation, see VERCEL_DEPLOYMENT.md"
echo ""

