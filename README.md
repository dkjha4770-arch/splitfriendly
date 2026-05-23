# Split-Friendly Deployment Guide

This repository contains a full-stack expense splitting web application structured for production deployment.

## Project Structure
*   **[frontend/](file:///c:/projects/split-friendly-react/frontend)**: React + Vite application.
*   **[backend/](file:///c:/projects/split-friendly-react/backend)**: Node.js + Express API server, configured for PostgreSQL / Neon.

---

## Prerequisites
1.  **Neon Account**: For serverless PostgreSQL hosting ([neon.tech](https://neon.tech)).
2.  **Render Account**: For backend Express API hosting ([render.com](https://render.com)).
3.  **Vercel Account**: For frontend React hosting ([vercel.com](https://vercel.com)).

---

## 1. Database Setup (Neon)
1.  Sign up on [Neon](https://neon.tech) and create a new PostgreSQL database.
2.  Retrieve your connection string (`postgresql://...`).
3.  Add the connection string to `backend/.env` (locally):
    ```env
    DATABASE_URL=your_neon_connection_string
    ```
4.  Run the initializer script to build your tables and seed the admin user:
    ```bash
    node backend/neon_db_init.js
    ```

---

## 2. Backend Setup & Deployment (Render)
1.  Create a new **Web Service** on Render and link it to your repository.
2.  Use these configurations:
    *   **Root Directory**: `backend`
    *   **Build Command**: `npm install`
    *   **Start Command**: `node index.js`
3.  Add the following **Environment Variables** in Render's dashboard:
    *   `DATABASE_URL`: *(Your Neon connection string)*
    *   `JWT_SECRET`: *(A secure secret key, e.g. from `openssl rand -base64 32`)*
    *   `NODE_ENV`: `production`
    *   `ALLOWED_ORIGINS`: `https://your-app.vercel.app` *(Your Vercel deployment URL)*
4.  Note down the Render deployment URL (e.g. `https://your-api.onrender.com`).

---

## 3. Frontend Setup & Deployment (Vercel)
Vercel can proxy requests automatically or utilize Vite environment variables.

### Option A: Automatic Proxy (Recommended)
1.  Open `frontend/vercel.json`.
2.  Replace the destination URL (`https://your-backend-api-name.onrender.com`) with your actual Render API URL.
3.  Commit and push this change to Git.
4.  On Vercel, import the repository and deploy with:
    *   **Root Directory**: `frontend`
    *   **Build Command**: `npm run build`
    *   **Output Directory**: `dist`
    *   **Install Command**: `npm install`

### Option B: Direct API Requests
1.  On Vercel, set the following environment variable during configuration:
    *   `VITE_API_URL`: `https://your-api.onrender.com`
2.  Deploy the project.

---

## Security Best Practices
*   Never check in actual `.env` files to git.
*   `.gitignore` files have been set up at the root, frontend, and backend folders to protect secrets.
*   Modify `backend/.env.example` and `frontend/.env.example` template files if introducing new environment parameters.
