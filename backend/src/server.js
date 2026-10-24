const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./db');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const number = (value, fallback = null) => value === '' || value === undefined || value === null ? fallback : Number(value);
const positiveInt = (v) => Number.isInteger(Number(v)) && Number(v) > 0;
const positions = new Set(['GK', 'DEF', 'MID', 'FWD']);
const statuses = new Set(['Scheduled', 'Played', 'Postponed']);

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));

app.get('/api/dashboard', asyncRoute(async (_req, res) => {
  const [[summary]] = await pool.query(`SELECT
    (SELECT COUNT(*) FROM teams) AS teams,
    (SELECT COUNT(*) FROM players) AS players,
    (SELECT COUNT(*) FROM matches WHERE status = 'Played') AS playedMatches,
    (SELECT COALESCE(SUM(home_score + away_score),0) FROM matches WHERE status = 'Played') AS totalGoals,
    (SELECT COUNT(*) FROM player_stats) AS statRows`);
  const [recentMatches] = await pool.query(`SELECT m.match_id,m.match_date,m.home_score,m.away_score,m.status,
    ht.team_name AS home_team,ht.short_name AS home_short,ht.primary_color AS home_color,
    at.team_name AS away_team,at.short_name AS away_short,at.primary_color AS away_color,l.league_name
    FROM matches m JOIN teams ht ON ht.team_id=m.home_team_id JOIN teams at ON at.team_id=m.away_team_id
    JOIN leagues l ON l.league_id=m.league_id ORDER BY m.match_date DESC LIMIT 6`);
  const [topScorers] = await pool.query(`SELECT p.player_id,p.player_name,t.team_name,t.short_name,
    SUM(ps.goals) AS goals,SUM(ps.assists) AS assists,SUM(ps.minutes_played) AS minutes
    FROM players p JOIN teams t ON t.team_id=p.team_id JOIN player_stats ps ON ps.player_id=p.player_id
    GROUP BY p.player_id,p.player_name,t.team_name,t.short_name ORDER BY goals DESC,assists DESC LIMIT 5`);
  const [leagueGoals] = await pool.query(`SELECT l.league_name,COUNT(m.match_id) AS matches_played,
    COALESCE(SUM(m.home_score+m.away_score),0) AS goals FROM leagues l LEFT JOIN matches m
    ON m.league_id=l.league_id AND m.status='Played' GROUP BY l.league_id,l.league_name ORDER BY goals DESC`);
  res.json({ summary, recentMatches, topScorers, leagueGoals });
}));

app.get('/api/leagues', asyncRoute(async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM leagues ORDER BY league_name');
  res.json(rows);
}));

app.get('/api/teams', asyncRoute(async (req, res) => {
  const search = `%${String(req.query.search || '').slice(0, 100)}%`;
  const [rows] = await pool.query(`SELECT t.team_id,t.league_id,t.team_name,t.short_name,t.city,t.primary_color,l.league_name,
    COUNT(DISTINCT p.player_id) AS squad_size,COALESCE((SELECT SUM(ps.goals) FROM players p2
    JOIN player_stats ps ON ps.player_id=p2.player_id WHERE p2.team_id=t.team_id),0) AS goals
    FROM teams t JOIN leagues l ON l.league_id=t.league_id LEFT JOIN players p ON p.team_id=t.team_id
    WHERE t.team_name LIKE ? OR t.city LIKE ? OR l.league_name LIKE ?
    GROUP BY t.team_id,t.league_id,t.team_name,t.short_name,t.city,t.primary_color,l.league_name ORDER BY t.team_name`, [search, search, search]);
  res.json(rows);
}));

