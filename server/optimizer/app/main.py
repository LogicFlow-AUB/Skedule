"""Standalone FastAPI wrapper around the existing Python schedule optimizer.

This service owns optimization only.  It never queries Supabase, never connects
to PostgreSQL, and contains no database credentials, AI/LLM, RAG, or SQL
generation.  The Node backend sends a complete, already-expanded optimizer
payload and consumes the structured result.

Endpoints
---------
GET  /health            -> {"status": "ok"}
POST /schedule-optimize -> run the existing MILP and return a structured result

Run locally (from the ``optimizer`` directory):
    uvicorn app.main:app --host 0.0.0.0 --port 8001
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from scheduling_milp import ModelInputError

from .models import ErrorDetail, OptimizeRequest, OptimizeResponse
from .service import run_optimizer

app = FastAPI(
    title="LogicFlow Schedule Optimizer",
    version="1.0.0",
    description="Thin FastAPI wrapper around the existing MILP schedule optimizer.",
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post(
    "/schedule-optimize",
    response_model=OptimizeResponse,
    responses={
        422: {"model": ErrorDetail},
        500: {"model": ErrorDetail},
    },
)
async def schedule_optimize(request: OptimizeRequest) -> OptimizeResponse:
    """Validate the expanded payload and run the existing optimizer.

    A solver status of ``infeasible``/``not_solved`` is a valid, structured
    result returned with HTTP 200.  Invalid model data (which cannot define the
    MILP) is a 4xx.  Unexpected internal failures are a 500.
    """
    return run_optimizer(request)


@app.exception_handler(ModelInputError)
async def model_input_error_handler(
    _request: Request, exc: ModelInputError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"status": "invalid_input", "message": str(exc)},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"status": "invalid_input", "message": "Invalid optimizer request."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    _request: Request, exc: Exception
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"status": "internal_error", "message": "The optimizer failed unexpectedly."},
    )
