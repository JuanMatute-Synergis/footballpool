# Tiebreaker System Migration Guide

## Overview
The tiebreaker system has been migrated from a hardcoded "Monday Night Football" detection to a flexible "last game of the week" system. This fixes the Week 18 issue where no Monday games exist.

## What Changed

### Database Schema
- Column renamed: `is_monday_night` → `is_tiebreaker_game`
- Logic changed: Instead of checking if a game is on Monday, the system now identifies the last game of each week by sorting games by date

### Backend Changes
1. **nfl-api.js**: Added `determineTiebreakerGame()` method that:
   - Sorts all games in a week by date (descending)
   - Returns the latest game as the tiebreaker
   - Logs tiebreaker selection: `🎯 Tiebreaker game set: {id} on {date}`

2. **database.js**: Schema updated to use `is_tiebreaker_game` column

3. **Controllers** (games.js, admin.js):
   - Changed property name from `isMonday` to `isTiebreaker`
   - No logic changes required

4. **Scoring service** (scoring.js):
   - Uses `is_tiebreaker_game` flag instead of `is_monday_night`
   - Tiebreaker scoring logic remains unchanged

### Frontend Changes
1. **Game model**: `isMonday: boolean` → `isTiebreaker: boolean`

2. **All components**:
   - Property renamed: `game.isMonday` → `game.isTiebreaker`
   - Method renamed: `isMonday()` → `isTiebreaker()`
   - UI labels: "MNF" → "TB" (Tiebreaker)
   - Text: "Monday Night Football" → "Tiebreaker Game"

## Deployment Steps

### 1. Backup Database
```bash
# Create manual backup before deployment
cp /Users/juanmatute/data/nfl-picks/database.sqlite \
   /Users/juanmatute/data/nfl-picks/database_backup_$(date +'%Y%m%d_%H%M%S').sqlite
```

### 2. Run Migration Script
```bash
# After deployment, run the migration to update existing database
cd /Users/juanmatute/Projects/footballpool/backend
node scripts/migrate_tiebreaker_column.js
```

The migration script will:
- ✅ Create a backup of the database
- ✅ Rename the column from `is_monday_night` to `is_tiebreaker_game`
- ✅ Recalculate tiebreaker flags for all existing weeks
- ✅ Set the last game of each week as the tiebreaker
- ✅ Maintain all historical data

### 3. Verify Deployment
```bash
# Check deployment health
curl http://localhost:3001/api/auth/health

# Check Week 18 games (should show tiebreaker on Sunday night game)
curl http://localhost:3001/api/games/week/18?season=2025

# Expected: Sunday Night Football game has "isTiebreaker": true
```

## Expected Behavior

### Before Migration (Old System)
- Week 18: ❌ No Monday games → No tiebreaker → Ties not properly broken
- Other weeks: ✅ Monday Night Football used as tiebreaker

### After Migration (New System)
- Week 18: ✅ Sunday Night Football (last game) used as tiebreaker
- Other weeks: ✅ Monday Night Football (last game) used as tiebreaker
- Future weeks with different schedules: ✅ Always uses last game by date

## Testing Checklist

- [ ] Migration script runs successfully
- [ ] Database backup created
- [ ] Week 18 displays tiebreaker badge on Sunday night game
- [ ] Picks page shows "Tiebreaker Game" prediction field
- [ ] Results grid shows tiebreaker predictions
- [ ] Scoring calculates correctly for all weeks
- [ ] Admin picks management works with new field names

## Rollback Procedure

If issues occur:

```bash
# 1. Stop the application
docker-compose down

# 2. Restore from backup
cp /Users/juanmatute/data/nfl-picks/database_backup_[timestamp].sqlite \
   /Users/juanmatute/data/nfl-picks/database.sqlite

# 3. Revert code changes
git revert HEAD
git push

# 4. Wait for deployment to complete

# 5. Restart application
docker-compose up -d
```

## Technical Notes

### Tiebreaker Detection Algorithm
```javascript
determineTiebreakerGame(games) {
  if (!games || games.length === 0) return null;
  
  // Sort by date descending (latest first)
  const sortedGames = [...games].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  return sortedGames[0]; // Return the last game
}
```

### Migration Safety Features
- ✅ Automatic backup before migration
- ✅ Transaction-based migration (ROLLBACK on error)
- ✅ Idempotent (can run multiple times safely)
- ✅ Checks for existing migration state

### Log Messages to Watch For
```
🎯 Tiebreaker game set: [game_id] on [date]
✅ Created new table structure
✅ Copied data to new table
✅ Week 18 2025: Set game [id] as tiebreaker
🎉 Migration completed successfully!
```

## FAQ

**Q: Will existing picks be affected?**
A: No, all existing picks are preserved. Only the tiebreaker flag is recalculated.

**Q: Do I need to re-enter Monday Night predictions?**
A: No, the `monday_night_prediction` field in the picks table is unchanged and renamed conceptually to "tiebreaker prediction" in the UI only.

**Q: What happens to old weeks where Monday was the tiebreaker?**
A: They remain unchanged functionally - Monday Night Football is still the last game in most weeks, so the same game gets flagged as the tiebreaker.

**Q: Can I run the migration multiple times?**
A: Yes, the migration is idempotent and will skip if already completed.

## Support

If you encounter issues:
1. Check GitHub Actions deployment logs
2. Review migration script output
3. Verify database structure: `sqlite3 database.sqlite ".schema games"`
4. Check application logs for tiebreaker detection messages
