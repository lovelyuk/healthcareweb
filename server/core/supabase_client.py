from __future__ import annotations

import os
import json
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client


# ------------------------------------------------------------
# 경로 설정
# ------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent.parent

APPDATA_CONFIG = Path(os.getenv("LOCALAPPDATA", "")) / "BodyCheckAgent" / "config.json"

ENV_CANDIDATES = [
    BASE_DIR / ".env",
    BASE_DIR / "server" / ".env",
    Path.cwd() / ".env",
]


# ------------------------------------------------------------
# 설정 로드
# ------------------------------------------------------------

def load_config() -> dict:
    """
    config.json -> .env fallback
    """

    # 1️⃣ config.json 우선
    if APPDATA_CONFIG.exists():
        with open(APPDATA_CONFIG, "r", encoding="utf-8") as f:
            cfg = json.load(f)

        return {
            "SUPABASE_URL": cfg.get("SUPABASE_URL"),
            "SUPABASE_SERVICE_ROLE_KEY": cfg.get("SUPABASE_SERVICE_ROLE_KEY"),
        }

    # 2️⃣ .env fallback
    for p in ENV_CANDIDATES:
        if p.exists():
            load_dotenv(p)
            break
    else:
        load_dotenv()

    return {
        "SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
    }


CONFIG = load_config()


# ------------------------------------------------------------
# Supabase Client
# ------------------------------------------------------------

@lru_cache(maxsize=1)
def get_supabase() -> Client:

    url = CONFIG.get("SUPABASE_URL")
    key = CONFIG.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url:
        raise RuntimeError(
            f"SUPABASE_URL missing. Checked config.json: {APPDATA_CONFIG} and .env"
        )

    if not key:
        raise RuntimeError(
            f"SUPABASE_SERVICE_ROLE_KEY missing. Checked config.json: {APPDATA_CONFIG} and .env"
        )

    return create_client(url, key)