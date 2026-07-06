# PastQ — AI-Powered Academic Tutoring Platform 🎓🤖

> **Live at → [pastqhub.com](https://pastqhub.com)**

PastQ is a premium educational platform designed to help students master past examination papers using cutting-edge Artificial Intelligence. It combines an immersive PDF viewing experience with specialized AI tutoring that provides instant insights, summaries, and deep-dive explanations.

---

## 🚀 Key Features

### 📖 Immersive Paper Viewer
- **Smart Reading**: High-performance PDF viewer with integrated study tools.
- **Tutor Insights**: A dedicated sidebar that reveals AI-generated summaries, key focus areas, and "hardest question" solutions.
- **Reveal Mechanism**: Advanced logic that handles on-demand insight generation while maintaining a global cache for speed.

### 🤖 Multi-Tier AI Tutor Chat & OCR
- **Context-Aware**: The AI knows exactly which paper you are reading and answers questions based on the document text.
- **High-Resiliency Multi-Tier AI**: A rock-solid, multi-engine fallback pipeline ensures the tutor is always online even during primary API blackouts.
- **Integrated OCR Engine**: Automatic detection of scanned or unreadable PDFs with local and cloud OCR pipelines.

### 💼 Student Dashboard
- **Browse & Filter**: Advanced filtering by academic year, semester, and department.
- **Visual Active Tabs**: Active visual indicator states on the subject tabs, improving navigation feedback.
- **Smart Empty States**: Intuitive "Not Found" feedback with quick-reset filter capabilities.
- **Progress Tracking**: Statistics on AI usage, plan status, and study sessions.
- **Session Management**: Persistent chat histories that allow students to resume tutoring sessions across papers.
- **Premium Tiers**: Role-based access control for Basic, Plus, and Pro subscription plans.

### 📱 Progressive Web App (PWA)
- **Installable**: Users can install the platform directly to their device home screens for a native app-like experience.
- **Smart Prompts**: Intelligent installation prompts that gracefully hide themselves once the app is installed or dismissed.
- **Standalone Session Persistence**: Dual-layer refresh token strategy — httpOnly cookies (primary) with localStorage fallback for PWA/standalone mode, ensuring sessions survive Android app kills and WebView process restarts.
- **Rolling Inactivity Window**: Refreshes a 7-day inactivity timer on every successful token refresh, automatically logging users out only if they do not launch the PWA for 7 consecutive days.

### 💎 Premium User Experience (UX)
- **Cohesive Custom Modals**: Non-blocking `AlertModal` matching the platform's custom dark-theme styling.
- **State-Adaptive Landing Page**: CTA blocks conditionally adapt based on authentication state.
- **True Account Isolation**: Comprehensive session and local database teardown on logout to ensure zero data bleeding when switching profiles.

### 🔒 Advanced Security & Session Management
- **Single-Device Login**: Strict concurrent session control. If a user logs into a new device, older active sessions are instantly invalidated.
- **Smart Storage**:
-   *Browser Users*: Temporary session storage that automatically logs out on exit for shared computers.
-   *App/PWA Users*: Persistent local storage featuring a rolling 7-day authentication window.

### 🛡️ Admin HQ Portal
- **Centralized Management**: Full control over papers, subjects, and student records.
- **Bulk Upload Workflow**: Spreadsheet-style interface for uploading hundreds of papers with real-time duplicate detection, auto-retry, and selective row retention.
- **Form Draft Persistence**: Upload forms auto-save to `localStorage` as you type, surviving accidental refreshes.
- **Payment Report Export**: CSV export of all transaction records.
- **Failed Join Attempts Monitor**: Real-time dashboard monitoring of registration failures.
- **AI Health Monitoring**: Real-time status indicators for API quota and processing status.

### 🔒 AI Academic Guardrails
- **Off-Topic Refusal**: The AI Tutor is strictly restricted to academic, educational, and course-related topics.
- **Zero Leakage Policy**: Non-academic queries receive a polite refusal — no answers, scores, or details are leaked.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion.
- **Backend**: Node.js, Express, TypeScript.
- **Database**: Supabase (PostgreSQL) + Auth.
- **Cache & Rate Limiting**: Upstash Redis (REST client) + `@upstash/ratelimit`.
- **File Storage**: Cloudflare R2 (S3-Compatible) for ultra-fast PDF delivery.
- **AI Models**: Hugging Face Serverless APIs + Puter.js SDK + Google Gemini API.
- **OCR Engine**: Google Cloud Vision + Tesseract.js.
- **Payments**: Paystack Integration.
- **Hosting**: Vercel (Frontend + Backend).

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
GOOGLE_APPLICATION_CREDENTIALS_JSON=your_google_cloud_vision_json_string (optional for Google Vision OCR)
PUTER_AUTH_TOKEN=your_puter_token (optional fallback)

# Hugging Face Inference API
HF_TABLE_NAME=upsa_hf_config
HF_KEY_COLUMN=hf_api_key
HF_MODEL_COLUMN=model_names

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

# Redis (Upstash Serverless)
UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
```

---

## 🗄️ Database Setup & Constraints (Critical)

To run this project, execute the following SQL scripts in your **Supabase SQL Editor** to configure tables, indexes, and custom constraints.

### 1. Admin Notifications Table Constraints
```sql
ALTER TABLE upsa_admin_notifications 
DROP CONSTRAINT IF EXISTS upsa_admin_notifications_type_check;

ALTER TABLE upsa_admin_notifications 
ADD CONSTRAINT upsa_admin_notifications_type_check 
CHECK (type IN ('signup', 'payment', 'alert', 'warning', 'info', 'report'));
```

### 2. Broadcast Mail Failures Table
Stores failed email deliveries per broadcast run so they can be retried from the Admin Broadcast UI:
```sql
CREATE TABLE IF NOT EXISTS broadcast_failures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id  UUID NOT NULL,
  email         TEXT NOT NULL,
  error_reason  TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_failures_broadcast_id
  ON broadcast_failures (broadcast_id);

ALTER TABLE broadcast_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broadcast_failures_service_all"
  ON broadcast_failures FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### 3. Cron Failures Table
Stores failed email deliveries from the biweekly digest cron so they can be reviewed and retried from the Admin dashboard:
```sql
CREATE TABLE IF NOT EXISTS cron_failures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  user_type     TEXT NOT NULL, -- 'active' or 'inactive'
  error_reason  TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_failures_email
  ON cron_failures (email);

ALTER TABLE cron_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cron_failures_service_all"
  ON cron_failures FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### 4. App Config Cron Timing Column
Ensure the application configuration table has the biweekly last-run timing column:
```sql
ALTER TABLE upsa_app_config 
ADD COLUMN IF NOT EXISTS last_digest_run_at TIMESTAMP WITH TIME ZONE;
```

---

## 📦 Local Installation & Development

1. **Clone & Install Dependencies**:
   ```bash
   npm install
   cd server && npm install
   ```

2. **Run Development Mode**:
   - **Frontend**: `npm run dev` (Root)
   - **Backend**: `npm run dev` (Inside `/server`)

---

## 📂 Project Structure

```
├── public/             # Static frontend assets (sitemap, robots.txt, PWA manifest)
├── server/             # Express Backend
│   ├── dist/           # Production-ready JavaScript (compiled)
│   ├── src/
│   │   ├── lib/        # Core utilities (OCR, AI, Supabase, R2, mailer)
│   │   ├── middleware/  # Auth & rate-limiting middleware
│   │   ├── routes/     # Express route controllers
│   │   └── index.ts    # Server Entry Point
│   └── tsconfig.json
├── src/                # React Frontend
│   ├── components/     # UI Components
│   ├── context/        # Global Auth & Styling Providers
│   ├── lib/            # API wrappers
│   ├── pages/          # Layouts & routing configurations
│   └── App.tsx         # Main entry component
└── vercel.json         # Vercel Configuration for SPA Frontend deployment
```

---

## 📜 License
Developed for the **UPSA AI Academic Initiative**. All rights reserved.
