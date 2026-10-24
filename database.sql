-- FootballIQ: Football Analytics & Statistics System
-- MySQL 8.0+ | Run this file in MySQL Workbench or mysql CLI.
CREATE DATABASE IF NOT EXISTS footballiq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE footballiq;
DROP TRIGGER IF EXISTS before_player_stats_insert;
DROP PROCEDURE IF EXISTS GetLeagueResults;
DROP VIEW IF EXISTS v_player_comparison;
SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS player_stats;
DROP TABLE IF EXISTS match_events;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS leagues;
SET FOREIGN_KEY_CHECKS=1;

CREATE TABLE leagues (
  league_id INT AUTO_INCREMENT PRIMARY KEY,
  league_name VARCHAR(80) NOT NULL UNIQUE,
  country VARCHAR(60) NOT NULL,
  season VARCHAR(20) NOT NULL DEFAULT '2025/26'
) ENGINE=InnoDB;
CREATE TABLE teams (
  team_id INT AUTO_INCREMENT PRIMARY KEY,
  league_id INT NOT NULL,
  team_name VARCHAR(100) NOT NULL,
  short_name VARCHAR(5) NOT NULL,
  city VARCHAR(80) NOT NULL,
  primary_color CHAR(7) NOT NULL DEFAULT '#16A34A',
  UNIQUE KEY uq_team_league (league_id, team_name),
  CONSTRAINT fk_team_league FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE players (
  player_id INT AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  player_name VARCHAR(100) NOT NULL,
  position ENUM('GK','DEF','MID','FWD') NOT NULL,
  nationality VARCHAR(60) NOT NULL,
  age TINYINT UNSIGNED NOT NULL,
  shirt_number TINYINT UNSIGNED,
  CONSTRAINT fk_player_team FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
  CONSTRAINT chk_player_age CHECK (age BETWEEN 15 AND 50)
) ENGINE=InnoDB;
CREATE TABLE matches (
  match_id INT AUTO_INCREMENT PRIMARY KEY,
  league_id INT NOT NULL,
  home_team_id INT NOT NULL,
  away_team_id INT NOT NULL,
  match_date DATETIME NOT NULL,
  venue VARCHAR(120) NOT NULL,
  home_score TINYINT UNSIGNED NULL,
  away_score TINYINT UNSIGNED NULL,
  status ENUM('Scheduled','Played','Postponed') NOT NULL DEFAULT 'Scheduled',
  CONSTRAINT fk_match_league FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE,
  CONSTRAINT fk_match_home FOREIGN KEY (home_team_id) REFERENCES teams(team_id),
  CONSTRAINT fk_match_away FOREIGN KEY (away_team_id) REFERENCES teams(team_id),
  CONSTRAINT chk_different_teams CHECK (home_team_id <> away_team_id),
  INDEX idx_match_date (match_date), INDEX idx_match_league_status (league_id,status)
) ENGINE=InnoDB;
CREATE TABLE match_events (
  event_id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL,
  player_id INT NOT NULL,
  event_type ENUM('Goal','Yellow Card','Red Card','Assist','Substitution') NOT NULL,
  minute TINYINT UNSIGNED NOT NULL,
  notes VARCHAR(255),
  CONSTRAINT fk_event_match FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE,
  CONSTRAINT fk_event_player FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  INDEX idx_event_match_type (match_id,event_type)
) ENGINE=InnoDB;
CREATE TABLE player_stats (
  stat_id INT AUTO_INCREMENT PRIMARY KEY,
  player_id INT NOT NULL,
  match_id INT NOT NULL,
  appearances TINYINT UNSIGNED NOT NULL DEFAULT 1,
  minutes_played SMALLINT UNSIGNED NOT NULL DEFAULT 90,
  goals TINYINT UNSIGNED NOT NULL DEFAULT 0,
  assists TINYINT UNSIGNED NOT NULL DEFAULT 0,
  rating DECIMAL(3,1) NOT NULL DEFAULT 6.5,
  xg DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  xa DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  distance_covered_km DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  shots SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  key_passes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_player_match (player_id,match_id),
  CONSTRAINT fk_stats_player FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  CONSTRAINT fk_stats_match FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE,
  CONSTRAINT chk_rating CHECK (rating BETWEEN 0 AND 10),
  INDEX idx_stats_goals (goals)
) ENGINE=InnoDB;

INSERT INTO leagues (league_name,country,season) VALUES
('Premier League','England','2025/26'),('La Liga','Spain','2025/26'),('Serie A','Italy','2025/26');
INSERT INTO teams (league_id,team_name,short_name,city,primary_color) VALUES
(1,'Manchester City','MCI','Manchester','#6CABDD'),(1,'Arsenal','ARS','London','#EF0107'),(1,'Liverpool','LIV','Liverpool','#C8102E'),(1,'Chelsea','CHE','London','#034694'),
(2,'Real Madrid','RMA','Madrid','#FEBE10'),(2,'Barcelona','BAR','Barcelona','#A50044'),(2,'Atletico Madrid','ATM','Madrid','#CB3524'),
(3,'Inter Milan','INT','Milan','#0068A8'),(3,'AC Milan','MIL','Milan','#FB090B'),(3,'Juventus','JUV','Turin','#111111');
INSERT INTO players (team_id,player_name,position,nationality,age,shirt_number) VALUES
(1,'Erling Haaland','FWD','Norway',25,9),(1,'Phil Foden','MID','England',25,47),(1,'Ederson','GK','Brazil',32,31),
(2,'Bukayo Saka','FWD','England',24,7),(2,'Martin Odegaard','MID','Norway',27,8),(2,'William Saliba','DEF','France',25,2),
(3,'Mohamed Salah','FWD','Egypt',34,11),(3,'Virgil van Dijk','DEF','Netherlands',35,4),(3,'Alexis Mac Allister','MID','Argentina',27,10),
(4,'Cole Palmer','MID','England',24,20),(4,'Enzo Fernandez','MID','Argentina',25,8),
(5,'Kylian Mbappe','FWD','France',27,10),(5,'Jude Bellingham','MID','England',23,5),(5,'Thibaut Courtois','GK','Belgium',34,1),
(6,'Lamine Yamal','FWD','Spain',19,10),(6,'Pedri','MID','Spain',23,8),(6,'Robert Lewandowski','FWD','Poland',38,9),
(7,'Antoine Griezmann','FWD','France',35,7),(8,'Lautaro Martinez','FWD','Argentina',29,10),(9,'Rafael Leao','FWD','Portugal',27,10),(10,'Dusan Vlahovic','FWD','Serbia',26,9);
INSERT INTO matches (league_id,home_team_id,away_team_id,match_date,venue,home_score,away_score,status) VALUES
(1,1,2,'2026-09-20 16:30:00','Etihad Stadium',2,1,'Played'),
(1,3,4,'2026-09-21 17:00:00','Anfield',3,1,'Played'),
(1,2,3,'2026-09-28 16:30:00','Emirates Stadium',1,1,'Played'),
(1,4,1,'2026-10-04 15:00:00','Stamford Bridge',0,2,'Played'),
(1,1,3,'2026-10-18 16:30:00','Etihad Stadium',NULL,NULL,'Scheduled'),
(1,2,4,'2026-10-19 14:00:00','Emirates Stadium',NULL,NULL,'Scheduled'),
(2,5,6,'2026-09-22 20:00:00','Santiago Bernabeu',2,2,'Played'),
(2,6,7,'2026-09-29 21:00:00','Estadi Olimpic',2,0,'Played'),
(2,7,5,'2026-10-05 20:00:00','Metropolitano',1,2,'Played'),
(2,5,7,'2026-10-20 20:00:00','Santiago Bernabeu',NULL,NULL,'Scheduled'),
(3,8,9,'2026-09-23 20:45:00','San Siro',2,1,'Played'),
(3,10,8,'2026-09-30 20:45:00','Allianz Stadium',1,1,'Played'),
(3,9,10,'2026-10-06 20:45:00','San Siro',0,1,'Played'),
(3,8,10,'2026-10-21 20:45:00','San Siro',NULL,NULL,'Scheduled');
INSERT INTO player_stats (player_id,match_id,appearances,minutes_played,goals,assists,rating,xg,xa,distance_covered_km,shots,key_passes) VALUES
(1,1,1,90,1,0,8.2,0.82,0.05,9.4,4,1),(2,1,1,90,1,0,7.8,0.31,0.18,11.2,3,2),(4,1,1,90,1,0,7.7,0.44,0.12,10.1,3,2),(5,1,1,90,0,1,7.4,0.08,0.46,11.4,1,4),
(7,2,1,90,2,1,9.1,1.32,0.37,10.2,5,3),(9,2,1,90,0,1,7.3,0.12,0.33,11.6,2,3),(10,2,1,90,1,0,7.6,0.63,0.07,10.7,3,1),
(4,3,1,90,1,0,7.8,0.51,0.14,10.3,4,2),(7,3,1,90,1,0,7.9,0.74,0.08,10.5,4,1),(1,4,1,90,1,0,8.0,0.91,0.02,9.1,5,0),(2,4,1,90,1,1,8.4,0.55,0.41,11.3,4,4),
(12,7,1,90,1,0,7.9,0.76,0.12,9.8,4,2),(13,7,1,90,1,0,7.8,0.28,0.31,11.1,2,4),(15,7,1,90,1,0,7.6,0.37,0.22,10.6,3,2),(16,7,1,90,0,1,7.4,0.09,0.48,11.8,1,5),
(15,8,1,90,1,1,8.2,0.61,0.39,10.9,4,4),(18,9,1,90,1,0,7.7,0.49,0.06,10.4,3,1),(12,9,1,90,1,0,7.8,0.88,0.04,9.7,5,1),
(19,11,1,90,1,0,8.0,0.57,0.11,10.8,4,2),(20,11,1,90,1,0,7.7,0.43,0.19,10.2,3,2),(21,12,1,90,1,0,7.6,0.64,0.03,9.6,4,1),(19,13,1,90,1,0,7.8,0.72,0.08,10.9,4,1);
INSERT INTO match_events (match_id,player_id,event_type,minute,notes) VALUES
(1,1,'Goal',24,'Open play'),(1,2,'Goal',68,'Right-footed shot'),(1,4,'Goal',81,'Counter attack'),
(2,7,'Goal',15,'Penalty'),(2,7,'Goal',57,'Open play'),(2,10,'Goal',72,'Long-range shot'),
(7,12,'Goal',30,'Open play'),(7,13,'Goal',64,'Header'),(7,15,'Goal',48,'Open play');

-- Reusable SQL objects for reporting and data-quality demonstrations.
CREATE OR REPLACE VIEW v_player_comparison AS
SELECT p.player_id,p.player_name,t.team_name,p.position,
       COALESCE(SUM(ps.appearances),0) AS appearances,
       COALESCE(SUM(ps.goals),0) AS goals,COALESCE(SUM(ps.assists),0) AS assists,
       COALESCE(ROUND(AVG(ps.rating),2),0) AS average_rating,
       COALESCE(ROUND(SUM(ps.xg),2),0) AS xg,COALESCE(ROUND(SUM(ps.xa),2),0) AS xa,
       COALESCE(ROUND(SUM(ps.distance_covered_km),2),0) AS distance_covered_km,
       COALESCE(SUM(ps.minutes_played),0) AS minutes_played,
       COALESCE(ROUND(SUM(ps.xg)*90/NULLIF(SUM(ps.minutes_played),0),2),0) AS xg_per90,
       COALESCE(ROUND(SUM(ps.xa)*90/NULLIF(SUM(ps.minutes_played),0),2),0) AS xa_per90
FROM players p JOIN teams t ON t.team_id=p.team_id LEFT JOIN player_stats ps ON ps.player_id=p.player_id
GROUP BY p.player_id,p.player_name,t.team_name,p.position;

DELIMITER //
CREATE PROCEDURE GetLeagueResults(IN input_league_id INT)
BEGIN
  SELECT m.match_date,h.team_name AS home_team,m.home_score,a.team_name AS away_team,m.away_score
  FROM matches m JOIN teams h ON h.team_id=m.home_team_id JOIN teams a ON a.team_id=m.away_team_id
  WHERE m.league_id=input_league_id AND m.status='Played' ORDER BY m.match_date DESC;
END //
DELIMITER ;

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
