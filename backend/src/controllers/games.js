const { getAllQuery, getQuery } = require('../models/database');
const nflApiService = require('../services/nfl-api');

// Helper function to get next Wednesday
const getNextWednesday = () => {
  const now = new Date();
  const daysUntilWednesday = (3 - now.getDay() + 7) % 7 || 7; // Get days until next Wednesday
  const nextWednesday = new Date(now);
  nextWednesday.setDate(now.getDate() + daysUntilWednesday);
  nextWednesday.setHours(9, 0, 0, 0); // 9 AM on Wednesday
  return nextWednesday.toISOString();
};

const getCurrentWeekGames = async (req, res) => {
  try {
    const { week, season } = nflApiService.getCurrentWeek();

    // First try to get from database
    let games = await getAllQuery(`
      SELECT 
        g.*,
        ht.name as home_team_name,
        ht.city as home_team_city,
        ht.abbreviation as home_team_abbreviation,
        ht.logo_url as home_team_logo,
        vt.name as visitor_team_name,
        vt.city as visitor_team_city,
        vt.abbreviation as visitor_team_abbreviation,
        vt.logo_url as visitor_team_logo
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams vt ON g.visitor_team_id = vt.id
      WHERE g.week = ? AND g.season = ?
      ORDER BY g.date ASC
    `, [week, season]);

    // If no games found, fetch from API
    if (games.length === 0) {
      await nflApiService.fetchWeekSchedule(week, season);

      games = await getAllQuery(`
        SELECT 
          g.*,
          ht.name as home_team_name,
          ht.city as home_team_city,
          ht.abbreviation as home_team_abbreviation,
          ht.logo_url as home_team_logo,
          vt.name as visitor_team_name,
          vt.city as visitor_team_city,
          vt.abbreviation as visitor_team_abbreviation,
          vt.logo_url as visitor_team_logo
        FROM games g
        JOIN teams ht ON g.home_team_id = ht.id
        JOIN teams vt ON g.visitor_team_id = vt.id
        WHERE g.week = ? AND g.season = ?
        ORDER BY g.date ASC
      `, [week, season]);
    }

    res.json({
      week,
      season,
      games: games.map(game => ({
        id: game.id,
        week: game.week,
        season: game.season,
        date: game.date,
        status: game.status,
        liveStatus: game.live_status,
        isTiebreaker: game.is_tiebreaker_game,
        quarterTimeRemaining: game.quarter_time_remaining,
        homeTeam: {
          id: game.home_team_id,
          name: game.home_team_name,
          city: game.home_team_city,
          abbreviation: game.home_team_abbreviation,
          logo: game.home_team_logo,
          score: game.home_team_score,
          quarters: {
            q1: game.home_team_q1,
            q2: game.home_team_q2,
            q3: game.home_team_q3,
            q4: game.home_team_q4,
            ot: game.home_team_ot
          }
        },
        visitorTeam: {
          id: game.visitor_team_id,
          name: game.visitor_team_name,
          city: game.visitor_team_city,
          abbreviation: game.visitor_team_abbreviation,
          logo: game.visitor_team_logo,
          score: game.visitor_team_score,
          quarters: {
            q1: game.visitor_team_q1,
            q2: game.visitor_team_q2,
            q3: game.visitor_team_q3,
            q4: game.visitor_team_q4,
            ot: game.visitor_team_ot
          }
        }
      }))
    });
  } catch (error) {
    console.error('Error getting current week games:', error);
    res.status(500).json({ message: 'Failed to get games' });
  }
};

