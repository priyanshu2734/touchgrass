# TouchGrass 🌿

**Less scrolling. More living.**

An open-source outdoor activity planner that helps you turn your available time, budget, interests, and energy into a practical plan for going outside.

🌐 **[Live Demo](https://touchgrass-gsum.onrender.com/)** · 💻 **[Source Code](https://github.com/priyanshu2734/touchgrass)**

TouchGrass combines a React and TypeScript frontend with a Python FastAPI backend, SQLite storage, OpenStreetMap-based place discovery, and an Ollama-based local AI planning system.

> **Demo note:** The hosted demo uses the frontend's demo mode. The full local application is designed to use the FastAPI backend and Ollama for AI-powered planning. See the setup instructions below to run the full application locally.

## ✨ Features

- **Activity Planner:** Create outdoor activity plans based on time, budget, interests, energy, and preferences.
- **Place Discovery:** Explore parks, gardens, viewpoints, and other outdoor places using OpenStreetMap data.
- **Outdoor Quests:** Choose practical challenges suited to your available time and circumstances.
- **Progress Tracking:** Track completed quests, time spent outdoors, streaks, and personal notes.
- **Fallback Planning:** Use built-in activity suggestions when the local AI model is unavailable.
- **Privacy-Conscious Design:** Location access is optional, and the local AI setup is designed to run through Ollama on your own computer.

## 🛠️ Tech Stack

| Component | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Python, FastAPI, Pydantic |
| Database | SQLite |
| AI | Ollama with an open-weight model, defaulting to Gemma 3 4B |
| Place Discovery | OpenStreetMap, Overpass API, Nominatim |
| Testing | Vitest, Pytest |

## 🚀 Run Locally

### Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer
- Ollama
- Git

### 1. Clone the repository

```bash
git clone https://github.com/priyanshu2734/touchgrass.git
cd touchgrass
```

### 2. Set up Ollama

Install Ollama from [ollama.com/download](https://ollama.com/download), then run:

```bash
ollama pull gemma3:4b
ollama list
```

### 3. Start the backend

Open a terminal:

```bash
cd backend
python -m venv .venv
```

Activate the environment on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies and configure the environment:

```bash
pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Start the backend:

```bash
uvicorn app.main:create_app --factory --reload --port 8000
```

Backend API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### 4. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open the local URL displayed by Vite, usually [http://localhost:5173](http://localhost:5173).

Keep Ollama and the backend running while using the full local application.

## 🧪 Testing

Backend tests:

```bash
cd backend
pytest
```

Frontend checks:

```bash
cd frontend
npx tsc --noEmit
npm test
npm run build
```

See the project documentation for test coverage, architecture, API details, and troubleshooting.

## 🗂️ Project Structure

```text
touchgrass/
├── backend/       # FastAPI application and backend tests
├── frontend/      # React and TypeScript application
├── docs/          # Architecture, API and testing documentation
├── screenshots/   # Project screenshots
├── scripts/       # Development utilities
├── LICENSE
└── README.md
```

## 🔒 Privacy and Limitations

- Location access is optional.
- The full local AI setup uses Ollama on the user's computer.
- Place discovery depends on public OpenStreetMap services, which may occasionally be unavailable.
- The hosted demo uses sample/demo behavior and should not be confused with the full local AI-backed application.

## 🤝 Contributing

Suggestions, bug reports, and improvements are welcome. Open an issue or submit a pull request through GitHub.

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

Built to help people spend less time scrolling and more time exploring the world. 🌱
