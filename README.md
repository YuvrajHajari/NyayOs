# NyayOS , Operating System for Citizen Rights

India's first AI-powered access-to-justice platform. A citizen calls a number, speaks in Hindi, answers a few questions, and walks away with a legally structured complaint ready to submit , in under 5 minutes.

## The Problem

600 million Indians face legal issues every year , unpaid wages, police refusing FIRs, landlords keeping deposits, pension delays. Most get no help because lawyers are expensive and the system is built for people who already know how it works.

## What NyayOS Does

1. Citizen calls the NyayOS number
2. AI voice agent (Bolna + Cartesia) interviews them in Hindi, English, or Hinglish
3. Agent identifies the issue, collects structured facts, generates official complaint documents
4. Case appears live on NGO paralegal dashboard with transcript, documents, and next steps
5. Documents emailed to lawyer automatically via n8n

No app. No English required. No lawyer fee.

## Issue Types Covered

| Issue | Documents Generated | Escalation Authority |
|-------|-------------------|---------------------|
| Unpaid Salary | Demand notice + Labour complaint | Labour Commissioner |
| FIR Refusal | SP complaint + CrPC 156(3) application | SP / Magistrate Court |
| Security Deposit Withheld | Legal notice + Rent Authority complaint | Rent Authority / Consumer Forum |
| Pension Delay | Grievance application + Escalation letter | District Collector / Ombudsman |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Voice Agent | Bolna AI |
| Text-to-Speech | Cartesia Sonic-3.5 |
| Speech-to-Text | Deepgram Nova-3 |
| LLM | GPT-4.1 Mini (Azure) |
| Backend API | Node.js + Express |
| Database | Supabase (Postgres) |
| Deployment | Render |
| Email Automation | n8n |

## Live Demo

**[https://nyayos-v27p.onrender.com](https://nyayos-v27p.onrender.com)**

- NGO Workspace PIN: `abc123`
- Citizen Lookup PIN: `abs123`

## Project Structure

```
yuvraj/
├── server.js          # Express API , all endpoints
├── public/
│   └── index.html     # Full frontend , dashboard + citizen portal + call trigger
├── package.json
└── data/              # Local fallback (production uses Supabase)
```

## API Endpoints

```
POST   /cases              # Bolna webhook , creates case after call ends
GET    /cases              # List all cases (filterable by issue, urgency, status)
GET    /cases/:id          # Full case detail
PATCH  /cases/:id/status   # Update case status
POST   /start-call         # Trigger outbound Bolna call to citizen
GET    /health             # Health check
```

## Case Status Pipeline

```
New → Info Needed → Draft Generated → Submitted → Follow-up Due → Resolved
```

## Setup

```bash
npm install
npm start
```

Set these environment variables on Render:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
BOLNA_API_KEY=your_bolna_key
```

## Built By

Yuvraj Hajari + Akaash VP , Bolna x Cartesia Voc-a-thon 2026
