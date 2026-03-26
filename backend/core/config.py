from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_secret_key: str = "dev_secret"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    # Anthropic
    anthropic_api_key: str

    # LangSmith
    langchain_api_key: str = ""
    langchain_tracing_v2: str = "true"
    langchain_project: str = "thinktrace"

    # Pinecone
    pinecone_api_key: str = ""
    pinecone_index_name: str = "thinktrace"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Database
    database_url: str = "sqlite:///./thinktrace.db"

    # Neo4j
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "password"
    serper_api_key: str = ""
    news_api_key: str = ""
    transformers_offline: str = "1"
    hf_hub_offline: str = "1"
    hf_datasets_offline: str = "1"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()