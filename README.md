# ⚡ Kam Connect

**A full-stack local services & hiring platform** — connecting workers, employers, and customers across Pune, Mumbai, Nashik and beyond.

![Kam Connect](https://img.shields.io/badge/Platform-Local%20Services%20%26%20Hiring-0EA5E9?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js)
![SQLite](https://img.shields.io/badge/Database-SQLite%20%2F%20sql.js-003B57?style=for-the-badge&logo=sqlite)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel)

---

## 🌐 Live Website

> ### 🔗 **[https://kam-connect.vercel.app](https://kam-connect.vercel.app)**
> *Deployed on Vercel — Always live, always free*

**Demo Login — No OTP needed:**
| Role | What you can do |
|---|---|
| 👤 **Customer** | Browse workers, search services, save favorites |
| 🔧 **Worker** | Create profile, apply for jobs, manage applications |
| 🏢 **Employer** | Post jobs, view applicants, manage dashboard |
| 🛡 **Admin** | Moderate workers, handle reports, view stats |

---

## ✨ Features

### 🔍 Services & Workers
- Browse **8+ categories**: Plumbing, Electrical, Carpentry, Painting, Cleaning, Mechanic, Delivery, Gardening
- Filter by category, availability, city
- Worker profiles with ratings, reviews, skills, experience
- **Call** or **WhatsApp** directly from profile
- Save favorites ❤️

### 💼 Jobs
- Full job listings with filters (Full-time, Part-time, Daily Wage, Contract)
- Filter by category and city
- One-tap job applications with cover note
- Real-time application status tracking

### 🤖 AI Chatbot (Kam AI)
- ChatGPT-style floating chatbot
- Live data: find workers, browse jobs, check stats
- General knowledge: time, date, GK questions, math calculations
- Typing animation, markdown rendering, quick-reply buttons
- Works even offline with local fallback

### 📱 More Features
- 🔔 Real-time Notifications
- 💬 In-app Messaging
- ⭐ Reviews & Ratings system
- 📋 Employer Dashboard with applicant management
- 🛡 Admin Panel (reports, worker verification, banning)
- 📍 Location-based search
- 🎤 Voice Search
- 🌐 Multi-language support (English, Hindi, Marathi)
- 🌟 Light Theme UI

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML, CSS, JavaScript (Single Page App) |
| **Backend** | Node.js + Express.js |
| **Database** | SQLite via `sql.js` (file-based locally, in-memory on Vercel) |
| **Deployment** | Vercel (serverless) |
| **Styling** | Custom CSS with CSS Variables (Light Theme) |

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js v18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/luckyrewatkar12-create/kam-connect.git
cd kam-connect

# Install dependencies
npm install

# Start the server
npm start
```

Open **http://localhost:3000** in your browser.

### Development Mode (auto-reload)
```bash
npm run dev
```

---

## 📁 Project Structure

```
kam-connect/
├── api/
│   └── index.js          ← Vercel serverless entry point
├── data/
│   └── kam.db            ← SQLite database (local only)
├── index.html            ← Full single-page frontend app
├── server.js             ← Express server (local development)
├── db.js                 ← SQLite database helper (file-based)
├── db-vercel.js          ← SQLite database helper (in-memory for Vercel)
├── vercel.json           ← Vercel deployment configuration
├── package.json
└── README.md
```

---

## 🌐 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/send-otp` | Send OTP to phone |
| POST | `/api/auth/verify-otp` | Verify OTP & login |
| POST | `/api/auth/demo-login` | Demo login by role |

### Workers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/workers` | List all workers (filterable) |
| GET | `/api/workers/:id` | Get worker by ID |
| PUT | `/api/workers/:id` | Create/update worker profile |

### Jobs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/jobs` | List all jobs (filterable) |
| GET | `/api/jobs/:id` | Get job by ID |
| POST | `/api/jobs` | Create new job |
| PUT | `/api/jobs/:id` | Update job |
| PATCH | `/api/jobs/:id/close` | Close job |

### Applications, Reviews, Notifications, Messages, Favorites, Reports, Admin, Search, AI Chat
> All standard REST endpoints — see `server.js` or `api/index.js` for full list.

---

## 🤖 AI Chatbot Capabilities

The built-in **Kam AI** assistant can answer:

- 🔍 **"Find a plumber in Pune"** — shows available workers
- 💼 **"Show jobs in Mumbai"** — lists active jobs
- 📊 **"How many workers are there?"** — live platform stats
- 💰 **"What are the wage rates?"** — min/max/avg wages
- 📋 **"How do I apply for a job?"** — step-by-step guide
- 🌍 **"Capital of India?"** — general knowledge
- 🕐 **"What time is it?"** — current IST time
- 🔢 **"What is 25 × 4?"** — math calculations
- 😄 **"Tell me a joke"** — fun responses

---

## 🚀 Deploy to Vercel

1. Fork this repository
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import your forked repo
4. Leave all settings as default — `vercel.json` handles everything
5. Click **Deploy** ✅
6. Get your live link: `https://your-project.vercel.app`

> **Note:** On Vercel, the database runs in-memory and resets on cold starts. Demo seed data always comes back automatically. For persistent storage, integrate [PlanetScale](https://planetscale.com) or [Supabase](https://supabase.com).

---

## 📸 Screenshots

| Screen | Description |
|---|---|
| 🏠 **Home** | Hero search, quick actions, service categories, nearby workers |
| 🔍 **Search** | Full-text search across workers, jobs, services |
| 💼 **Jobs** | Filter by type, category, location |
| 👷 **Services** | Browse workers by category with availability filter |
| 🤖 **Kam AI** | Floating chatbot with live platform data |
| 👤 **Profile** | Role-based profile (Customer / Worker / Employer / Admin) |
| 🏢 **Dashboard** | Employer dashboard with job & applicant management |
| 🛡 **Admin** | Platform moderation panel |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — free to use, modify and distribute.

---

## 👨‍💻 Developer

Built with ❤️ by **Lucky Rewatkar**

[![GitHub](https://img.shields.io/badge/GitHub-luckyrewatkar12--create-181717?style=flat&logo=github)](https://github.com/luckyrewatkar12-create)

---

> ⚡ **Kam Connect** — *Connect. Work. Grow.*
