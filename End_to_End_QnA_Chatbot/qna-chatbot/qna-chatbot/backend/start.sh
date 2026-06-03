#!/bin/bash
# Start the QnA Chatbot Backend
echo "Installing dependencies..."
pip install -r requirements.txt -q

echo "Starting FastAPI server on http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
