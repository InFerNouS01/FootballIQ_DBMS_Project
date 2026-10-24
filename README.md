# FootballIQ — Football Analytics & Statistics System

A medium-complexity DBMS college project featuring a React dashboard, Node.js/Express REST API, and MySQL relational database. The included data is illustrative sample data for a classroom demo; it is not a verified live football feed.

## Features
- Overview dashboard: teams, players, played matches, total goals, recent results, top scorers and league goal totals.
- Overview dashboard with league totals, recent fixtures and top scorers.
- Player directory with goals, assists, minutes, rating, expected goals (xG), expected assists (xA), distance covered, shots and key passes.
- Head-to-head player comparison panel with season totals and per-90 rates.
- Data management: create/update/delete players, add fixtures, and insert or update player-match statistics.
- SQL Lab that explains SELECT, JOIN, GROUP BY, HAVING, subqueries, INSERT, UPDATE, DELETE, ALTER, DROP, views, transactions and EXPLAIN.
- MySQL schema with primary/foreign keys, unique constraints, checks, indexes, a view, a stored procedure and a data-validation trigger.
- Parameterized SQL for API writes and search filters; destructive operations require confirmation in the UI.
- Frontend includes demo data if the API is unavailable. All seeded football metrics are illustrative sample data, not verified live statistics.

## Stack
- Frontend: React 18 + Vite + plain CSS + Lucide icons
- Backend: Node.js + Express + mysql2
- Database: MySQL 8.0+

## Folder structure
```
footballiq/
├── database.sql
├── README.md
├── ER_DIAGRAM.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── src/{db.js,server.js}
└── frontend/
    ├── index.html
    ├── package.json
    └── src/{main.jsx,styles.css}
```

## Requirements
Install Node.js 18+ and MySQL 8+. You can use MySQL Workbench for database setup.

## 1. Create the database and sample data
1. Start your MySQL server.
2. Open `database.sql` in MySQL Workbench and execute the whole file, or run:
   ```bash
   mysql -u root -p < database.sql
   ```
3. The script creates `footballiq`, its tables and reporting objects, then inserts sample leagues, clubs, players, matches, player statistics and match events. It includes xG, xA, distance covered, shots and key passes.

> **Warning:** `database.sql` drops and recreates the project tables. Do not run it against a database containing data you need to keep. If you already imported the older FootballIQ schema, open and execute `database_upgrade.sql` instead. It adds the missing metric columns, creates the view/procedure/trigger, and does not drop existing tables.

## 2. Configure and run the backend
Open a terminal in `footballiq/backend`:
```bash
npm install
```
On Windows, run `copy .env.example .env` from the backend folder (or copy/rename the file in File Explorer). Then edit `.env` and set your MySQL password and database settings. Example:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=footballiq
```
Start the API:
```bash
npm run dev
```
(or `npm start`.) It should run at `http://localhost:5000`. Test `http://localhost:5000/api/health` and expect `{ "status": "ok", "database": "connected" }`.

## 3. Run the React frontend
Open another terminal in `footballiq/frontend`:
```bash
npm install
npm run dev
```
Open the local URL printed by Vite, typically `http://localhost:5173`.

The frontend calls `http://localhost:5000/api` by default. If your backend is on another URL, create `frontend/.env` with:
```env
VITE_API_URL=http://localhost:5000/api
```
Restart Vite after changing environment variables.

## API endpoints
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check API and database connection |
| GET | `/api/dashboard` | Summary metrics, recent matches, scorers and league goals |
| GET | `/api/leagues` | List leagues |
| GET | `/api/teams?search=city` | Search teams, city or league |
| GET | `/api/players?search=salah` | Search players, clubs or position |
| GET | `/api/matches` | List results and fixtures |
| GET | `/api/standings/1` | Calculate standings for league ID 1 |

## Suggested viva walkthrough
1. Show the dashboard and explain the React → Express API → MySQL flow.
2. Open **Players** and explain aggregate queries for goals, xG, xA, distance and per-90 metrics.
3. Open **Compare** and compare two players; explain why per-90 values account for differences in playing time.
4. Open **Manage Data**: add a player, edit it, delete only a demo record, add a fixture, and save player-match stats. Explain INSERT, UPDATE, DELETE, parameterized queries and foreign-key cascades.
5. Open **SQL Lab** and discuss JOIN, GROUP BY, HAVING, subqueries, ALTER, DROP, views, transactions and EXPLAIN. Run the safer examples in `SQL_QUERIES.md` in Workbench.
6. Explain PK/FK constraints, normalization, unique `(player_id, match_id)`, the comparison view, the stored procedure and the validation trigger.

## Data quality note
xG, xA, distance covered, shots and key passes in the included sample are illustrative classroom values. Replace them with sourced match data if the project is extended beyond a DBMS demonstration.

## Scope and limitations
- This project uses sample data and does not connect to an external football API.
- There is no login system or admin CRUD screen in this medium starter version; those are suitable extensions if your rubric requires them.
- Match dates and statistics are seeded examples for UI/SQL demonstration and should not be represented as current verified results.
- The API uses parameterized SQL for search and league IDs. Before public deployment, add authentication/authorization, request validation, rate limiting, stricter CORS configuration and centralized logging.
