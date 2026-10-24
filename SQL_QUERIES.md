# FootballIQ — SQL Query Lab & DBMS Viva Guide

Run these in MySQL Workbench after importing `database.sql` or applying `database_upgrade.sql`. The bundled rows are illustrative classroom data, not verified live football statistics.

> **Safety:** `database.sql` rebuilds the project tables. Never run it over data you need to keep. For an existing installation, run `database_upgrade.sql`. `DELETE`, `DROP`, and schema-changing statements can permanently remove data; test them on a demo table and take a backup first.

## 1. SELECT, WHERE, ORDER BY, LIMIT
```sql
SELECT player_name, position, nationality, age
FROM players
WHERE position = 'FWD' AND age < 30
ORDER BY age ASC
LIMIT 10;
```

## 2. INNER JOIN across players, teams and leagues
```sql
SELECT p.player_name, p.position, t.team_name, l.league_name
FROM players p
JOIN teams t ON t.team_id = p.team_id
JOIN leagues l ON l.league_id = t.league_id
ORDER BY l.league_name, t.team_name, p.player_name;
```

## 3. LEFT JOIN to include clubs without player statistics
```sql
SELECT p.player_name, COALESCE(SUM(ps.goals),0) AS goals
FROM players p LEFT JOIN player_stats ps ON ps.player_id=p.player_id
GROUP BY p.player_id,p.player_name ORDER BY goals DESC;
```

## 4. Aggregates, GROUP BY and ORDER BY
```sql
SELECT p.player_name, SUM(ps.goals) AS goals, SUM(ps.assists) AS assists,
       ROUND(SUM(ps.xg),2) AS xg, ROUND(SUM(ps.xa),2) AS xa
FROM players p JOIN player_stats ps ON ps.player_id=p.player_id
GROUP BY p.player_id,p.player_name
ORDER BY goals DESC, assists DESC;
```

## 5. HAVING filters aggregated results
```sql
SELECT p.player_name, SUM(ps.goals) AS total_goals
FROM players p JOIN player_stats ps ON ps.player_id=p.player_id
GROUP BY p.player_id,p.player_name
HAVING SUM(ps.goals) >= 2
ORDER BY total_goals DESC;
```

## 6. Subquery: players whose xG is above the average player total
```sql
SELECT p.player_name, totals.total_xg
FROM players p
JOIN (SELECT player_id, SUM(xg) AS total_xg FROM player_stats GROUP BY player_id) totals
  ON totals.player_id=p.player_id
WHERE totals.total_xg > (
  SELECT AVG(player_xg) FROM (
    SELECT SUM(xg) AS player_xg FROM player_stats GROUP BY player_id
  ) AS per_player
)
ORDER BY totals.total_xg DESC;
```

## 7. Player comparison view
```sql
SELECT * FROM v_player_comparison ORDER BY xg DESC, xa DESC;
```

## 8. INSERT a player (add data)
```sql
INSERT INTO players (team_id,player_name,position,nationality,age,shirt_number)
VALUES (1,'Demo Player','MID','India',21,99);
```

## 9. UPDATE a player (edit data)
```sql
UPDATE players SET nationality='England', age=22 WHERE player_id=999;
-- Always verify the target first; use the actual ID you intend to update.
SELECT * FROM players WHERE player_id=999;
```

## 10. DELETE a record safely with a transaction
```sql
START TRANSACTION;
SELECT * FROM players WHERE player_id=999;
DELETE FROM players WHERE player_id=999;
-- If the result is correct:
COMMIT;
-- If you changed the wrong row, run ROLLBACK instead of COMMIT.
```
Deleting a player cascades to that player's statistics and match events because of the foreign-key rules.

## 11. UPSERT match-level player stats
The API uses `INSERT ... ON DUPLICATE KEY UPDATE` because each player can have one stats row per match.
```sql
INSERT INTO player_stats
(player_id,match_id,appearances,minutes_played,goals,assists,rating,xg,xa,distance_covered_km,shots,key_passes)
VALUES (1,1,1,90,1,0,8.2,0.82,0.05,9.4,4,1)
ON DUPLICATE KEY UPDATE minutes_played=VALUES(minutes_played),goals=VALUES(goals),
assists=VALUES(assists),rating=VALUES(rating),xg=VALUES(xg),xa=VALUES(xa),
distance_covered_km=VALUES(distance_covered_km),shots=VALUES(shots),key_passes=VALUES(key_passes);
```

