# Fable AI — Gemini Edition

A clean AI chatbot for **fable.space**, built with Next.js, TypeScript, Tailwind CSS, and Google's Gemini API.

## Setup

### 1. Install Node.js
Use Node.js 20 or newer.

### 2. Install the project

Open this folder in VS Code, open the terminal, and run:

```bash
npm install
```

### 3. Add your Gemini API key

Create a file called `.env.local` in the root of the project, beside `package.json`.

Put this inside:

```env
GEMINI_API_KEY=PASTE_YOUR_KEY_HERE
GEMINI_MODEL=gemini-3.7-flash
```

Do not share your API key and do not commit `.env.local`.

### 4. Start Fable

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Project structure

```text
fable-gemini/
├── app/
│   ├── api/chat/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Chat.tsx
│   └── Message.tsx
├── lib/
│   └── gemini.ts
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Security

The Gemini key is read only by the Next.js server route. Never put the key in a variable beginning with `NEXT_PUBLIC_`.

## Deploying

Push the project to GitHub, import it into Vercel, and add `GEMINI_API_KEY` and `GEMINI_MODEL` as server-side environment variables in the Vercel project settings. Then connect `fable.space` in Vercel's Domains settings.

## Future upgrades

- Streaming responses
- Supabase accounts and saved chats
- File uploads
- Image understanding
- Web/search tools
- Rate limiting
- Usage limits