const getWeekGames = async (req, res) => {
  try {
    const { week, season } = req.params;

    // First try to get from database
    let games = await getAllQuery(`
      SELECT 
        g.*,
        ht.name as home_team_name,
        ht.city as home_team_city,
        ht.abbreviation as home_team_abbreviation,
        ht.logo_url as home_team_logo,
        vt.name as visitor_team_name,
        vt.city as visitor_team_city,
        vt.abbreviation as visitor_team_abbreviation,
        vt.logo_url as visitor_team_logo
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams vt ON g.visitor_team_id = vt.id
      WHERE g.week = ? AND g.season = ?
      ORDER BY g.date ASC
    `, [week, season]);

    // If no games found, fetch from API
    if (games.length === 0) {
      console.log(`No games found in database for week ${week}, ${season}. Fetching from API...`);
      await nflApiService.fetchWeekSchedule(parseInt(week), parseInt(season));

      // Try to get games again after API fetch
      games = await getAllQuery(`
        SELECT 
          g.*,
          ht.name as home_team_name,
          ht.city as home_team_city,
          ht.abbreviation as home_team_abbreviation,
          ht.logo_url as home_team_logo,
          vt.name as visitor_team_name,
          vt.city as visitor_team_city,
          vt.abbreviation as visitor_team_abbreviation,
          vt.logo_url as visitor_team_logo
        FROM games g
        JOIN teams ht ON g.home_team_id = ht.id
        JOIN teams vt ON g.visitor_team_id = vt.id
        WHERE g.week = ? AND g.season = ?
        ORDER BY g.date ASC
      `, [week, season]);
    }

    res.json({
      week: parseInt(week),
      season: parseInt(season),
      games: games.map(game => ({
        id: game.id,
        week: game.week,
        season: game.season,
        date: game.date,
        status: game.status,
        liveStatus: game.live_status,
        isTiebreaker: game.is_tiebreaker_game,
        quarterTimeRemaining: game.quarter_time_remaining,
        homeTeam: {
          id: game.home_team_id,
          name: game.home_team_name,
          city: game.home_team_city,
          abbreviation: game.home_team_abbreviation,
          logo: game.home_team_logo,
          score: game.home_team_score,
          quarters: {
            q1: game.home_team_q1,
            q2: game.home_team_q2,
            q3: game.home_team_q3,
            q4: game.home_team_q4,
            ot: game.home_team_ot
          }
        },
        visitorTeam: {
          id: game.visitor_team_id,
          name: game.visitor_team_name,
          city: game.visitor_team_city,
          abbreviation: game.visitor_team_abbreviation,
          logo: game.visitor_team_logo,
          score: game.visitor_team_score,
          quarters: {
            q1: game.visitor_team_q1,
            q2: game.visitor_team_q2,
            q3: game.visitor_team_q3,
            q4: game.visitor_team_q4,
            ot: game.visitor_team_ot
          }
        }
      }))
    });
  } catch (error) {
    console.error('Error getting week games:', error);
    res.status(500).json({ message: 'Failed to get games' });
  }
};

const getAllTeams = async (req, res) => {
  try {
    // Try to get from database first
    let teams = await getAllQuery('SELECT * FROM teams ORDER BY conference, division, name');

    // If no teams, fetch from API
    if (teams.length === 0) {
      await nflApiService.fetchAndStoreTeams();
      teams = await getAllQuery('SELECT * FROM teams ORDER BY conference, division, name');
    }

    res.json({
      teams: teams.map(team => ({
        id: team.id,
        name: team.name,
        city: team.city,
        abbreviation: team.abbreviation,
        conference: team.conference,
        division: team.division,
        logo: team.logo_url
      }))
    });
  } catch (error) {
    console.error('Error getting teams:', error);
    res.status(500).json({ message: 'Failed to get teams' });
  }
};

const getAvailableWeeks = async (req, res) => {
  try {
    const { season } = req.params;
    const currentSeason = season || new Date().getFullYear();

    const weeks = await getAllQuery(
      'SELECT DISTINCT week FROM games WHERE season = ? AND week > 0 ORDER BY week',
      [currentSeason]
    );

    res.json({
      season: parseInt(currentSeason),
      weeks: weeks.map(row => row.week)
    });
  } catch (error) {
    console.error('Error getting available weeks:', error);
    res.status(500).json({ message: 'Failed to get available weeks' });
  }
};