const PLAYER_TOTALS_SQL = `SELECT p.player_id,p.team_id,p.player_name,p.position,p.nationality,p.age,p.shirt_number,
  t.team_name,t.short_name,l.league_name,COALESCE(SUM(ps.appearances),0) AS appearances,
  COALESCE(SUM(ps.goals),0) AS goals,COALESCE(SUM(ps.assists),0) AS assists,
  COALESCE(SUM(ps.minutes_played),0) AS minutes,COALESCE(ROUND(AVG(ps.rating),2),0) AS rating,
  COALESCE(ROUND(SUM(ps.xg),2),0) AS xg,COALESCE(ROUND(SUM(ps.xa),2),0) AS xa,
  COALESCE(ROUND(SUM(ps.distance_covered_km),2),0) AS distance_covered_km,
  COALESCE(SUM(ps.shots),0) AS shots,COALESCE(SUM(ps.key_passes),0) AS key_passes,
  COALESCE(ROUND(SUM(ps.goals)*90/NULLIF(SUM(ps.minutes_played),0),2),0) AS goals_per90,
  COALESCE(ROUND(SUM(ps.assists)*90/NULLIF(SUM(ps.minutes_played),0),2),0) AS assists_per90,
  COALESCE(ROUND(SUM(ps.xg)*90/NULLIF(SUM(ps.minutes_played),0),2),0) AS xg_per90,
  COALESCE(ROUND(SUM(ps.xa)*90/NULLIF(SUM(ps.minutes_played),0),2),0) AS xa_per90,
  COALESCE(ROUND(SUM(ps.distance_covered_km)/NULLIF(SUM(ps.appearances),0),2),0) AS distance_per_appearance
  FROM players p JOIN teams t ON t.team_id=p.team_id JOIN leagues l ON l.league_id=t.league_id
  LEFT JOIN player_stats ps ON ps.player_id=p.player_id`;

app.get('/api/players', asyncRoute(async (req, res) => {
  const search = `%${String(req.query.search || '').slice(0, 100)}%`;
  const [rows] = await pool.query(`${PLAYER_TOTALS_SQL}
    WHERE p.player_name LIKE ? OR t.team_name LIKE ? OR p.position LIKE ? OR p.nationality LIKE ?
    GROUP BY p.player_id,p.team_id,p.player_name,p.position,p.nationality,p.age,p.shirt_number,t.team_name,t.short_name,l.league_name
    ORDER BY goals DESC,assists DESC,p.player_name`, [search, search, search, search]);
  res.json(rows);
}));

app.get('/api/players/:id', asyncRoute(async (req, res) => {
  if (!positiveInt(req.params.id)) return res.status(400).json({ error: 'Invalid player id' });
  const [rows] = await pool.query(`${PLAYER_TOTALS_SQL} WHERE p.player_id=?
    GROUP BY p.player_id,p.team_id,p.player_name,p.position,p.nationality,p.age,p.shirt_number,t.team_name,t.short_name,l.league_name`, [Number(req.params.id)]);
  if (!rows.length) return res.status(404).json({ error: 'Player not found' });
  res.json(rows[0]);
}));

app.post('/api/players', asyncRoute(async (req, res) => {
  const { player_name, team_id, position, nationality, age, shirt_number } = req.body;
  if (!String(player_name || '').trim() || !positiveInt(team_id) || !positions.has(position) || !String(nationality || '').trim() || !Number.isInteger(Number(age)) || Number(age) < 15 || Number(age) > 50) {
    return res.status(400).json({ error: 'Provide player_name, valid team_id, position, nationality and age (15–50).' });
  }
  const [result] = await pool.query('INSERT INTO players (team_id,player_name,position,nationality,age,shirt_number) VALUES (?,?,?,?,?,?)',
    [Number(team_id), String(player_name).trim(), position, String(nationality).trim(), Number(age), number(shirt_number)]);
  const [rows] = await pool.query('SELECT * FROM players WHERE player_id=?', [result.insertId]);
  res.status(201).json(rows[0]);
}));

app.put('/api/players/:id', asyncRoute(async (req, res) => {
  if (!positiveInt(req.params.id)) return res.status(400).json({ error: 'Invalid player id' });
  const { player_name, team_id, position, nationality, age, shirt_number } = req.body;
  if (!String(player_name || '').trim() || !positiveInt(team_id) || !positions.has(position) || !String(nationality || '').trim() || !Number.isInteger(Number(age)) || Number(age) < 15 || Number(age) > 50) {
    return res.status(400).json({ error: 'Provide valid player details; age must be 15–50.' });
  }
  const [result] = await pool.query('UPDATE players SET team_id=?,player_name=?,position=?,nationality=?,age=?,shirt_number=? WHERE player_id=?',
    [Number(team_id), String(player_name).trim(), position, String(nationality).trim(), Number(age), number(shirt_number), Number(req.params.id)]);
  const [rows] = await pool.query('SELECT * FROM players WHERE player_id=?', [Number(req.params.id)]);
  if (!rows.length) return res.status(404).json({ error: 'Player not found' });
  res.json(rows[0]);
}));

