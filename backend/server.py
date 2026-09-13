import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from routers.event import router as event_router
from routers.registrations import router as registrations_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")
api_router.include_router(event_router)
api_router.include_router(registrations_router)


class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class StatusCheckCreate(BaseModel):
    client_name: str


_STATUS_CHECKS: list[StatusCheck] = []


@api_router.get("/")
async def root():
    return {"message": "The Bond API is running"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    item = StatusCheck(**input.model_dump())
    _STATUS_CHECKS.append(item)
    return item


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    return _STATUS_CHECKS[-1000:]


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[origin.strip() for origin in os.environ.get("CORS_ORIGINS", "*").split(",") if origin.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
