const axios = require('axios');
const { runQuery, getQuery, getAllQuery } = require('../models/database');

class NFLApiService {
  constructor() {
    this.ballDontLieBaseUrl = 'https://api.balldontlie.io/nfl/v1';
    this.sportsDbBaseUrl = 'https://www.thesportsdb.com/api/v1/json';
    this.apiKey = process.env.BALLDONTLIE_API_KEY;
    // In-memory cache for live endpoint to avoid frequent API calls (key -> { ts, data })
    this.liveCache = new Map();
    // In-memory sliding-window timestamps for outbound API calls to BallDon'tLie
    this.apiRequestTimestamps = [];
    this.apiRateLimitPerMinute = 5; // keep <= 5 per minute as requested
  }

  // Sliding-window rate limiter: returns true if a new API call is allowed, and records the timestamp
  _allowAndRecordApiCall() {
    const now = Date.now();
    const windowMs = 60 * 1000; // 60 seconds
    // prune timestamps older than window
    this.apiRequestTimestamps = this.apiRequestTimestamps.filter(t => (now - t) <= windowMs);
    if (this.apiRequestTimestamps.length >= this.apiRateLimitPerMinute) {
      return false;
    }
    this.apiRequestTimestamps.push(now);
    return true;
  }

  // When true (or in production), do not generate or insert mock/fallback data.
  noMockDataEnabled() {
    return process.env.NO_MOCK_DATA === 'true' || process.env.NODE_ENV === 'production';
  }

  // Cache management
  async getCachedData(key) {
    try {
      const cached = await getQuery(
        'SELECT data FROM api_cache WHERE cache_key = ? AND expires_at > datetime("now")',
        [key]
      );
      if (cached) {
        console.log(`✅ Cache hit for ${key}`);
        return JSON.parse(cached.data);
      } else {
        console.log(`❌ Cache miss for ${key}`);
        return null;
      }
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  async setCachedData(key, data, hoursToExpire = 24) {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + hoursToExpire);

      await runQuery(
        'INSERT OR REPLACE INTO api_cache (cache_key, data, expires_at) VALUES (?, ?, ?)',
        [key, JSON.stringify(data), expiresAt.toISOString()]
      );
      console.log(`💾 Cached ${key} for ${hoursToExpire} hours`);
    } catch (error) {
      console.error('Error setting cached data:', error);
    }
  }

