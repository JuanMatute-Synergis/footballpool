const axios = require('axios');
const { runQuery, getQuery, getAllQuery } = require('../models/database');
const fs = require('fs').promises;
const path = require('path');

class TeamLogoService {
  constructor() {
    this.sportsDbBaseUrl = 'https://www.thesportsdb.com/api/v1/json';
    this.apiKey = process.env.THESPORTSDB_API_KEY || '123'; // Free API key
    this.logosCacheDir = path.join(__dirname, '../../public/team-logos');
    this.logosCacheHours = 24 * 7; // Cache logos for 1 week
    this.apiRateLimit = 30; // 30 requests per minute for free tier
    this.apiRequestTimestamps = [];
    
    // NFL team mapping to TheSportsDB team names
    this.nflTeamMapping = {
      'ARI': 'Arizona Cardinals',
      'ATL': 'Atlanta Falcons', 
      'BAL': 'Baltimore Ravens',
      'BUF': 'Buffalo Bills',
      'CAR': 'Carolina Panthers',
      'CHI': 'Chicago Bears',
      'CIN': 'Cincinnati Bengals',
      'CLE': 'Cleveland Browns',
      'DAL': 'Dallas Cowboys',
      'DEN': 'Denver Broncos',
      'DET': 'Detroit Lions',
      'GB': 'Green Bay Packers',
      'HOU': 'Houston Texans',
      'IND': 'Indianapolis Colts',
      'JAX': 'Jacksonville Jaguars',
      'KC': 'Kansas City Chiefs',
      'LV': 'Las Vegas Raiders',
      'LAC': 'Los Angeles Chargers',
      'LAR': 'Los Angeles Rams',
      'MIA': 'Miami Dolphins',
      'MIN': 'Minnesota Vikings',
      'NE': 'New England Patriots',
      'NO': 'New Orleans Saints',
      'NYG': 'New York Giants',
      'NYJ': 'New York Jets',
      'PHI': 'Philadelphia Eagles',
      'PIT': 'Pittsburgh Steelers',
      'SF': 'San Francisco 49ers',
      'SEA': 'Seattle Seahawks',
      'TB': 'Tampa Bay Buccaneers',
      'TEN': 'Tennessee Titans',
      'WSH': 'Washington Commanders'
    };

    this.initializeCacheDirectory();
  }

  // Get a single team logo URL, fetching and caching if necessary
  async getTeamLogoUrl(abbreviation) {
    try {
      // First check if we have it cached
      const cached = await this.getCachedTeamLogos();
      if (cached && cached[abbreviation] && cached[abbreviation].logoUrl) {
        return cached[abbreviation].logoUrl;
      }

      // Not cached, try to fetch just this team
      const teamName = this.nflTeamMapping[abbreviation];
      if (!teamName) {
        console.warn(`No mapping found for team abbreviation: ${abbreviation}`);
        return null;
      }

      // Check rate limiting
      if (!this._allowAndRecordApiCall()) {
        console.warn(`Rate limit exceeded, cannot fetch logo for ${abbreviation}`);
        return null;
      }

      try {
        const response = await axios.get(
          `${this.sportsDbBaseUrl}/${this.apiKey}/searchteams.php?t=${encodeURIComponent(teamName)}`,
          { timeout: 10000 }
        );

        if (response.data && response.data.teams && response.data.teams.length > 0) {
          const teamData = response.data.teams.find(t => 
            t.strLeague === 'NFL' && t.strTeam.toLowerCase().includes(teamName.toLowerCase().split(' ')[0])
          ) || response.data.teams[0];

          if (teamData && teamData.strBadge) {
            // Download and cache the logo
            const cachedLogoPath = await this.downloadAndCacheTeamLogo(abbreviation, teamData.strBadge);
            
            if (cachedLogoPath) {
              // Update our cache with this single team
              let allCached = await this.getCachedTeamLogos() || {};
              allCached[abbreviation] = {
                name: teamData.strTeam,
                abbreviation: abbreviation,
                logoUrl: cachedLogoPath,
                originalLogoUrl: teamData.strBadge,
                sportsDbId: teamData.idTeam
              };
              
              // Cache updated data
              await this.setCachedTeamLogos(allCached);
              
              return cachedLogoPath;
            }
          }
        }
      } catch (apiError) {
        console.error(`Error fetching single team logo for ${abbreviation}:`, apiError.message);
      }

      return null;
    } catch (error) {
      console.error(`Error getting team logo for ${abbreviation}:`, error);
      return null;
    }
  }

  // Initialize the logos cache directory
  async initializeCacheDirectory() {
    try {
      await fs.mkdir(this.logosCacheDir, { recursive: true });
      console.log('✅ Team logos cache directory initialized');
    } catch (error) {
      console.error('Error creating logos cache directory:', error);
    }
  }

