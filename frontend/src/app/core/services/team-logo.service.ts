import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TeamLogoService {
  
  private readonly logoBaseUrl = 'https://a.espncdn.com/i/teamlogos/nfl/500';
  
  // NFL team abbreviation to ESPN logo mapping
  private readonly teamLogoMap: { [key: string]: string } = {
    // AFC East
    'BUF': 'buf.png',
    'MIA': 'mia.png',
    'NE': 'ne.png',
    'NYJ': 'nyj.png',
    
    // AFC North
    'BAL': 'bal.png',
    'CIN': 'cin.png',
    'CLE': 'cle.png',
    'PIT': 'pit.png',
    
    // AFC South
    'HOU': 'hou.png',
    'IND': 'ind.png',
    'JAX': 'jax.png',
    'TEN': 'ten.png',
    
    // AFC West
    'DEN': 'den.png',
    'KC': 'kc.png',
    'LV': 'lv.png',
    'LAC': 'lac.png',
    
    // NFC East
    'DAL': 'dal.png',
    'NYG': 'nyg.png',
    'PHI': 'phi.png',
    'WAS': 'wsh.png',
    
    // NFC North
    'CHI': 'chi.png',
    'DET': 'det.png',
    'GB': 'gb.png',
    'MIN': 'min.png',
    
    // NFC South
    'ATL': 'atl.png',
    'CAR': 'car.png',
    'NO': 'no.png',
    'TB': 'tb.png',
    
    // NFC West
    'ARI': 'ari.png',
    'LAR': 'lar.png',
    'SF': 'sf.png',
    'SEA': 'sea.png'
  };

  // Alternative team name mappings for flexibility
  private readonly teamNameMap: { [key: string]: string } = {
    'Buffalo Bills': 'BUF',
    'Miami Dolphins': 'MIA',
    'New England Patriots': 'NE',
    'New York Jets': 'NYJ',
    'Baltimore Ravens': 'BAL',
    'Cincinnati Bengals': 'CIN',
    'Cleveland Browns': 'CLE',
    'Pittsburgh Steelers': 'PIT',
    'Houston Texans': 'HOU',
    'Indianapolis Colts': 'IND',
    'Jacksonville Jaguars': 'JAX',
    'Tennessee Titans': 'TEN',
    'Denver Broncos': 'DEN',
    'Kansas City Chiefs': 'KC',
    'Las Vegas Raiders': 'LV',
    'Los Angeles Chargers': 'LAC',
    'Dallas Cowboys': 'DAL',
    'New York Giants': 'NYG',
    'Philadelphia Eagles': 'PHI',
    'Washington Commanders': 'WAS',
    'Chicago Bears': 'CHI',
    'Detroit Lions': 'DET',
    'Green Bay Packers': 'GB',
    'Minnesota Vikings': 'MIN',
    'Atlanta Falcons': 'ATL',
    'Carolina Panthers': 'CAR',
    'New Orleans Saints': 'NO',
    'Tampa Bay Buccaneers': 'TB',
    'Arizona Cardinals': 'ARI',
    'Los Angeles Rams': 'LAR',
    'San Francisco 49ers': 'SF',
    'Seattle Seahawks': 'SEA'
  };

  getTeamLogo(teamIdentifier: string): string {
    if (!teamIdentifier) {
      return this.getDefaultLogo();
    }

    // Clean the input
    const cleanIdentifier = teamIdentifier.trim();
    
    // Try direct abbreviation lookup first
    if (this.teamLogoMap[cleanIdentifier]) {
      return `${this.logoBaseUrl}/${this.teamLogoMap[cleanIdentifier]}`;
    }

    // Try team name lookup
    if (this.teamNameMap[cleanIdentifier]) {
      const abbreviation = this.teamNameMap[cleanIdentifier];
      return `${this.logoBaseUrl}/${this.teamLogoMap[abbreviation]}`;
    }

    // Try partial matching for team names
    const matchedTeam = Object.keys(this.teamNameMap).find(name => 
      name.toLowerCase().includes(cleanIdentifier.toLowerCase()) ||
      cleanIdentifier.toLowerCase().includes(name.toLowerCase())
    );

    if (matchedTeam) {
      const abbreviation = this.teamNameMap[matchedTeam];
      return `${this.logoBaseUrl}/${this.teamLogoMap[abbreviation]}`;
    }

    // Try to extract abbreviation from longer strings
    const abbreviationMatch = cleanIdentifier.match(/\b([A-Z]{2,4})\b/);
    if (abbreviationMatch && this.teamLogoMap[abbreviationMatch[1]]) {
      return `${this.logoBaseUrl}/${this.teamLogoMap[abbreviationMatch[1]]}`;
    }

    // Return default logo if no match found
    return this.getDefaultLogo();
  }

  getTeamAbbreviation(teamIdentifier: string): string {
    if (!teamIdentifier) return '';

    const cleanIdentifier = teamIdentifier.trim();
    
    // If it's already an abbreviation
    if (this.teamLogoMap[cleanIdentifier]) {
      return cleanIdentifier;
    }

    // If it's a team name
    if (this.teamNameMap[cleanIdentifier]) {
      return this.teamNameMap[cleanIdentifier];
    }

    // Try partial matching
    const matchedTeam = Object.keys(this.teamNameMap).find(name => 
      name.toLowerCase().includes(cleanIdentifier.toLowerCase())
    );

    if (matchedTeam) {
      return this.teamNameMap[matchedTeam];
    }

    // Extract abbreviation from string
    const abbreviationMatch = cleanIdentifier.match(/\b([A-Z]{2,4})\b/);
    if (abbreviationMatch && this.teamLogoMap[abbreviationMatch[1]]) {
      return abbreviationMatch[1];
    }

    return cleanIdentifier.substring(0, 3).toUpperCase();
  }

  private getDefaultLogo(): string {
    // Return NFL shield logo as default
    return 'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png';
  }

  // Get all team logos for preloading
  getAllTeamLogos(): { abbreviation: string, name: string, logo: string }[] {
    return Object.entries(this.teamNameMap).map(([name, abbreviation]) => ({
      abbreviation,
      name,
      logo: this.getTeamLogo(abbreviation)
    }));
  }

  // Preload images for better performance
  preloadTeamLogos(): void {
    Object.values(this.teamLogoMap).forEach(logoFile => {
      const img = new Image();
      img.src = `${this.logoBaseUrl}/${logoFile}`;
    });
  }
}
