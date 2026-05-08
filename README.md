# PastQ — AI-Powered Academic Tutoring Platform 🎓🤖

PastQ is a premium, state-of-the-art educational platform designed to help students master past examination papers using cutting-edge Artificial Intelligence. It combines an immersive PDF viewing experience with specialized AI tutoring that "decodes" papers, providing instant insights, summaries, and deep-dive explanations.

---

## 🚀 Key Features

### 📖 Immersive Paper Viewer
- **Smart Reading**: High-performance PDF viewer with integrated study tools.
- **Tutor Insights**: A dedicated sidebar that reveals AI-generated summaries, key focus areas, and "hardest question" solutions.
- **Reveal Mechanism**: Advanced logic that handles on-demand insight generation while maintaining a global cache for speed.

### 🤖 AI Tutor Chat
- **Context-Aware**: The AI knows exactly which paper you are reading and answers questions based on the document text.
- **Multi-Model Intelligence**: Primarily powered by **Google Gemini 1.5/2.0 Pro**, with a resilient fallback system using **Puter.js (Llama/GPT)**.
- **Smart Extraction**: Automatic PDF-to-text processing for clean, accurate AI responses.

### 💼 Student Dashboard
- **Progress Tracking**: Statistics on AI usage, plan status, and study sessions.
- **Session Management**: Persistent chat histories that allow students to resume their tutoring sessions across different papers.
- **Premium Tiers**: Role-based access control for Basic, Plus, and Pro subscription plans.

### 🛡️ Admin HQ Portal
- **Centralized Management**: Full control over papers, subjects, and student records.
- **AI Health Monitoring**: Real-time status indicators for API quota and processing status.
- **Live Processing Logs**: Visual feedback for background PDF analysis and insight generation.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion.
- **Backend**: Node.js, Express, TypeScript.
- **Database**: Supabase (PostgreSQL) + Auth.
- **File Storage**: Cloudflare R2 (S3-Compatible) for ultra-fast PDF delivery.
- **AI Models**: Google Gemini API + Puter.js SDK.
- **Payments**: Paystack Integration.

---

## ⚙️ Environment Variables

The project requires two `.env` files. Ensure these are excluded from your version control.

### Root Directory (`./.env`) - Frontend
```env
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_PAYSTACK_PUBLIC_KEY=your_public_key
```

### Server Directory (`./server/.env`) - Backend
```env
# Server
PORT=5000
FRONTEND_URL=http://localhost:5173

# AI Keys
GEMINI_API_KEY=your_gemini_key
PUTER_AUTH_TOKEN=your_puter_token (optional fallback)

# Supabase Admin
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cloudflare R2 (S3)
CLOUDFLARE_R2_ACCESS_KEY_ID=your_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret
CLOUDFLARE_R2_ENDPOINT=https://your_id.r2.cloudflarestorage.com
CLOUDFLARE_R2_BUCKET_NAME=your_bucket
CLOUDFLARE_R2_PUBLIC_URL=https://your_public_url.r2.dev

# Payments
PAYSTACK_SECRET_KEY=your_secret_key
```

---

## 📦 Local Installation

1. **Clone & Install Dependencies**:
   ```bash
   npm install
   cd server && npm install
   ```

2. **Run Development Mode**:
   - **Frontend**: `npm run dev` (Root)
   - **Backend**: `npm run dev` (Inside `/server`)

3. **Mobile Testing**:
   Run `npm run dev -- --host` in the root and update your `VITE_API_URL` to your local network IP (e.g., `172.30.X.X`).

---

## 🌐 Deployment (Option A: Recommended)

### Frontend (Vercel)
The root directory contains a `vercel.json` configured for Single Page Application (SPA) routing. Simply connect your GitHub repo to Vercel and it will deploy automatically.

### Backend (Render)
The root directory contains a `render.yaml` Blueprint.
1. Create a new **Blueprint** project on Render.com.
2. Connect your GitHub repo.
3. Render will automatically configure the `/server` directory as the root and deploy the Express app.

---

## 📂 Project Structure

```
├── public/             # Static assets
├── server/             # Express Backend
│   ├── src/
│   │   ├── lib/        # Core utilities (AI, Storage)
│   │   ├── routes/     # API Endpoints
│   │   └── index.ts    # Server Entry Point
├── src/                # React Frontend
│   ├── components/     # UI Components
│   ├── context/        # Auth & Theme State
│   ├── lib/            # API Helpers
│   ├── pages/          # Application Routes
│   └── App.tsx         # Main Component
├── render.yaml         # Render Blueprint
└── vercel.json         # Vercel Configuration
```

---

## 📜 License
Developed for the **UPSA AI Academic Initiative**. All rights reserved.