  // Rate limiting for API calls
  _allowAndRecordApiCall() {
    const now = Date.now();
    const windowMs = 60 * 1000; // 60 seconds
    
    // Remove timestamps older than window
    this.apiRequestTimestamps = this.apiRequestTimestamps.filter(t => (now - t) <= windowMs);
    
    if (this.apiRequestTimestamps.length >= this.apiRateLimit) {
      return false;
    }
    
    this.apiRequestTimestamps.push(now);
    return true;
  }

  // Get cached team logo data from database (used for API cache only)
  async getCachedTeamLogos() {
    try {
      const cached = await getQuery(
        'SELECT data FROM api_cache WHERE cache_key = ? AND expires_at > datetime("now")',
        ['team_logos_sportsdb']
      );
      
      if (cached) {
        console.log('✅ Cache hit for team logos');
        return JSON.parse(cached.data);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting cached team logos:', error);
      return null;
    }
  }

  // Cache team logo data in database (for API cache only)
  async setCachedTeamLogos(logoData) {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.logosCacheHours);
      
      await runQuery(
        'INSERT OR REPLACE INTO api_cache (cache_key, data, expires_at) VALUES (?, ?, ?)',
        ['team_logos_sportsdb', JSON.stringify(logoData), expiresAt.toISOString()]
      );
      
      console.log(`💾 Cached team logos for ${this.logosCacheHours} hours`);
    } catch (error) {
      console.error('Error caching team logos:', error);
    }
  }

  // Search for NFL team in TheSportsDB
  async searchTeamInSportsDB(teamName) {
    try {
      if (!this._allowAndRecordApiCall()) {
        console.warn(`Rate limit: suppressed team search for ${teamName}`);
        throw new Error('Rate limit exceeded');
      }

      const searchUrl = `${this.sportsDbBaseUrl}/${this.apiKey}/searchteams.php?t=${encodeURIComponent(teamName)}`;
      console.log(`🔍 Searching for team: ${teamName}`);
      
      const response = await axios.get(searchUrl, { timeout: 10000 });
      
      if (response.data && response.data.teams && response.data.teams.length > 0) {
        console.log(`Found ${response.data.teams.length} teams for ${teamName}`);
        // Find NFL team specifically
        const nflTeam = response.data.teams.find(team => 
          team.strSport === 'American Football' && 
          team.strLeague === 'NFL'
        );
        
        if (nflTeam) {
          console.log(`✅ Found NFL team: ${nflTeam.strTeam}, Badge: ${nflTeam.strBadge ? 'Yes' : 'No'}, Badge URL: ${nflTeam.strBadge || 'None'}`);
          return nflTeam;
        } else {
          console.log(`⚠️ No NFL team found in results for ${teamName}`);
          return response.data.teams[0];
        }
      } else {
        console.log(`❌ No teams returned from API for ${teamName}`);
      }
      
      return null;
    } catch (error) {
      console.error(`Error searching for team ${teamName}:`, error.message);
      return null;
    }
  }

  // Download and cache team logo image
  async downloadAndCacheTeamLogo(abbreviation, logoUrl) {
    if (!logoUrl) return null;

    try {
      const logoFileName = `${abbreviation.toLowerCase()}_logo.png`;
      const logoFilePath = path.join(this.logosCacheDir, logoFileName);
      
      // Check if file already exists and is recent
      try {
        const stats = await fs.stat(logoFilePath);
        const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        if (ageInHours < this.logosCacheHours) {
          console.log(`✅ Using cached logo file for ${abbreviation}`);
          return `/team-logos/${logoFileName}`;
        }
      } catch (statError) {
        // File doesn't exist, continue with download
      }

      // Download the logo
      console.log(`⬇️ Downloading logo for ${abbreviation} from ${logoUrl}`);
      
      const response = await axios.get(logoUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'NFLPicksApp/1.0'
        }
      });

      // Save the file
      await fs.writeFile(logoFilePath, response.data);
      console.log(`✅ Cached logo file for ${abbreviation}`);
      
      return `/team-logos/${logoFileName}`;
    } catch (error) {
      console.error(`Error downloading logo for ${abbreviation}:`, error.message);
      return null;
    }
  }

  // Fetch all NFL team logos from TheSportsDB
  async fetchAndCacheAllTeamLogos() {
    try {
      console.log('🏈 Starting team logos fetch from TheSportsDB...');
      
      // Check for cached data first
      let cachedLogos = await this.getCachedTeamLogos();
      if (cachedLogos) {
        console.log('Using cached team logos data');
        return cachedLogos;
      }

      const teamLogos = {};
      const fetchPromises = [];

      // Fetch logos for each team with controlled concurrency
      const teamAbbreviations = Object.keys(this.nflTeamMapping);
      
      for (let i = 0; i < teamAbbreviations.length; i++) {
        const abbreviation = teamAbbreviations[i];
        const teamName = this.nflTeamMapping[abbreviation];
        
        // Add delay between requests to respect rate limits
        const delay = i * 2000; // 2 seconds between each request
        
        fetchPromises.push(
          new Promise(async (resolve) => {
            setTimeout(async () => {
              try {
                const teamData = await this.searchTeamInSportsDB(teamName);
                
                console.log(`🐛 Debug for ${abbreviation}:`, {
                  hasTeamData: !!teamData,
                  strTeam: teamData?.strTeam,
                  strBadge: teamData?.strBadge,
                  strBadgeType: typeof teamData?.strBadge
                });
                
                if (teamData && teamData.strBadge) {
                  // Use the badge (logo) from TheSportsDB
                  const cachedLogoPath = await this.downloadAndCacheTeamLogo(
                    abbreviation, 
                    teamData.strBadge
                  );
                  
                  teamLogos[abbreviation] = {
                    name: teamData.strTeam,
                    abbreviation: abbreviation,
                    logoUrl: cachedLogoPath || teamData.strBadge,
                    originalLogoUrl: teamData.strBadge,
                    sportsDbId: teamData.idTeam
                  };
                  
                  console.log(`✅ Fetched logo for ${abbreviation}: ${teamData.strTeam}`);
                } else {
                  console.warn(`⚠️ No logo found for ${abbreviation}: ${teamName}`);
                  // Fallback to ESPN logo
                  teamLogos[abbreviation] = {
                    name: teamName,
                    abbreviation: abbreviation,
                    logoUrl: `https://a.espncdn.com/i/teamlogos/nfl/500/${abbreviation.toLowerCase()}.png`,
                    originalLogoUrl: null,
                    sportsDbId: null
                  };
                }
              } catch (error) {
                console.error(`Error fetching logo for ${abbreviation}:`, error.message);
                // Fallback to ESPN logo
                teamLogos[abbreviation] = {
                  name: teamName,
                  abbreviation: abbreviation,
                  logoUrl: `https://a.espncdn.com/i/teamlogos/nfl/500/${abbreviation.toLowerCase()}.png`,
                  originalLogoUrl: null,
                  sportsDbId: null
                };
              }
              
              resolve();
            }, delay);
          })
        );
      }

      // Wait for all requests to complete
      await Promise.all(fetchPromises);

      // Cache the results
      await this.setCachedTeamLogos(teamLogos);
      
      console.log(`🎉 Successfully fetched logos for ${Object.keys(teamLogos).length} teams`);
      return teamLogos;
      
    } catch (error) {
      console.error('Error fetching team logos:', error);
      throw error;
    }
  }

  // Get team logo URL (from cache or fallback) - DEPRECATED: Not used since we serve static files
  // async getTeamLogo(abbreviation) {
  //   try {
  //     // Try to get from cached data first
  //     const cachedLogos = await this.getCachedTeamLogos();
  //     
  //     if (cachedLogos && cachedLogos[abbreviation]) {
  //       return cachedLogos[abbreviation].logoUrl;
  //     }

  //     // Fallback to ESPN logo
  //     return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbreviation.toLowerCase()}.png`;
      
  //   } catch (error) {
  //     console.error(`Error getting team logo for ${abbreviation}:`, error);
  //     return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbreviation.toLowerCase()}.png`;
  //   }
  // }

  // Update team logo URLs in the database - DEPRECATED: Not needed since we serve static files
  // async updateTeamLogosInDatabase() {
  //   try {
  //     console.log('🔄 Updating team logo URLs in database...');
  //     
  //     const cachedLogos = await this.getCachedTeamLogos();
  //     if (!cachedLogos) {
  //       console.log('No cached logos found, fetching from API...');
  //       await this.fetchAndCacheAllTeamLogos();
  //       return;
  //     }

  //     // Get all teams from database
  //     const teams = await getAllQuery('SELECT id, abbreviation FROM teams');
  //     
  //     for (const team of teams) {
  //       const logoData = cachedLogos[team.abbreviation];
  //       if (logoData && logoData.logoUrl) {
  //         await runQuery(
  //           'UPDATE teams SET logo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  //           [logoData.logoUrl, team.id]
  //         );
  //         console.log(`Updated logo for ${team.abbreviation}`);
  //       }
  //     }

  //     console.log('✅ Team logo URLs updated in database');
  //   } catch (error) {
  //     console.error('Error updating team logos in database:', error);
  //   }
  // }
}

module.exports = new TeamLogoService();
