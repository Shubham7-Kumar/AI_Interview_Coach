"""FastAPI entrypoint for the AI Interview Coach."""

import json
import os
import random
from pathlib import Path
from typing import Literal
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .questions import DOMAIN_LABELS, QUESTION_BANK

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="AI Interview Coach", version="1.0.0")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


class Profile(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    branch: str = Field(min_length=1, max_length=100)
    company: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=100)
    domain: str
    question_count: Literal[3, 5] = 3


class Answer(BaseModel):
    question_id: str
    question: str
    answer: str = Field(default="", max_length=10000)
    domain: str


class EvaluationRequest(BaseModel):
    profile: Profile
    answers: list[Answer] = Field(min_length=1, max_length=50)


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(ROOT / "static" / "index.html")


@app.get("/api/domains")
async def domains() -> dict:
    return {"domains": [{"id": key, "label": label} for key, label in DOMAIN_LABELS.items()]}


@app.post("/api/questions")
async def questions(profile: Profile) -> dict:
    if profile.domain not in QUESTION_BANK:
        raise HTTPException(status_code=400, detail="Select a supported interview domain.")
    return {
        "questions": random.sample(QUESTION_BANK[profile.domain], profile.question_count),
        "domain": DOMAIN_LABELS[profile.domain],
    }


def _evaluation_prompt(payload: EvaluationRequest) -> str:
    transcript = [
        {"question": item.question, "answer": item.answer.strip() or "[No answer provided]"}
        for item in payload.answers
    ]
    return f"""You are a rigorous but encouraging technical interview coach.
Evaluate the complete interview transcript for {payload.profile.name}, targeting the
{payload.profile.role} role at {payload.profile.company}. Their branch is
{payload.profile.branch}; the interview domain is {DOMAIN_LABELS[payload.profile.domain]}.

Return ONLY valid JSON with this exact shape:
{{
  "overall_score": 0,
  "summary": "two sentence summary",
  "strengths": ["specific strength"],
  "weaknesses": ["specific weakness"],
  "suggestions": ["specific action"],
  "question_feedback": [
    {{"question": "exact question", "score": 0, "feedback": "concise feedback"}}
  ]
}}
Scores must be integers from 0 to 10. Be specific, reward correct reasoning,
and do not invent claims that are absent from the answers.

Transcript:
{json.dumps(transcript, ensure_ascii=False)}"""


@app.post("/api/evaluate")
async def evaluate(request: EvaluationRequest) -> dict:
    if request.profile.domain not in QUESTION_BANK:
        raise HTTPException(status_code=400, detail="Select a supported interview domain.")
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is not configured. Add it to .env and restart the server.")

    api_url = os.getenv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions").strip()
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b").strip()
    body = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": "You evaluate technical interviews and always return the requested JSON."},
            {"role": "user", "content": _evaluation_prompt(request)},
        ],
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(api_url, headers={"Authorization": f"Bearer {api_key}"}, json=body)
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            cleaned = content.strip().removeprefix("```json").removesuffix("```").strip()
            result = json.loads(cleaned)
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail=f"The Groq evaluation service returned an unusable response: {exc}") from exc

    return result
