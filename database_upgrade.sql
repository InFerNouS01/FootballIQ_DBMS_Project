-- FootballIQ additive upgrade for an EXISTING database.
-- Safe with respect to existing tables/rows: it adds missing metric columns and
-- updates only the newly added/default-zero metric values. It does NOT drop tables.
USE footballiq;

SET @has_xg = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='player_stats' AND column_name='xg');
SET @sql = IF(@has_xg=0, 'ALTER TABLE player_stats ADD COLUMN xg DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER rating', 'SELECT ''xg already exists'' AS upgrade_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_xa = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='player_stats' AND column_name='xa');
SET @sql = IF(@has_xa=0, 'ALTER TABLE player_stats ADD COLUMN xa DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER xg', 'SELECT ''xa already exists'' AS upgrade_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_distance = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='player_stats' AND column_name='distance_covered_km');
SET @sql = IF(@has_distance=0, 'ALTER TABLE player_stats ADD COLUMN distance_covered_km DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER xa', 'SELECT ''distance_covered_km already exists'' AS upgrade_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_shots = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='player_stats' AND column_name='shots');
SET @sql = IF(@has_shots=0, 'ALTER TABLE player_stats ADD COLUMN shots SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER distance_covered_km', 'SELECT ''shots already exists'' AS upgrade_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_key_passes = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='player_stats' AND column_name='key_passes');
SET @sql = IF(@has_key_passes=0, 'ALTER TABLE player_stats ADD COLUMN key_passes SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER shots', 'SELECT ''key_passes already exists'' AS upgrade_status');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Existing historical rows get illustrative placeholder metrics only when their new fields are all zero.
-- Replace these with verified data if you have real match statistics.
UPDATE player_stats
SET xg = CASE WHEN goals > 0 THEN ROUND(goals * 0.62, 2) ELSE 0.12 END,
    xa = CASE WHEN assists > 0 THEN ROUND(assists * 0.35, 2) ELSE 0.04 END,
    distance_covered_km = ROUND(9.0 + MOD(player_id * 7 + match_id, 30) / 10, 2),
    shots = goals + 2,
    key_passes = assists + 1
WHERE xg=0 AND xa=0 AND distance_covered_km=0 AND shots=0 AND key_passes=0;

CREATE OR REPLACE VIEW v_player_comparison AS
SELECT p.player_id,p.player_name,t.team_name,p.position,
       COALESCE(SUM(ps.appearances),0) AS appearances,
       COALESCE(SUM(ps.goals),0) AS goals,
       COALESCE(SUM(ps.assists),0) AS assists,
       COALESCE(ROUND(AVG(ps.rating),2),0) AS average_rating,
       COALESCE(ROUND(SUM(ps.xg),2),0) AS xg,
       COALESCE(ROUND(SUM(ps.xa),2),0) AS xa,
       COALESCE(ROUND(SUM(ps.distance_covered_km),2),0) AS distance_covered_km,
       COALESCE(SUM(ps.minutes_played),0) AS minutes_played,
       COALESCE(ROUND(SUM(ps.xg)*90/NULLIF(SUM(ps.minutes_played),0),2),0) AS xg_per90,
       COALESCE(ROUND(SUM(ps.xa)*90/NULLIF(SUM(ps.minutes_played),0),2),0) AS xa_per90
FROM players p JOIN teams t ON t.team_id=p.team_id
LEFT JOIN player_stats ps ON ps.player_id=p.player_id
GROUP BY p.player_id,p.player_name,t.team_name,p.position;

DROP PROCEDURE IF EXISTS GetLeagueResults;
DELIMITER //
CREATE PROCEDURE GetLeagueResults(IN input_league_id INT)
BEGIN
  SELECT m.match_date,h.team_name AS home_team,m.home_score,a.team_name AS away_team,m.away_score
  FROM matches m JOIN teams h ON h.team_id=m.home_team_id JOIN teams a ON a.team_id=m.away_team_id
  WHERE m.league_id=input_league_id AND m.status='Played'
  ORDER BY m.match_date DESC;
END //
DELIMITER ;

DROP TRIGGER IF EXISTS before_player_stats_insert;
DELIMITER //
CREATE TRIGGER before_player_stats_insert
BEFORE INSERT ON player_stats FOR EACH ROW
BEGIN
  IF NEW.rating < 0 OR NEW.rating > 10 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Rating must be between 0 and 10';
  END IF;
  IF NEW.xg < 0 OR NEW.xa < 0 OR NEW.distance_covered_km < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='xG, xA and distance cannot be negative';
  END IF;
END //
DELIMITER ;

SELECT 'FootballIQ upgrade complete' AS status;
SHOW COLUMNS FROM player_stats;
SELECT * FROM v_player_comparison ORDER BY goals DESC LIMIT 10;
