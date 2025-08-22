const { runQuery } = require('./src/models/database');

async function clearCachedData() {
  try {
    await runQuery('DELETE FROM api_cache WHERE cache_key LIKE "schedule_2025_%"');
    await runQuery('DELETE FROM games WHERE season = 2025');
    console.log('✅ Cleared 2025 cached data');
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
}

clearCachedData();
