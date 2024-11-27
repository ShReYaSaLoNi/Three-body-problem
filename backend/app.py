import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
import numpy as np
from typing import List
from fastapi.responses import JSONResponse

# Initialize FastAPI with metadata
app = FastAPI(
    title="ONNX Model API",
    description="API for serving ONNX model predictions",
    version="1.0.0"
)

# Update CORS middleware with specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Load the ONNX model
try:
    onnx_model_path = "pinn_model.onnx"
    session = ort.InferenceSession(onnx_model_path)
except Exception as e:
    print(f"Error loading model: {str(e)}")
    raise

# Define MinMaxScaler
scaler = MinMaxScaler()  # Default feature_range (0, 1)

# Define request body for input data
class ModelInput(BaseModel):
    data: List[float]

    @validator('data')
    def validate_input_length(cls, v):
        if len(v) != 18:
            raise ValueError('Input data must contain exactly 18 values')
        return v

# Define response model for output data
class ModelOutput(BaseModel):
    prediction: List[float]

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "ONNX Model API is running",
        "endpoints": {
            "/": "POST endpoint for model predictions",
            "/health": "GET endpoint for health check"
        }
    }

# Health check endpoint
@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": True}

# Prediction endpoint - Read data from CSV instead of request input
@app.post("/", response_model=ModelOutput)
async def predict(user_input: ModelInput):
    try:
        # Convert the user input data to numpy array (ensure it's a 2D array)
        input_array = np.array(user_input.data, dtype=np.float32).reshape(1, -1)
        input_data = pd.read_csv('input.csv')
        combined_input_data = input_data.iloc[:, :9 +9]
        normalized_input_data = scaler.fit_transform(combined_input_data)
        normalized_user_input = scaler.transform(input_array)  

        # Run the ONNX model with the normalized user input
        inputs = {session.get_inputs()[0].name: normalized_user_input}
        output = session.run(None, inputs)

        # Apply inverse transform to the output to return the original scale
        denormalized_output = scaler.inverse_transform(output[0].reshape(1, -1))

        # Convert the denormalized output to a flat list for response
        prediction = denormalized_output.flatten().tolist()

        return {"prediction": prediction}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

# Error handlers
@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(status_code=400, content={"error": str(exc)})

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(status_code=500, content={"error": str(exc)})