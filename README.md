# Clearstep — AI Interview Coach

Clearstep is a focused technical interview practice app built with FastAPI, HTML, CSS, and JavaScript. Students select a target role, company, and interview topic, answer questions by typing or speaking, and receive an AI-powered review through Groq.

## Features

- Student profile with name, branch, company, and target role
- 13 interview topics: DSA, Java, Python, web development, JavaScript, C, C++, system design, OOPs, DBMS, computer networks, AI, and ML
- 10 predefined questions for every topic
- Random question selection for every new session
- Choice of 3 or 5 questions per session
- Typed answers and browser voice answers
- Groq-powered evaluation with a score out of 10
- Strengths, weaknesses, improvement suggestions, and question-level feedback
- Downloadable Markdown report containing the questions, answers, score, and review
- Responsive, study-focused interface

## Project structure

```text
Project1/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI routes and Groq evaluation
│   └── questions.py         # 10 questions for each interview topic
├── static/
│   ├── index.html           # Application interface
│   ├── styles.css           # Responsive styling
│   └── app.js               # Interview flow, voice input, and download report
├── .env.example             # Safe environment variable template
├── .gitignore               # Excludes secrets and local environments
├── README.md
└── requirements.txt
```

## Run locally on Windows

If `python` opens the Microsoft Store or is not recognized, use the actual Python installation path or add Python to PATH first.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Open `.env` and add your Groq API key:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_API_URL=https://api.groq.com/openai/v1/chat/completions
GROQ_MODEL=openai/gpt-oss-20b
```

Start the server:

```powershell
python -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000` in your browser.

The browser Speech Recognition API is used for voice answers where supported. The API key stays on the backend and is never sent to frontend code.

## GitHub upload checklist

Upload these files and folders:

```text
app/
static/
.env.example
.gitignore
README.md
requirements.txt
```

Do **not** upload:

```text
.env
.venv/
__pycache__/
*.pyc
```

The `.env` file contains your private API key and is already excluded by `.gitignore`. Use `.env.example` so other people know which variables are required without exposing your key.

## Deployment

Run the application on a Python host with:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Configure `GROQ_API_KEY`, `GROQ_API_URL`, and `GROQ_MODEL` as deployment environment variables. Never commit `.env` or an API key.
