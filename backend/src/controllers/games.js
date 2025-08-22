const { getAllQuery, getQuery } = require('../models/database');
const nflApiService = require('../services/nfl-api');

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
        isMonday: game.is_monday_night,
        homeTeam: {
          id: game.home_team_id,
          name: game.home_team_name,
          city: game.home_team_city,
          abbreviation: game.home_team_abbreviation,
          logo: game.home_team_logo,
          score: game.home_team_score
        },
        visitorTeam: {
          id: game.visitor_team_id,
          name: game.visitor_team_name,
          city: game.visitor_team_city,
          abbreviation: game.visitor_team_abbreviation,
          logo: game.visitor_team_logo,
          score: game.visitor_team_score
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
        isMonday: game.is_monday_night,
        homeTeam: {
          id: game.home_team_id,
          name: game.home_team_name,
          city: game.home_team_city,
          abbreviation: game.home_team_abbreviation,
          logo: game.home_team_logo,
          score: game.home_team_score
        },
        visitorTeam: {
          id: game.visitor_team_id,
          name: game.visitor_team_name,
          city: game.visitor_team_city,
          abbreviation: game.visitor_team_abbreviation,
          logo: game.visitor_team_logo,
          score: game.visitor_team_score
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

module.exports = {
  getCurrentWeekGames,
  getWeekGames,
  getAllTeams
};