app.delete('/api/players/:id', asyncRoute(async (req, res) => {
  if (!positiveInt(req.params.id)) return res.status(400).json({ error: 'Invalid player id' });
  const [result] = await pool.query('DELETE FROM players WHERE player_id=?', [Number(req.params.id)]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Player not found' });
  res.json({ message: 'Player deleted. Related stats and events were removed by foreign-key cascade.' });
}));

app.get('/api/matches', asyncRoute(async (req, res) => {
  const [rows] = await pool.query(`SELECT m.match_id,m.league_id,m.home_team_id,m.away_team_id,m.match_date,m.home_score,m.away_score,m.status,m.venue,
    ht.team_name AS home_team,ht.short_name AS home_short,at.team_name AS away_team,at.short_name AS away_short,l.league_name
    FROM matches m JOIN teams ht ON ht.team_id=m.home_team_id JOIN teams at ON at.team_id=m.away_team_id
    JOIN leagues l ON l.league_id=m.league_id ORDER BY m.match_date DESC`);
  res.json(rows);
}));

app.post('/api/matches', asyncRoute(async (req, res) => {
  const { league_id, home_team_id, away_team_id, match_date, venue, home_score, away_score, status = 'Scheduled' } = req.body;
  if (![league_id, home_team_id, away_team_id].every(positiveInt) || Number(home_team_id) === Number(away_team_id) || !match_date || !String(venue || '').trim() || !statuses.has(status)) {
    return res.status(400).json({ error: 'Provide a league, different home/away teams, date, venue and valid status.' });
  }
  const hs = number(home_score), as = number(away_score);
  if (status === 'Played' && (hs === null || as === null || hs < 0 || as < 0)) return res.status(400).json({ error: 'Played matches require non-negative home and away scores.' });
  const [result] = await pool.query(`INSERT INTO matches (league_id,home_team_id,away_team_id,match_date,venue,home_score,away_score,status)
    VALUES (?,?,?,?,?,?,?,?)`, [Number(league_id), Number(home_team_id), Number(away_team_id), String(match_date).replace('T', ' '), String(venue).trim(), hs, as, status]);
  res.status(201).json({ message: 'Match created', match_id: result.insertId });
}));

app.put('/api/matches/:id', asyncRoute(async (req, res) => {
  if (!positiveInt(req.params.id)) return res.status(400).json({ error: 'Invalid match id' });
  const { league_id, home_team_id, away_team_id, match_date, venue, home_score, away_score, status } = req.body;
  if (![league_id, home_team_id, away_team_id].every(positiveInt) || Number(home_team_id) === Number(away_team_id) || !match_date || !String(venue || '').trim() || !statuses.has(status)) return res.status(400).json({ error: 'Invalid match details.' });
  const hs = number(home_score), as = number(away_score);
  if (status === 'Played' && (hs === null || as === null || hs < 0 || as < 0)) return res.status(400).json({ error: 'Played matches require scores.' });
  const [result] = await pool.query(`UPDATE matches SET league_id=?,home_team_id=?,away_team_id=?,match_date=?,venue=?,home_score=?,away_score=?,status=? WHERE match_id=?`,
    [Number(league_id), Number(home_team_id), Number(away_team_id), String(match_date).replace('T', ' '), String(venue).trim(), hs, as, status, Number(req.params.id)]);
  const [exists] = await pool.query('SELECT match_id FROM matches WHERE match_id=?', [Number(req.params.id)]);
  if (!exists.length) return res.status(404).json({ error: 'Match not found' });
  res.json({ message: 'Match updated' });
}));

app.delete('/api/matches/:id', asyncRoute(async (req, res) => {
  if (!positiveInt(req.params.id)) return res.status(400).json({ error: 'Invalid match id' });
  const [result] = await pool.query('DELETE FROM matches WHERE match_id=?', [Number(req.params.id)]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Match not found' });
  res.json({ message: 'Match deleted. Related player stats and events were removed by foreign-key cascade.' });
}));

app.post('/api/player-stats', asyncRoute(async (req, res) => {
  const { player_id, match_id, minutes_played = 90, goals = 0, assists = 0, rating = 6.5, xg = 0, xa = 0, distance_covered_km = 0, shots = 0, key_passes = 0 } = req.body;
  const nums = [minutes_played, goals, assists, rating, xg, xa, distance_covered_km, shots, key_passes].map(Number);
  if (!positiveInt(player_id) || !positiveInt(match_id) || nums.some(n => !Number.isFinite(n)) || nums[0] < 0 || nums[0] > 130 || nums[1] < 0 || nums[2] < 0 || nums[3] < 0 || nums[3] > 10 || nums[4] < 0 || nums[5] < 0 || nums[6] < 0 || nums[7] < 0 || nums[8] < 0) {
    return res.status(400).json({ error: 'Invalid player statistics. Rating must be 0–10; other metrics cannot be negative.' });
  }
  const [result] = await pool.query(`INSERT INTO player_stats (player_id,match_id,appearances,minutes_played,goals,assists,rating,xg,xa,distance_covered_km,shots,key_passes)
    VALUES (?,?,1,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE minutes_played=VALUES(minutes_played),goals=VALUES(goals),assists=VALUES(assists),rating=VALUES(rating),xg=VALUES(xg),xa=VALUES(xa),distance_covered_km=VALUES(distance_covered_km),shots=VALUES(shots),key_passes=VALUES(key_passes)`,
    [Number(player_id), Number(match_id), ...nums]);
  res.status(201).json({ message: result.affectedRows === 2 ? 'Existing player-match statistics updated' : 'Player-match statistics saved' });
}));

app.get('/api/standings/:leagueId', asyncRoute(async (req, res) => {
  const leagueId = Number(req.params.leagueId);
  if (!Number.isInteger(leagueId) || leagueId < 1) return res.status(400).json({ error: 'Invalid league id' });
  const [rows] = await pool.query(`SELECT t.team_id,t.team_name,t.short_name,COUNT(m.match_id) AS played,
    SUM(CASE WHEN (m.home_team_id=t.team_id AND m.home_score>m.away_score) OR (m.away_team_id=t.team_id AND m.away_score>m.home_score) THEN 1 ELSE 0 END) AS won,
    SUM(CASE WHEN m.home_score=m.away_score THEN 1 ELSE 0 END) AS drawn,
    SUM(CASE WHEN (m.home_team_id=t.team_id AND m.home_score<m.away_score) OR (m.away_team_id=t.team_id AND m.away_score<m.home_score) THEN 1 ELSE 0 END) AS lost,
    SUM(CASE WHEN m.home_team_id=t.team_id THEN m.home_score ELSE m.away_score END) AS goals_for,
    SUM(CASE WHEN m.home_team_id=t.team_id THEN m.away_score ELSE m.home_score END) AS goals_against,
    (SUM(CASE WHEN (m.home_team_id=t.team_id AND m.home_score>m.away_score) OR (m.away_team_id=t.team_id AND m.away_score>m.home_score) THEN 1 ELSE 0 END)*3 + SUM(CASE WHEN m.home_score=m.away_score THEN 1 ELSE 0 END)) AS points
    FROM teams t LEFT JOIN matches m ON m.league_id=t.league_id AND m.status='Played' AND (m.home_team_id=t.team_id OR m.away_team_id=t.team_id)
    WHERE t.league_id=? GROUP BY t.team_id,t.team_name,t.short_name ORDER BY points DESC,(goals_for-goals_against) DESC,goals_for DESC`, [leagueId]);
  res.json(rows);
}));

app.get('/api/sql-examples', (_req, res) => {
  res.json([
    { title: 'JOIN player and club data', topic: 'JOIN', description: 'Combine related rows across players, teams and leagues.', sql: `SELECT p.player_name, t.team_name, l.league_name FROM players p JOIN teams t ON t.team_id=p.team_id JOIN leagues l ON l.league_id=t.league_id ORDER BY l.league_name,t.team_name;` },
    { title: 'Top scorers with GROUP BY', topic: 'GROUP BY / SUM', description: 'Aggregate match-level statistics and sort the leaders.', sql: `SELECT p.player_name,SUM(ps.goals) AS goals,SUM(ps.assists) AS assists FROM players p JOIN player_stats ps ON ps.player_id=p.player_id GROUP BY p.player_id,p.player_name ORDER BY goals DESC LIMIT 10;` },
    { title: 'Filter groups with HAVING', topic: 'HAVING', description: 'Show players whose combined goals total at least two.', sql: `SELECT p.player_name,SUM(ps.goals) AS goals FROM players p JOIN player_stats ps ON ps.player_id=p.player_id GROUP BY p.player_id,p.player_name HAVING SUM(ps.goals)>=2;` },
    { title: 'Subquery: above-average xG', topic: 'SUBQUERY', description: 'Compare each player xG total with the average player xG total.', sql: `SELECT p.player_name,SUM(ps.xg) AS total_xg FROM players p JOIN player_stats ps ON ps.player_id=p.player_id GROUP BY p.player_id,p.player_name HAVING SUM(ps.xg) > (SELECT AVG(player_xg) FROM (SELECT SUM(xg) AS player_xg FROM player_stats GROUP BY player_id) x);` },
    { title: 'UPDATE player details', topic: 'UPDATE', description: 'Change one record using its primary key. Replace the ID and value deliberately.', sql: `UPDATE players SET nationality='England' WHERE player_id=1;` },
    { title: 'DELETE a single player', topic: 'DELETE', description: 'Destructive: related stats/events cascade. Test with a transaction and verify the ID first.', sql: `START TRANSACTION;\nDELETE FROM players WHERE player_id=9999;\nSELECT * FROM players WHERE player_id=9999;\nROLLBACK;` },
    { title: 'ALTER TABLE to add a column', topic: 'ALTER TABLE', description: 'Schema change example; this specific column is already part of the upgraded schema.', sql: `ALTER TABLE player_stats ADD COLUMN pressing_actions INT NOT NULL DEFAULT 0;` },
    { title: 'DROP a temporary table', topic: 'DROP', description: 'DROP permanently removes a table. This example uses a temporary demo table only.', sql: `CREATE TABLE IF NOT EXISTS demo_drop_me (id INT PRIMARY KEY);\nDROP TABLE demo_drop_me;` },
    { title: 'Create a reusable VIEW', topic: 'VIEW', description: 'Store a query definition for repeatable reporting.', sql: `CREATE OR REPLACE VIEW v_player_comparison AS SELECT p.player_id,p.player_name,COALESCE(SUM(ps.goals),0) goals,COALESCE(ROUND(SUM(ps.xg),2),0) xg,COALESCE(ROUND(SUM(ps.xa),2),0) xa,COALESCE(ROUND(SUM(ps.distance_covered_km),2),0) distance_km FROM players p LEFT JOIN player_stats ps ON ps.player_id=p.player_id GROUP BY p.player_id,p.player_name;` },
    { title: 'Transaction with rollback option', topic: 'TRANSACTION', description: 'Use COMMIT to save or ROLLBACK to cancel a set of changes.', sql: `START TRANSACTION;\nUPDATE matches SET venue=venue WHERE match_id=1;\nSELECT * FROM matches WHERE match_id=1;\nROLLBACK;` },
    { title: 'Inspect query plan', topic: 'EXPLAIN / INDEX', description: 'See how MySQL plans a filtered query.', sql: `EXPLAIN SELECT * FROM player_stats WHERE player_id=1 AND match_id=1;` }
  ]);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A record with those unique values already exists.' });
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'The selected team, league, player or match does not exist.' });
  if (err.code === 'ER_BAD_FIELD_ERROR') return res.status(500).json({ error: 'Database schema is outdated. Run database_upgrade.sql in MySQL Workbench, then restart the API.' });
  res.status(500).json({ error: 'Server error. Check the backend terminal for details.' });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`FootballIQ API running on http://localhost:${port}`));
