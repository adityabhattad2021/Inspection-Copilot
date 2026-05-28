from fastapi import FastAPI

from app.routes.profiles import router as profiles_router
from app.routes.sessions import router as sessions_router
from app.routes.vehicles import router as vehicles_router

app = FastAPI(title="Cars24 Jockey Copilot API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(vehicles_router)
app.include_router(profiles_router)
app.include_router(sessions_router)
