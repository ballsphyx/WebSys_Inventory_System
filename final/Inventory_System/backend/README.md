# Inventory System Backend + Frontend

FastAPI + SQLAlchemy + SQLite backend connected to the existing HTML/CSS/JavaScript frontend.

## Project layout

```text
Inventory_System/
├── backend/
└── frontend/
```

## Backend setup (Linux / Fish shell)

```fish
cd backend
python -m venv .venv
source .venv/bin/activate.fish
pip install -r requirements.txt
cp .env.example .env
nano .env
```

Set a unique `APP_SECRET_KEY`, the owner `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD` of at least 12 characters. The owner account is created only on the first startup. Changing `ADMIN_PASSWORD` later does not reset an existing account.

Start FastAPI (loads `.env` using Bash while leaving your login shell as Fish):

```fish
bash -c 'set -a; source .env; set +a; uvicorn app.main:app --reload'
```

API: http://127.0.0.1:8000  
Interactive API docs: http://127.0.0.1:8000/docs

## Frontend setup

Open a second terminal and serve the `frontend` folder using the same host name as the API:

```fish
cd ../frontend
python -m http.server 5500 --bind 127.0.0.1
```

Open http://127.0.0.1:5500. Use `127.0.0.1` for both frontend and backend (do not mix it with `localhost`) so the browser sends the session cookie consistently.

The frontend API client is `frontend/js/api.js`. Its default API URL is `http://127.0.0.1:8000`; it can be overridden by setting `window.INVENTORY_API_BASE` before loading `api.js`.

## Connected features

- Login, session validation, and logout use the backend's HttpOnly session cookie.
- Inventory list, create, and edit use `/api/products`.
- Stock-in, stock-out, and adjustment use `/api/transactions`; stock and transaction changes are committed together by the backend.
- Dashboard counts, low-stock products, and recent activity use `/api/dashboard`.
- Reports are calculated from products and transactions loaded from the protected API endpoints.
- SQLite is the source of truth. The frontend no longer uses localStorage for product or transaction records.

## API endpoints

- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `GET/POST /api/products`, `GET/PUT/DELETE /api/products/{id}`
- `GET/POST /api/transactions`, `PUT /api/transactions/{id}`
- `GET /api/dashboard`
- `GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

Transaction types are `In`, `Out`, and `Adjustment`. Product stock starts at zero and changes through transactions. Product deletion is blocked when transaction history exists so reports remain auditable.