## 12. ALTER TABLE — add a new metric
```sql
ALTER TABLE player_stats ADD COLUMN pressing_actions INT NOT NULL DEFAULT 0;
```
Run only once, because the column will exist after the first successful execution. The upgraded schema already includes xG, xA, distance covered, shots and key passes.

## 13. DROP a temporary table (safe demonstration)
```sql
CREATE TABLE demo_drop_me (id INT PRIMARY KEY, note VARCHAR(50));
INSERT INTO demo_drop_me VALUES (1,'temporary demo');
SELECT * FROM demo_drop_me;
DROP TABLE demo_drop_me;
```
Do **not** practice `DROP TABLE players`, `DROP DATABASE footballiq`, or run the destructive base setup script against data you need.

## 14. View definition
```sql
CREATE OR REPLACE VIEW v_player_comparison AS
SELECT p.player_id,p.player_name,t.team_name,
       COALESCE(SUM(ps.goals),0) AS goals,
       COALESCE(ROUND(SUM(ps.xg),2),0) AS xg,
       COALESCE(ROUND(SUM(ps.xa),2),0) AS xa
FROM players p JOIN teams t ON t.team_id=p.team_id
LEFT JOIN player_stats ps ON ps.player_id=p.player_id
GROUP BY p.player_id,p.player_name,t.team_name;
```

## 15. Stored procedure
```sql
CALL GetLeagueResults(1);
```
The procedure returns played match results for the supplied league ID.

## 16. Trigger
The `before_player_stats_insert` trigger rejects negative xG, xA and distance values and ratings outside 0–10. Test it with a deliberately invalid value only inside a transaction or use a separate test database.

## 17. Transaction: update a match result
```sql
START TRANSACTION;
UPDATE matches SET home_score=2,away_score=1,status='Played' WHERE match_id=5;
SELECT match_id,home_score,away_score,status FROM matches WHERE match_id=5;
-- COMMIT;   -- save after verifying
-- ROLLBACK; -- cancel instead if incorrect
```

## 18. Index and query plan
```sql
EXPLAIN SELECT * FROM player_stats WHERE player_id=1 AND match_id=1;
SHOW INDEX FROM player_stats;
```

## 19. DISTINCT and COUNT
```sql
SELECT COUNT(DISTINCT team_id) AS teams_with_players FROM players;
```

## 20. CASE expression: match outcome labels
```sql
SELECT match_id,
       CASE WHEN home_score>away_score THEN 'Home win'
            WHEN home_score<away_score THEN 'Away win'
            ELSE 'Draw' END AS outcome
FROM matches WHERE status='Played';
```

## 21. UNION: merge player and club search results
```sql
SELECT player_name AS result_name,'Player' AS result_type FROM players WHERE player_name LIKE '%Saka%'
UNION
SELECT team_name AS result_name,'Club' AS result_type FROM teams WHERE team_name LIKE '%Saka%';
```

## Viva concepts
- **DDL:** `CREATE`, `ALTER`, `DROP` define/change database objects.
- **DML:** `INSERT`, `UPDATE`, `DELETE` change rows.
- **DQL:** `SELECT` retrieves rows.
- **Primary key:** unique row identifier.
- **Foreign key:** enforces relationships between tables.
- **JOIN:** combines related rows from tables.
- **GROUP BY / HAVING:** aggregate rows, then filter aggregated groups.
- **View:** stored query definition that behaves like a virtual table.
- **Stored procedure:** named SQL routine stored in the database.
- **Trigger:** SQL routine automatically run on an INSERT/UPDATE/DELETE event.
- **Transaction:** a set of changes saved with `COMMIT` or cancelled with `ROLLBACK`.
- **Index:** data structure that can speed up selected lookups, with storage/write overhead.
- **xG / xA:** expected goals / expected assists; sample values in this project are illustrative.
