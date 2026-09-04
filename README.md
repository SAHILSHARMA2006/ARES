# ARES

ARES is a React/Vite frontend backed by a FastAPI service running the local SRCNN model.

The backend is pinned to Python 3.12 because TensorFlow does not yet provide a compatible Render wheel for Python 3.14.

## Deploy for free

The simplest setup uses two services because static frontend hosting cannot run the Python model:

1. Push this project to a GitHub repository. Keep `backend/best_srcnn.keras` in the repository.
2. In Render, create a new Blueprint from the repository. Render will read `render.yaml` and deploy the API. The free service may sleep after inactivity.
3. Copy the deployed API URL, for example `https://ares-api.onrender.com`.
4. In Vercel, import the same GitHub repository. Use the default Vite settings: build command `npm run build`, output directory `dist`.
5. In Vercel project settings, add the environment variable `VITE_API_BASE_URL` with the Render API URL, then redeploy.
6. Open the Vercel URL and upload a PNG or JPG. The first request after the Render service sleeps can take a minute while it wakes up.

For local development, leave `VITE_API_BASE_URL` unset and run the backend on `http://127.0.0.1:8000`.

## Local commands

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
npm run dev
```

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
