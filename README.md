# AI Chat App

A modern, minimal AI chat application with streaming responses, conversation management, and a polished dark/light UI.

Built with **Next.js 16**, **Fastify**, **Prisma**, and **Google Gemini API**.

## Features

- Real-time streaming AI responses (SSE)
- Multiple conversation management
- Markdown rendering with code highlighting
- Dark/Light theme with smooth transitions
- Responsive design (mobile + desktop)
- Keyboard shortcuts (`Ctrl+K` to toggle sidebar)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| Backend | Node.js, Fastify, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| AI | Google Gemini 2.0 Flash (streaming) |

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL 16+

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your PostgreSQL password and Gemini API key

# 3. Create the database and seed
pnpm db:setup

# 4. Start both frontend and backend
pnpm dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- API Health: http://localhost:4000/health

### Run individually

```bash
# Backend only
pnpm dev:api

# Frontend only
pnpm dev:web
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Send message (SSE streaming response) |
| `GET` | `/api/conversations` | List all conversations |
| `POST` | `/api/conversations` | Create new conversation |
| `GET` | `/api/conversations/:id` | Get conversation with messages |
| `PATCH` | `/api/conversations/:id` | Rename conversation |
| `DELETE` | `/api/conversations/:id` | Delete conversation |

## Project Structure

```
ai-chat-app/
├── apps/
│   ├── web/          # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/          # Pages and layout
│   │   │   ├── components/   # UI, chat, sidebar, layout
│   │   │   ├── hooks/        # useChat, useConversations, useTheme
│   │   │   └── lib/          # Utilities
│   │   └── ...
│   └── api/          # Fastify backend
│       ├── src/
│       │   ├── routes/       # API route handlers
│   │       └── services/     # Prisma client, Gemini client
│       ├── prisma/           # Schema + seed
│       └── ...
└── packages/
    └── shared/       # Shared TypeScript types
```
