const axios = require('axios');
const { runQuery, getQuery, getAllQuery } = require('../models/database');

class NFLApiService {
  constructor() {
    this.ballDontLieBaseUrl = 'https://api.balldontlie.io/nfl/v1';
    this.sportsDbBaseUrl = 'https://www.thesportsdb.com/api/v1/json';
    this.apiKey = process.env.BALLDONTLIE_API_KEY;
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

      // Fallback to NFL teams if API failed or no API key
      if (!teams || teams.length === 0) {
        console.log('Using fallback teams data...');
        teams = await this.createNFLTeams();
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
      // Return NFL teams as fallback
      return await this.createNFLTeams();
    }
  }

  // Get current NFL week
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
            games = response.data.data.map(game => ({
              id: game.id,
              week: game.week,
              season: game.season,
              home_team_id: game.home_team.id,
              visitor_team_id: game.visitor_team.id,
              date: game.date,
              status: this.normalizeGameStatus(game.status),
              home_team_score: game.home_team_score,
              visitor_team_score: game.visitor_team_score,
              is_monday_night: this.isMondayNightGame(game.date)
            }));

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
             (id, week, season, home_team_id, visitor_team_id, date, status, home_team_score, visitor_team_score, is_monday_night) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              game.id,
              game.week,
              game.season,
              game.home_team_id,
              game.visitor_team_id,
              game.date,
              game.status,
              game.home_team_score || null,
              game.visitor_team_score || null,
              game.is_monday_night
            ]
          );
        }
        console.log(`Stored ${games.length} games for week ${week}`);
      }

      return games;
    } catch (error) {
      console.error('Error fetching schedule:', error.message);
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
    if (statusLower.includes('scheduled') || statusLower.includes('pm') || statusLower.includes('am')) return 'scheduled';
    if (statusLower.includes('live') || statusLower.includes('q1') || statusLower.includes('q2') || statusLower.includes('q3') || statusLower.includes('q4')) return 'live';
    
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
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = date.getHours();
    return day === 1 && hour >= 19; // Monday after 7 PM
  }

  // Create realistic schedule data based on NFL scheduling patterns
  async createRealisticSchedule(week, season) {
    // Get teams from database
    const teams = await getAllQuery('SELECT * FROM teams ORDER BY conference, division, name');
    
    if (teams.length < 32) {
      // Create teams if none exist
      await this.createNFLTeams();
      return this.createRealisticSchedule(week, season);
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

  // Create NFL teams if none exist
  async createNFLTeams() {
    const mockTeams = [
      { id: 1, name: 'Patriots', city: 'New England', abbreviation: 'NE', conference: 'AFC', division: 'East' },
      { id: 2, name: 'Bills', city: 'Buffalo', abbreviation: 'BUF', conference: 'AFC', division: 'East' },
      { id: 3, name: 'Dolphins', city: 'Miami', abbreviation: 'MIA', conference: 'AFC', division: 'East' },
      { id: 4, name: 'Jets', city: 'New York', abbreviation: 'NYJ', conference: 'AFC', division: 'East' },
      { id: 5, name: 'Ravens', city: 'Baltimore', abbreviation: 'BAL', conference: 'AFC', division: 'North' },
      { id: 6, name: 'Browns', city: 'Cleveland', abbreviation: 'CLE', conference: 'AFC', division: 'North' },
      { id: 7, name: 'Steelers', city: 'Pittsburgh', abbreviation: 'PIT', conference: 'AFC', division: 'North' },
      { id: 8, name: 'Bengals', city: 'Cincinnati', abbreviation: 'CIN', conference: 'AFC', division: 'North' },
      { id: 9, name: 'Texans', city: 'Houston', abbreviation: 'HOU', conference: 'AFC', division: 'South' },
      { id: 10, name: 'Colts', city: 'Indianapolis', abbreviation: 'IND', conference: 'AFC', division: 'South' },
      { id: 11, name: 'Jaguars', city: 'Jacksonville', abbreviation: 'JAX', conference: 'AFC', division: 'South' },
      { id: 12, name: 'Titans', city: 'Tennessee', abbreviation: 'TEN', conference: 'AFC', division: 'South' },
      { id: 13, name: 'Broncos', city: 'Denver', abbreviation: 'DEN', conference: 'AFC', division: 'West' },
      { id: 14, name: 'Chiefs', city: 'Kansas City', abbreviation: 'KC', conference: 'AFC', division: 'West' },
      { id: 15, name: 'Raiders', city: 'Las Vegas', abbreviation: 'LV', conference: 'AFC', division: 'West' },
      { id: 16, name: 'Chargers', city: 'Los Angeles', abbreviation: 'LAC', conference: 'AFC', division: 'West' },
      { id: 17, name: 'Cowboys', city: 'Dallas', abbreviation: 'DAL', conference: 'NFC', division: 'East' },
      { id: 18, name: 'Giants', city: 'New York', abbreviation: 'NYG', conference: 'NFC', division: 'East' },
      { id: 19, name: 'Eagles', city: 'Philadelphia', abbreviation: 'PHI', conference: 'NFC', division: 'East' },
      { id: 20, name: 'Commanders', city: 'Washington', abbreviation: 'WAS', conference: 'NFC', division: 'East' },
      { id: 21, name: 'Bears', city: 'Chicago', abbreviation: 'CHI', conference: 'NFC', division: 'North' },
      { id: 22, name: 'Lions', city: 'Detroit', abbreviation: 'DET', conference: 'NFC', division: 'North' },
      { id: 23, name: 'Packers', city: 'Green Bay', abbreviation: 'GB', conference: 'NFC', division: 'North' },
      { id: 24, name: 'Vikings', city: 'Minnesota', abbreviation: 'MIN', conference: 'NFC', division: 'North' },
      { id: 25, name: 'Falcons', city: 'Atlanta', abbreviation: 'ATL', conference: 'NFC', division: 'South' },
      { id: 26, name: 'Panthers', city: 'Carolina', abbreviation: 'CAR', conference: 'NFC', division: 'South' },
      { id: 27, name: 'Saints', city: 'New Orleans', abbreviation: 'NO', conference: 'NFC', division: 'South' },
      { id: 28, name: 'Buccaneers', city: 'Tampa Bay', abbreviation: 'TB', conference: 'NFC', division: 'South' },
      { id: 29, name: 'Cardinals', city: 'Arizona', abbreviation: 'ARI', conference: 'NFC', division: 'West' },
      { id: 30, name: '49ers', city: 'San Francisco', abbreviation: 'SF', conference: 'NFC', division: 'West' },
      { id: 31, name: 'Seahawks', city: 'Seattle', abbreviation: 'SEA', conference: 'NFC', division: 'West' },
      { id: 32, name: 'Rams', city: 'Los Angeles', abbreviation: 'LAR', conference: 'NFC', division: 'West' }
    ];

    const teams = mockTeams.map(team => ({
      ...team,
      logo_url: `https://a.espncdn.com/i/teamlogos/nfl/500/${team.abbreviation.toLowerCase()}.png`
    }));

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

    console.log('Created NFL teams');
    return teams;
  }

  // Update game scores
  async updateGameScores(gameId, homeScore, visitorScore, status = 'final') {
    try {
      await runQuery(
        'UPDATE games SET home_team_score = ?, visitor_team_score = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [homeScore, visitorScore, status, gameId]
      );
      
      console.log(`Updated game ${gameId} scores: ${homeScore}-${visitorScore}`);
    } catch (error) {
      console.error('Error updating game scores:', error);
      throw error;
    }
  }
}

module.exports = new NFLApiService();