const getTeamLogos = async (req, res) => {
  try {
    const teamLogoService = require('../services/team-logo.service');

    // Try to get cached logos first
    let cachedLogos = await teamLogoService.getCachedTeamLogos();

    if (!cachedLogos) {
      // If no cached logos, return fallback URLs
      const teams = await getAllQuery('SELECT abbreviation, name FROM teams');
      cachedLogos = {};

      teams.forEach(team => {
        cachedLogos[team.abbreviation] = {
          name: team.name,
          abbreviation: team.abbreviation,
          logoUrl: `https://a.espncdn.com/i/teamlogos/nfl/500/${team.abbreviation.toLowerCase()}.png`
        };
      });
    }

    res.json({ logos: cachedLogos });
  } catch (error) {
    console.error('Error getting team logos:', error);
    res.status(500).json({ message: 'Failed to get team logos' });
  }
};

const getLiveCurrentWeekGames = async (req, res) => {
  try {
    const { week, season } = nflApiService.getCurrentWeek();
    // Read-only live fetch: get fresh games from API (with short cache) without upserting
    let remoteGames;
    try {
      remoteGames = await nflApiService.fetchLiveGames(week, season);
    } catch (err) {
      console.error('Live fetch failed, falling back to DB or cache:', err.message || err);
      // Fall back to DB if available
      const fallback = await getAllQuery(`
        SELECT 
          g.*, 
          ht.name as home_team_name, ht.city as home_team_city, ht.abbreviation as home_team_abbreviation, ht.logo_url as home_team_logo,
          vt.name as visitor_team_name, vt.city as visitor_team_city, vt.abbreviation as visitor_team_abbreviation, vt.logo_url as visitor_team_logo
        FROM games g
        JOIN teams ht ON g.home_team_id = ht.id
        JOIN teams vt ON g.visitor_team_id = vt.id
        WHERE g.week = ? AND g.season = ?
        ORDER BY g.date ASC
      `, [week, season]);

      return res.json({
        week, season, games: fallback.map(g => ({
          id: g.id,
          date: g.date,
          status: g.status,
          isTiebreaker: g.is_tiebreaker_game,
          homeTeam: { id: g.home_team_id, name: g.home_team_name, abbreviation: g.home_team_abbreviation, logo: g.home_team_logo, score: g.home_team_score },
          visitorTeam: { id: g.visitor_team_id, name: g.visitor_team_name, abbreviation: g.visitor_team_abbreviation, logo: g.visitor_team_logo, score: g.visitor_team_score }
        }))
      });
    }

    // Attach team metadata from DB to remote games when possible
    const teamRows = await getAllQuery('SELECT id, name, city, abbreviation, logo_url FROM teams');
    const teamById = new Map(teamRows.map(t => [t.id, t]));

    const payloadGames = remoteGames.map(g => {
      const ht = teamById.get(g.home_team_id) || { id: g.home_team_id };
      const vt = teamById.get(g.visitor_team_id) || { id: g.visitor_team_id };
      return {
        id: g.id,
        date: g.date,
        status: g.status,
        isTiebreaker: g.is_tiebreaker_game,
        homeTeam: { id: ht.id, name: ht.name, abbreviation: ht.abbreviation, logo: ht.logo_url, score: g.home_team_score },
        visitorTeam: { id: vt.id, name: vt.name, abbreviation: vt.abbreviation, logo: vt.logo_url, score: g.visitor_team_score }
      };
    });

    res.json({ week, season, games: payloadGames });
  } catch (error) {
    console.error('Error getting live current week games:', error);
    res.status(500).json({ message: 'Failed to get live games' });
  }
};

const getTeamLogo = async (req, res) => {
  try {
    const { abbreviation } = req.params;
    const teamLogoService = require('../services/team-logo.service');
    const path = require('path');
    const fs = require('fs').promises;

    // Convert abbreviation to uppercase for consistency
    const teamAbbr = abbreviation.toUpperCase();

    // Try to get the logo from cache/file system first
    const logoFilePath = path.join(__dirname, '../../public/team-logos', `${teamAbbr.toLowerCase()}_logo.png`);

    try {
      // Check if cached file exists and is recent (within 7 days)
      const stats = await fs.stat(logoFilePath);
      const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

      if (ageInHours < (24 * 7)) { // 7 days cache
        // Serve the cached file
        return res.sendFile(logoFilePath);
      }
    } catch (statError) {
      // File doesn't exist, continue to fetch from API
    }

    // File doesn't exist or is too old, fetch from TheSportsDB
    const logoUrl = await teamLogoService.getTeamLogoUrl(teamAbbr);

    if (logoUrl && logoUrl.startsWith('/team-logos/')) {
      // Logo was successfully cached, serve it
      const cachedFilePath = path.join(__dirname, '../../public/team-logos', `${teamAbbr.toLowerCase()}_logo.png`);
      return res.sendFile(cachedFilePath);
    }

    // Fallback to ESPN logo redirect
    return res.redirect(`https://a.espncdn.com/i/teamlogos/nfl/500/${teamAbbr.toLowerCase()}.png`);

  } catch (error) {
    console.error(`Error getting logo for ${req.params.abbreviation}:`, error);
    // Fallback to ESPN logo redirect
    return res.redirect(`https://a.espncdn.com/i/teamlogos/nfl/500/${req.params.abbreviation.toLowerCase()}.png`);
  }
};

