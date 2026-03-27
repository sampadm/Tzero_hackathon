from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    anthropic_api_key: str
    sepolia_rpc_url: str
    deployer_private_key: str
    jwt_secret: str
    database_url: str = "sqlite:///./tzero_byoa.db"
    upload_dir: str = "./uploads"
    frontend_url: str = "http://localhost:3000"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24 hours

    class Config:
        env_file = ("../.env", ".env")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
