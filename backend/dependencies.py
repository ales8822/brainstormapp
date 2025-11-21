# backend/dependencies.py

from pathlib import Path 
from typing import AsyncGenerator
from fastapi import Depends
import aiosqlite

# --- ALL DATABASE CONNECTION LOGIC IS REMOVED FROM HERE ---

# --- Repositories ---
from .repositories.chat_repository import ChatRepository
from .repositories.graph_repository import GraphRepository
from .repositories.settings_repository import SettingsRepository

# --- Services ---
from .services.settings_service import SettingsService
from .services.llm_service import LLMService
from .services.graph_service import GraphService
from .services.chat_service import ChatService


# --- REPOSITORY PROVIDERS (Now simpler) ---
# They no longer need a database connection injected.
def get_settings_repo() -> SettingsRepository:
    return SettingsRepository()

def get_graph_repo() -> GraphRepository:
    return GraphRepository()

def get_chat_repo() -> ChatRepository:
    return ChatRepository()

# --- SERVICE PROVIDERS (No changes needed here) ---
def get_settings_service(repo: SettingsRepository = Depends(get_settings_repo)) -> SettingsService:
    return SettingsService(repo)

def get_llm_service(settings_service: SettingsService = Depends(get_settings_service)) -> LLMService:
    return LLMService(settings_service)

def get_graph_service(
    repo: GraphRepository = Depends(get_graph_repo), 
    llm: LLMService = Depends(get_llm_service)
) -> GraphService:
    return GraphService(repo, llm)

def get_chat_service(
    repo: ChatRepository = Depends(get_chat_repo), 
    llm: LLMService = Depends(get_llm_service)
) -> ChatService:
    return ChatService(repo, llm)

# --- Utility Dependencies ---

def get_root_dir() -> Path:
    from pathlib import Path
    return Path(__file__).resolve().parent.parent.parent