  // Get NFL teams data
  async fetchAndStoreTeams() {
    try {
      const cacheKey = 'nfl_teams';
      let teams = await this.getCachedData(cacheKey);

      if (!teams && this.apiKey) {
        console.log('🔍 Fetching NFL teams from Ball Don\'t Lie API...');

        try {
          if (!this._allowAndRecordApiCall()) {
            console.warn('API request suppressed to respect rate limit (teams)');
            throw new Error('Rate limit: suppressed teams request');
          }
          const response = await axios.get(`${this.ballDontLieBaseUrl}/teams`, {
            headers: {
              'Authorization': this.apiKey
            },
            timeout: 10000
          });

          if (response.data && response.data.data) {
            teams = response.data.data.map(team => ({
              id: team.id,
              name: team.name,
              city: team.location,
              abbreviation: team.abbreviation,
              conference: team.conference,
              division: team.division,
              logo_url: `https://a.espncdn.com/i/teamlogos/nfl/500/${team.abbreviation.toLowerCase()}.png`
            }));

            await this.setCachedData(cacheKey, teams, 168); // Cache for 1 week
            console.log(`✅ Successfully fetched and cached ${teams.length} teams from API`);
          } else {
            console.log('❌ No teams returned from API');
          }
        } catch (apiError) {
          console.error('🚫 Teams API Error:', apiError.response?.status, apiError.response?.statusText);
          if (apiError.response?.status === 429) {
            console.error('⚠️ Rate limit exceeded for teams API!');
          }
        }
      }

      // If no teams were returned from the API, do not create mock teams; return empty.
      if (!teams || teams.length === 0) {
        console.error('No teams returned from API; mock team creation has been removed. Aborting team storage.');
        return [];
      }

      // Store teams in database
      if (teams && teams.length > 0) {
        for (const team of teams) {
          await runQuery(
            `INSERT OR REPLACE INTO teams 
             (id, name, city, abbreviation, conference, division, logo_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              team.id,
              team.name,
              team.city,
              team.abbreviation,
              team.conference,
              team.division,
              team.logo_url
            ]
          );
        }
        console.log(`Stored ${teams.length} NFL teams`);
      }

      return teams;
    } catch (error) {
      console.error('Error fetching teams:', error);
      // Mock team creation removed — rethrow so callers handle failures explicitly
      throw error;
    }
  }

  // Get current NFL week (allows picks for next week starting Wednesday)
  getCurrentWeek() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11 (0 = January)

    // NFL season runs from September to February of the following year
    // Since we're in 2025, we want to show the upcoming 2025 season

    let season, week;

    if (currentMonth >= 8) {
      // September-December: current season
      season = currentYear;
      const seasonStart = new Date(currentYear, 8, 5); // September 5th (typical season start)
      const weeksSinceStart = Math.floor((now - seasonStart) / (7 * 24 * 60 * 60 * 1000));
      week = Math.max(1, Math.min(weeksSinceStart + 1, 18));

      // Allow picks for next week starting Wednesday (day 3)
      // This aligns with the display logic and gives users time to see results
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const currentWeekStart = this.getWeekStartDate(week, season);
      const daysIntoWeek = Math.floor((now - currentWeekStart) / (24 * 60 * 60 * 1000));

      // If it's Wednesday (day 3) or later in the current week, allow picks for next week
      if (dayOfWeek >= 3 && daysIntoWeek >= 3 && week < 18) {
        week = week + 1;
      }
    } else if (currentMonth <= 1) {
      // January-February: previous season (playoffs/Super Bowl)
      season = currentYear - 1;
      week = 18; // Assume we're in playoffs/post-season
    } else {
      // March-August: Show upcoming season for picks
      // Since we're in 2025, show 2025 Season Week 1 for user picks
      season = currentYear;
      week = 1;
    }

    return { week, season };
  }

  // Get current NFL week for dashboard display (changes on Wednesday to give users time to see results)
  getCurrentWeekForDisplay() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11 (0 = January)

    // NFL season runs from September to February of the following year
    // Since we're in 2025, we want to show the upcoming 2025 season

    let season, week;

    if (currentMonth >= 8) {
      // September-December: current season
      season = currentYear;
      const seasonStart = new Date(currentYear, 8, 5); // September 5th (typical season start)
      const weeksSinceStart = Math.floor((now - seasonStart) / (7 * 24 * 60 * 60 * 1000));
      week = Math.max(1, Math.min(weeksSinceStart + 1, 18));

      // Dashboard switches to next week on Wednesday (day 3)
      // This aligns with pick availability timing
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const currentWeekStart = this.getWeekStartDate(week, season);
      const daysIntoWeek = Math.floor((now - currentWeekStart) / (24 * 60 * 60 * 1000));

      // If it's Wednesday (day 3) or later in the current week, show next week on dashboard
      if (dayOfWeek >= 3 && daysIntoWeek >= 3 && week < 18) {
        week = week + 1;
      }
    } else if (currentMonth <= 1) {
      // January-February: previous season (playoffs/Super Bowl)
      season = currentYear - 1;
      week = 18; // Assume we're in playoffs/post-season
    } else {
      // March-August: Show upcoming season for display
      // Since we're in 2025, show 2025 Season Week 1 for display
      season = currentYear;
      week = 1;
    }

    return { week, season };
  }

  // Check if next week picks are available (Wednesday onwards - aligned with display logic)
  isNextWeekPicksAvailable() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Allow next week picks from Wednesday (day 3) onwards
    return dayOfWeek >= 3;
  }

  // Fetch NFL schedule for a specific week
  async fetchWeekSchedule(week, season) {
    try {
      const cacheKey = `schedule_${season}_${week}`;
      let games = await this.getCachedData(cacheKey);

      // Check if we're currently rate limited
      const rateLimitKey = `ratelimit_${cacheKey}`;
      const rateLimited = await this.getCachedData(rateLimitKey);

      if (rateLimited && !games) {
        console.log('⚠️ Rate limited - using fallback data...');
        return await this.createRealisticSchedule(week, season);
      }

      if (!games && this.apiKey) {
        console.log(`🔍 Fetching schedule for week ${week}, ${season} from Ball Don't Lie API...`);

        try {
          if (!this._allowAndRecordApiCall()) {
            console.warn(`API request suppressed to respect rate limit (schedule ${season} week ${week})`);
            throw new Error('Rate limit: suppressed schedule request');
          }
          const response = await axios.get(`${this.ballDontLieBaseUrl}/games`, {
            headers: {
              'Authorization': this.apiKey
            },
            params: {
              'seasons[]': season,
              'weeks[]': week,
              'per_page': 100
            },
            timeout: 10000 // 10 second timeout
          });

          console.log(`🌐 API response: ${response.status}, games found: ${response.data?.data?.length || 0}`);

          if (response.data && response.data.data && response.data.data.length > 0) {
            games = response.data.data.map(game => {
              const quarterInfo = this.parseQuarterTimeInfo(game.status);
              return {
                id: game.id,
                week: game.week,
                season: game.season,
                home_team_id: game.home_team.id,
                visitor_team_id: game.visitor_team.id,
                date: game.date,
                status: this.normalizeGameStatus(game.status),
                live_status: quarterInfo.fullStatus,
                home_team_score: game.home_team_score,
                visitor_team_score: game.visitor_team_score,
                home_team_q1: game.home_team_q1 || null,
                home_team_q2: game.home_team_q2 || null,
                home_team_q3: game.home_team_q3 || null,
                home_team_q4: game.home_team_q4 || null,
                home_team_ot: game.home_team_ot || null,
                visitor_team_q1: game.visitor_team_q1 || null,
                visitor_team_q2: game.visitor_team_q2 || null,
                visitor_team_q3: game.visitor_team_q3 || null,
                visitor_team_q4: game.visitor_team_q4 || null,
                visitor_team_ot: game.visitor_team_ot || null,
                quarter_time_remaining: quarterInfo.timeRemaining,
                is_monday_night: this.isMondayNightGame(game.date)
              };
            });

            await this.setCachedData(cacheKey, games, 24); // Cache for 24 hours
            console.log(`✅ Successfully fetched and cached ${games.length} real games from API`);
          } else {
            console.log('❌ No games returned from API for this week/season');
            // Cache empty result to avoid repeated requests
            await this.setCachedData(cacheKey, [], 2); // Cache empty result for 2 hours
          }
        } catch (apiError) {
          console.error('🚫 API Error:', apiError.response?.status, apiError.response?.statusText);
          if (apiError.response?.status === 429) {
            console.error('⚠️ Rate limit exceeded! Using cached data or fallback...');
            // Cache a signal that we hit rate limit to avoid immediate retries
            await this.setCachedData(`ratelimit_${cacheKey}`, { rateLimited: true }, 1); // 1 hour cooldown
          }
        }
      }

      // Only fall back to realistic schedule if API completely failed (no API key or network error)
      if (!games || games.length === 0) {
        if (this.noMockDataEnabled()) {
          // In production/no-mock mode we should not fabricate a schedule.
          const reason = !this.apiKey ? 'no API key available' : 'API returned no data';
          console.error(`No games returned for week ${week}, ${season} (${reason}) and mock data disabled. Aborting schedule creation.`);
          // Throw so callers (scheduler/upgrade scripts) can handle the failure explicitly
          throw new Error(`No schedule data available for week ${week}, ${season}`);
        }

        if (!this.apiKey) {
          console.log(`⚠️ No API key available, creating realistic schedule for week ${week}, ${season}...`);
        } else {
          console.log(`⚠️ API returned no data, creating realistic schedule for week ${week}, ${season}...`);
        }
        games = await this.createRealisticSchedule(week, season);
      }

      // Store games in database
      if (games && games.length > 0) {
        for (const game of games) {
          await runQuery(
            `INSERT OR REPLACE INTO games 
             (id, week, season, home_team_id, visitor_team_id, date, status, live_status, home_team_score, visitor_team_score, 
              home_team_q1, home_team_q2, home_team_q3, home_team_q4, home_team_ot,
              visitor_team_q1, visitor_team_q2, visitor_team_q3, visitor_team_q4, visitor_team_ot,
              quarter_time_remaining, is_monday_night) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              game.id,
              game.week,
              game.season,
              game.home_team_id,
              game.visitor_team_id,
              game.date,
              game.status,
              game.live_status,
              typeof game.home_team_score === 'number' ? game.home_team_score : null,
              typeof game.visitor_team_score === 'number' ? game.visitor_team_score : null,
              game.home_team_q1,
              game.home_team_q2,
              game.home_team_q3,
              game.home_team_q4,
              game.home_team_ot,
              game.visitor_team_q1,
              game.visitor_team_q2,
              game.visitor_team_q3,
              game.visitor_team_q4,
              game.visitor_team_ot,
              game.quarter_time_remaining,
              game.is_monday_night
            ]
          );
        }
        console.log(`Stored ${games.length} games for week ${week}`);
      }

      return games;
    } catch (error) {
      console.error('Error fetching schedule:', error.message);
      if (this.noMockDataEnabled()) {
        // When mock data is disabled, rethrow so the caller can decide how to handle it.
        throw error;
      }

      // Create realistic schedule as fallback only on error
      console.log(`⚠️ Error occurred, creating realistic schedule for week ${week}, ${season}...`);
      return await this.createRealisticSchedule(week, season);
    }
  }

  // Helper method to normalize game status from API
  normalizeGameStatus(status) {
    if (!status) return 'scheduled';

    const statusLower = status.toLowerCase();

    if (statusLower.includes('final')) return 'final';

    // Check for halftime
    if (statusLower.includes('halftime') || statusLower.includes('half time')) return 'live';

    // Check for live game patterns: "4:57 - 4th", "12:30 - 2nd", etc.
    if (status.match(/^\d{1,2}:\d{2}\s*-\s*\d+(?:st|nd|rd|th)$/)) return 'live';

    // Check for other live patterns
    if (statusLower.includes('live') || statusLower.includes('q1') || statusLower.includes('q2') || statusLower.includes('q3') || statusLower.includes('q4')) return 'live';

    // Check for overtime
    if (statusLower.includes('ot') || statusLower.includes('overtime')) return 'live';

    // Schedule patterns (times, dates)
    if (statusLower.includes('scheduled') || statusLower.includes('pm') || statusLower.includes('am')) return 'scheduled';

    return 'scheduled'; // Default
  }

  // Fetch entire season schedule
  async fetchFullSeasonSchedule(season) {
    try {
      console.log(`🏈 Fetching full ${season} season schedule...`);
      const allGames = [];

      // Fetch all 18 weeks of the regular season with rate limiting
      for (let week = 1; week <= 18; week++) {
        console.log(`  📅 Fetching week ${week}...`);
        const weekGames = await this.fetchWeekSchedule(week, season);
        allGames.push(...weekGames);

        // Longer delay to avoid overwhelming the API (1 second between requests)
        if (week < 18) {
          console.log(`    ⏳ Waiting 1 second before next request...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`✅ Fetched complete ${season} season: ${allGames.length} games`);
      return allGames;
    } catch (error) {
      console.error(`❌ Error fetching full ${season} season:`, error);
      throw error;
    }
  }

  // Fetch current season and next week's data
  async fetchCurrentAndUpcomingSchedule() {
    try {
      const { week, season } = this.getCurrentWeek();
      console.log(`Refreshing current season ${season} schedule data...`);

      // Fetch full current season
      await this.fetchFullSeasonSchedule(season);

      // Also fetch teams to ensure they're up to date
      await this.fetchAndStoreTeams();

      console.log(`✅ Season ${season} data refresh completed`);
    } catch (error) {
      console.error('Error refreshing season schedule:', error);
      throw error;
    }
  }

  // Helper method to determine if a game is Monday Night Football
  isMondayNightGame(gameDate) {
    const date = new Date(gameDate);

    // Get the date in US Eastern timezone
    const easternDate = new Date(date.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = easternDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = easternDate.getHours();

    // Alternative approach: check if it's a late game (after 11 PM UTC on Sunday/Monday)
    // This catches Monday Night Football which is typically 8:15 PM ET = 1:15 AM UTC Tuesday
    const utcDay = date.getDay();
    const utcHour = date.getHours();
    const isLateGame = (utcDay === 1 && utcHour >= 23) || (utcDay === 2 && utcHour <= 3);

    // Monday Night Football: Either Monday evening in ET, or late UTC Sunday/early UTC Tuesday
    return (day === 1 && hour >= 19) || isLateGame;
  }

  // Helper method to parse quarter time remaining from status
  parseQuarterTimeInfo(status) {
    if (!status) return { quarter: null, timeRemaining: null, fullStatus: null };

    // Live game patterns: "4:57 - 4th", "12:30 - 2nd", "2:00 - 1st", etc.
    const liveMatch = status.match(/^(\d{1,2}:\d{2})\s*-\s*(\d+)(?:st|nd|rd|th)$/);
    if (liveMatch) {
      return {
        quarter: parseInt(liveMatch[2]),
        timeRemaining: liveMatch[1],
        fullStatus: status // Preserve the original status like "4:57 - 4th"
      };
    }

    // Quarter-only patterns: "Q1", "Q2", "Q3", "Q4", "OT"
    const quarterMatch = status.match(/^Q(\d+)$/i);
    if (quarterMatch) {
      return {
        quarter: parseInt(quarterMatch[1]),
        timeRemaining: null,
        fullStatus: status
      };
    }

    if (status.toLowerCase().includes('ot') || status.toLowerCase().includes('overtime')) {
      return {
        quarter: 5, // Treat OT as quarter 5
        timeRemaining: null,
        fullStatus: status
      };
    }

    return { quarter: null, timeRemaining: null, fullStatus: status };
  }

  // Create realistic schedule data based on NFL scheduling patterns
  async createRealisticSchedule(week, season) {
    // Get teams from database
    const teams = await getAllQuery('SELECT * FROM teams ORDER BY conference, division, name');

    if (teams.length < 32) {
      // Cannot create realistic schedule without teams; mock team creation has been removed.
      throw new Error('Insufficient teams in database to build a realistic schedule. Populate teams from API before creating schedules.');
    }

    const games = [];

    // Create realistic game dates for the week
    const baseDate = this.getWeekStartDate(week, season);
    const gameTimes = [
      { day: 0, hour: 13 }, // Sunday 1:00 PM
      { day: 0, hour: 13 }, // Sunday 1:00 PM
      { day: 0, hour: 13 }, // Sunday 1:00 PM
      { day: 0, hour: 13 }, // Sunday 1:00 PM
      { day: 0, hour: 13 }, // Sunday 1:00 PM
      { day: 0, hour: 16, minute: 25 }, // Sunday 4:25 PM
      { day: 0, hour: 16, minute: 25 }, // Sunday 4:25 PM
      { day: 0, hour: 16, minute: 25 }, // Sunday 4:25 PM
      { day: 0, hour: 20, minute: 20 }, // Sunday 8:20 PM
      { day: 4, hour: 20, minute: 15 }, // Thursday 8:15 PM
      { day: 1, hour: 20, minute: 15 }, // Monday 8:15 PM
      { day: 0, hour: 13 }, // Sunday 1:00 PM
      { day: 0, hour: 13 }, // Sunday 1:00 PM
      { day: 0, hour: 16, minute: 25 }, // Sunday 4:25 PM
      { day: 0, hour: 16, minute: 25 }, // Sunday 4:25 PM
      { day: 0, hour: 20, minute: 20 }, // Sunday 8:20 PM
    ];

    // Create matchups using realistic NFL scheduling
    const matchups = this.createRealisticMatchups(teams, week);

    for (let i = 0; i < Math.min(16, matchups.length); i++) {
      const matchup = matchups[i];
      const timeSlot = gameTimes[i] || gameTimes[0];

      const gameDate = new Date(baseDate);
      gameDate.setDate(gameDate.getDate() + timeSlot.day);
      gameDate.setHours(timeSlot.hour, timeSlot.minute || 0, 0, 0);

      const game = {
        id: parseInt(`${season}${week.toString().padStart(2, '0')}${(i + 1).toString().padStart(2, '0')}`),
        week,
        season,
        home_team_id: matchup.home.id,
        visitor_team_id: matchup.visitor.id,
        date: gameDate.toISOString(),
        status: 'scheduled',
        is_monday_night: timeSlot.day === 1 // Monday games
      };

      games.push(game);
    }

    return games;
  }

  // Get the Sunday of the given NFL week
  getWeekStartDate(week, season) {
    // NFL season typically starts the first Sunday after Labor Day
    const seasonStart = new Date(season, 8, 1); // September 1st
    const firstSunday = new Date(seasonStart);

    // Find first Sunday of September
    while (firstSunday.getDay() !== 0) {
      firstSunday.setDate(firstSunday.getDate() + 1);
    }

    // Week 1 starts on the first Sunday, add weeks from there
    const weekStart = new Date(firstSunday);
    weekStart.setDate(weekStart.getDate() + (week - 1) * 7);

    return weekStart;
  }

  // Create realistic team matchups based on NFL scheduling patterns
  createRealisticMatchups(teams, week) {
    const matchups = [];
    const usedTeams = new Set();

    // Group teams by division for realistic matchups
    const divisions = {
      'AFC_East': teams.filter(t => t.conference === 'AFC' && t.division === 'East'),
      'AFC_North': teams.filter(t => t.conference === 'AFC' && t.division === 'North'),
      'AFC_South': teams.filter(t => t.conference === 'AFC' && t.division === 'South'),
      'AFC_West': teams.filter(t => t.conference === 'AFC' && t.division === 'West'),
      'NFC_East': teams.filter(t => t.conference === 'NFC' && t.division === 'East'),
      'NFC_North': teams.filter(t => t.conference === 'NFC' && t.division === 'North'),
      'NFC_South': teams.filter(t => t.conference === 'NFC' && t.division === 'South'),
      'NFC_West': teams.filter(t => t.conference === 'NFC' && t.division === 'West')
    };

    // Create some divisional matchups and some cross-division matchups
    const divisionNames = Object.keys(divisions);

    for (let i = 0; i < Math.min(8, divisionNames.length); i++) {
      const division = divisions[divisionNames[i]];
      if (division.length >= 2) {
        const availableTeams = division.filter(t => !usedTeams.has(t.id));
        if (availableTeams.length >= 2) {
          const home = availableTeams[0];
          const visitor = availableTeams[1];
          matchups.push({ home, visitor });
          usedTeams.add(home.id);
          usedTeams.add(visitor.id);
        }
      }
    }

    // Fill remaining matchups with cross-division games
    const remainingTeams = teams.filter(t => !usedTeams.has(t.id));
    for (let i = 0; i < remainingTeams.length - 1; i += 2) {
      if (remainingTeams[i + 1]) {
        matchups.push({
          home: remainingTeams[i],
          visitor: remainingTeams[i + 1]
        });
      }
    }

    return matchups;
  }

  // Mock team creation permanently removed. Teams must be provided by the Ball Don't Lie API or pre-populated.

  // Update game scores with quarter information
  async updateGameScores(gameId, homeScore, visitorScore, status = 'final', quarterData = null) {
    try {
      let query, params;

      if (quarterData) {
        // Update with full quarter information
        query = `UPDATE games SET 
          home_team_score = ?, visitor_team_score = ?, status = ?, live_status = ?,
          home_team_q1 = ?, home_team_q2 = ?, home_team_q3 = ?, home_team_q4 = ?, home_team_ot = ?,
          visitor_team_q1 = ?, visitor_team_q2 = ?, visitor_team_q3 = ?, visitor_team_q4 = ?, visitor_team_ot = ?,
          quarter_time_remaining = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?`;
        params = [
          homeScore, visitorScore, status, quarterData.live_status,
          quarterData.home_team_q1, quarterData.home_team_q2, quarterData.home_team_q3, quarterData.home_team_q4, quarterData.home_team_ot,
          quarterData.visitor_team_q1, quarterData.visitor_team_q2, quarterData.visitor_team_q3, quarterData.visitor_team_q4, quarterData.visitor_team_ot,
          quarterData.quarter_time_remaining,
          gameId
        ];
      } else {
        // Simple score update (backward compatibility)
        query = 'UPDATE games SET home_team_score = ?, visitor_team_score = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        params = [homeScore, visitorScore, status, gameId];
      }

      await runQuery(query, params);
      console.log(`Updated game ${gameId} scores: ${homeScore}-${visitorScore}`);
    } catch (error) {
      console.error('Error updating game scores:', error);
      throw error;
    }
  }

  // Sync a week's schedule with the database: fetch from API and upsert differences
  async syncWeekSchedule(week, season) {
    try {
      console.log(`Syncing schedule for week ${week}, ${season}...`);

      // Ensure teams exist before syncing
      const teams = await getAllQuery('SELECT id FROM teams');
      if (!teams || teams.length < 32) {
        throw new Error('Insufficient teams in database to sync schedule. Populate teams from API first.');
      }

      // Fetch fresh games from API (bypass cache for sync)
      let response;
      try {
        if (!this._allowAndRecordApiCall()) {
          console.warn(`API request suppressed to respect rate limit (sync ${season} week ${week})`);
          throw new Error('Rate limit: suppressed sync request');
        }
        response = await axios.get(`${this.ballDontLieBaseUrl}/games`, {
          headers: { 'Authorization': this.apiKey },
          params: { 'seasons[]': season, 'weeks[]': week, 'per_page': 100 },
          timeout: 15000
        });
      } catch (err) {
        console.error('Failed to fetch games for sync:', err.message || err);
        throw err;
      }

      const remoteGames = (response.data && response.data.data) ? response.data.data.map(g => ({
        id: g.id,
        week: g.week,
        season: g.season,
        home_team_id: g.home_team.id,
        visitor_team_id: g.visitor_team.id,
        date: g.date,
        status: this.normalizeGameStatus(g.status),
        home_team_score: typeof g.home_team_score === 'number' ? g.home_team_score : null,
        visitor_team_score: typeof g.visitor_team_score === 'number' ? g.visitor_team_score : null,
        is_monday_night: this.isMondayNightGame(g.date)
      })) : [];

      // Get local games for the week/season
      const localGames = await getAllQuery('SELECT * FROM games WHERE week = ? AND season = ?', [week, season]);

      // Index local games by external id
      const localById = new Map(localGames.map(g => [g.id, g]));

      // Upsert remote games
      for (const rg of remoteGames) {
        const existing = localById.get(rg.id);
        if (existing) {
          // Check for differences and update if needed
          const needsUpdate = (
            existing.home_team_id !== rg.home_team_id ||
            existing.visitor_team_id !== rg.visitor_team_id ||
            existing.date !== rg.date ||
            existing.status !== rg.status
          );

          if (needsUpdate) {
            await runQuery(
              `UPDATE games SET home_team_id = ?, visitor_team_id = ?, date = ?, status = ?, home_team_score = ?, visitor_team_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [rg.home_team_id, rg.visitor_team_id, rg.date, rg.status, rg.home_team_score, rg.visitor_team_score, rg.id]
            );
            console.log(`Updated game ${rg.id}`);
          }
        } else {
          // Insert new game
          await runQuery(
            `INSERT INTO games (id, week, season, home_team_id, visitor_team_id, date, status, home_team_score, visitor_team_score, is_monday_night) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [rg.id, rg.week, rg.season, rg.home_team_id, rg.visitor_team_id, rg.date, rg.status, rg.home_team_score, rg.visitor_team_score, rg.is_monday_night]
          );
          console.log(`Inserted new game ${rg.id}`);
        }
      }

      // Remove local games that are no longer present in remote feed
      const remoteIds = new Set(remoteGames.map(g => g.id));
      for (const lg of localGames) {
        if (!remoteIds.has(lg.id)) {
          // Only delete if the game hasn't started (status = scheduled) to avoid removing historical records
          if ((lg.status || 'scheduled') === 'scheduled') {
            await runQuery('DELETE FROM games WHERE id = ?', [lg.id]);
            console.log(`Removed local game ${lg.id} not present in remote feed`);
          }
        }
      }

      console.log(`Schedule sync for week ${week}, ${season} completed`);
      return true;
    } catch (error) {
      console.error('Error during schedule sync:', error.message || error);
      throw error;
    }
  }

  // Read-only fetch of live games for a week/season. Does not upsert to DB.
  // Uses a short in-memory cache (10s) and respects persistent rate-limit signals.
  async fetchLiveGames(week, season) {
    const key = `live_${season}_${week}`;
    const now = Date.now();

    // In-memory cache TTL: 10 seconds
    const cached = this.liveCache.get(key);
    if (cached && (now - cached.ts) < 10000) {
      return cached.data;
    }

    const cacheKey = `schedule_${season}_${week}`;
    const rateLimitKey = `ratelimit_${cacheKey}`;

    // Check persistent rate-limit signal
    const rateLimited = await this.getCachedData(rateLimitKey);
    const persistentCached = await this.getCachedData(cacheKey);

    if (rateLimited) {
      console.log(`🔒 Live fetch skipped due to recent rate limit for ${season} week ${week}`);
      if (persistentCached) {
        this.liveCache.set(key, { ts: now, data: persistentCached });
        return persistentCached;
      }
      throw new Error('Rate limited and no cached schedule available');
    }

    if (!this.apiKey) {
      console.log('⚠️ No BALLDONTLIE_API_KEY set; returning cached schedule if available');
      if (persistentCached) {
        this.liveCache.set(key, { ts: now, data: persistentCached });
        return persistentCached;
      }
      throw new Error('No API key available for live fetch');
    }

    try {
      if (!this._allowAndRecordApiCall()) {
        console.warn(`API request suppressed to respect rate limit (live ${season} week ${week})`);
        if (persistentCached) {
          this.liveCache.set(key, { ts: now, data: persistentCached });
          return persistentCached;
        }
        throw new Error('Rate limit: suppressed live request');
      }
      const response = await axios.get(`${this.ballDontLieBaseUrl}/games`, {
        headers: { 'Authorization': this.apiKey },
        params: { 'seasons[]': season, 'weeks[]': week, 'per_page': 100 },
        timeout: 10000
      });

      const remoteGames = (response.data && response.data.data) ? response.data.data.map(game => {
        const quarterInfo = this.parseQuarterTimeInfo(game.status);
        return {
          id: game.id,
          week: game.week,
          season: game.season,
          home_team_id: game.home_team.id,
          visitor_team_id: game.visitor_team.id,
          date: game.date,
          status: this.normalizeGameStatus(game.status),
          live_status: quarterInfo.fullStatus,
          home_team_score: typeof game.home_team_score === 'number' ? game.home_team_score : null,
          visitor_team_score: typeof game.visitor_team_score === 'number' ? game.visitor_team_score : null,
          home_team_q1: game.home_team_q1 || null,
          home_team_q2: game.home_team_q2 || null,
          home_team_q3: game.home_team_q3 || null,
          home_team_q4: game.home_team_q4 || null,
          home_team_ot: game.home_team_ot || null,
          visitor_team_q1: game.visitor_team_q1 || null,
          visitor_team_q2: game.visitor_team_q2 || null,
          visitor_team_q3: game.visitor_team_q3 || null,
          visitor_team_q4: game.visitor_team_q4 || null,
          visitor_team_ot: game.visitor_team_ot || null,
          quarter_time_remaining: quarterInfo.timeRemaining,
          is_monday_night: this.isMondayNightGame(game.date)
        };
      }) : [];

      // Short-persist the result to the DB cache to help survive rate limits (10 seconds)
      try {
        await this.setCachedData(cacheKey, remoteGames, 0.003); // ~10.8 seconds
      } catch (e) {
        // Ignore cache write failures
        console.warn('Failed to persist live schedule cache:', e.message || e);
      }

      this.liveCache.set(key, { ts: now, data: remoteGames });
      return remoteGames;
    } catch (err) {
      console.error('Live fetch failed:', err.response?.status || err.message || err);

      if (err.response && err.response.status === 429) {
        // Persist a ratelimit signal for this schedule to avoid immediate retries
        try {
          await this.setCachedData(rateLimitKey, { rateLimited: true }, 1); // 1 hour cooldown
        } catch (e) {
          console.warn('Failed to persist rate limit key:', e.message || e);
        }

        if (persistentCached) {
          this.liveCache.set(key, { ts: now, data: persistentCached });
          return persistentCached;
        }
        throw new Error('Rate limited and no cached schedule available');
      }

      // If other network errors, fall back to persistent cache if present
      if (persistentCached) {
        this.liveCache.set(key, { ts: now, data: persistentCached });
        return persistentCached;
      }

      throw err;
    }
  }
}

module.exports = new NFLApiService();