const getCurrentWeekGamesForDisplay = async (req, res) => {
  try {
    const { week, season } = nflApiService.getCurrentWeekForDisplay();

    // First try to get from database
    let games = await getAllQuery(`
      SELECT 
        g.*,
        ht.name as home_team_name,
        ht.city as home_team_city,
        ht.abbreviation as home_team_abbreviation,
        ht.logo_url as home_team_logo,
        vt.name as visitor_team_name,
        vt.city as visitor_team_city,
        vt.abbreviation as visitor_team_abbreviation,
        vt.logo_url as visitor_team_logo
      FROM games g
      JOIN teams ht ON g.home_team_id = ht.id
      JOIN teams vt ON g.visitor_team_id = vt.id
      WHERE g.week = ? AND g.season = ?
      ORDER BY g.date ASC
    `, [week, season]);

    // If no games found, fetch from API
    if (games.length === 0) {
      await nflApiService.fetchWeekSchedule(week, season);

      games = await getAllQuery(`
        SELECT 
          g.*,
          ht.name as home_team_name,
          ht.city as home_team_city,
          ht.abbreviation as home_team_abbreviation,
          ht.logo_url as home_team_logo,
          vt.name as visitor_team_name,
          vt.city as visitor_team_city,
          vt.abbreviation as visitor_team_abbreviation,
          vt.logo_url as visitor_team_logo
        FROM games g
        JOIN teams ht ON g.home_team_id = ht.id
        JOIN teams vt ON g.visitor_team_id = vt.id
        WHERE g.week = ? AND g.season = ?
        ORDER BY g.date ASC
      `, [week, season]);
    }

    res.json({
      week,
      season,
      games: games.map(game => ({
        id: game.id,
        week: game.week,
        season: game.season,
        date: game.date,
        status: game.status,
        liveStatus: game.live_status,
        isTiebreaker: game.is_tiebreaker_game,
        quarterTimeRemaining: game.quarter_time_remaining,
        homeTeam: {
          id: game.home_team_id,
          name: game.home_team_name,
          city: game.home_team_city,
          abbreviation: game.home_team_abbreviation,
          logo: game.home_team_logo,
          score: game.home_team_score,
          quarters: {
            q1: game.home_team_q1,
            q2: game.home_team_q2,
            q3: game.home_team_q3,
            q4: game.home_team_q4,
            ot: game.home_team_ot
          }
        },
        visitorTeam: {
          id: game.visitor_team_id,
          name: game.visitor_team_name,
          city: game.visitor_team_city,
          abbreviation: game.visitor_team_abbreviation,
          logo: game.visitor_team_logo,
          score: game.visitor_team_score,
          quarters: {
            q1: game.visitor_team_q1,
            q2: game.visitor_team_q2,
            q3: game.visitor_team_q3,
            q4: game.visitor_team_q4,
            ot: game.visitor_team_ot
          }
        }
      }))
    });
  } catch (error) {
    console.error('Error getting current week games for display:', error);
    res.status(500).json({ message: 'Failed to get games' });
  }
};

module.exports = {
  getCurrentWeekGames,
  getCurrentWeekGamesForDisplay,
  getWeekGames,
  getLiveCurrentWeekGames,
  getAllTeams,
  getTeamLogos,
  getTeamLogo
};
