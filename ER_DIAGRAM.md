# FootballIQ ER Diagram

```mermaid
erDiagram
    LEAGUES ||--o{ TEAMS : contains
    LEAGUES ||--o{ MATCHES : schedules
    TEAMS ||--o{ PLAYERS : has
    TEAMS ||--o{ MATCHES : home_or_away
    MATCHES ||--o{ PLAYER_STATS : records
    PLAYERS ||--o{ PLAYER_STATS : accumulates
    MATCHES ||--o{ MATCH_EVENTS : contains
    PLAYERS ||--o{ MATCH_EVENTS : performs

    LEAGUES {
      int league_id PK
      varchar league_name UK
      varchar country
      varchar season
    }
    TEAMS {
      int team_id PK
      int league_id FK
      varchar team_name
      varchar short_name
      varchar city
    }
    PLAYERS {
      int player_id PK
      int team_id FK
      varchar player_name
      enum position
      varchar nationality
      tinyint age
    }
    MATCHES {
      int match_id PK
      int league_id FK
      int home_team_id FK
      int away_team_id FK
      datetime match_date
      int home_score
      int away_score
      enum status
    }
    PLAYER_STATS {
      int stat_id PK
      int player_id FK
      int match_id FK
      int goals
      int assists
      int minutes_played
      decimal rating
      decimal xg
      decimal xa
      decimal distance_covered_km
      int shots
      int key_passes
    }
    MATCH_EVENTS {
      int event_id PK
      int match_id FK
      int player_id FK
      enum event_type
      int minute
    }
```

## Relationship notes
- One league contains many teams and many matches.
- Each player belongs to one team; a team can have many players.
- Each match has one home team and one away team, both referenced from `teams`.
- `player_stats` is an associative/statistics table between players and matches. A unique `(player_id, match_id)` constraint prevents duplicate stat rows for the same player and match.
- `match_events` stores detailed match incidents such as goals and cards.

## Normalization
The schema is designed to be approximately in Third Normal Form for the project scope: team, league, player, match and event facts are stored in their own tables; names are not repeated as the source of truth in the stats table. Foreign keys enforce referential integrity. `player_stats` stores per-player/per-match statistics and uses a unique composite business key.


## Reporting objects
- `v_player_comparison` aggregates each player's appearances, goals, assists, average rating, xG, xA, total distance and per-90 expected contribution.
- `GetLeagueResults(league_id)` stored procedure returns played match results for a league.
- `before_player_stats_insert` trigger validates ratings and rejects negative xG, xA or distance values.
