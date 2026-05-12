const express = require('express');
const db = require('../database');

const router = express.Router();

function getConfig() {
  const rows = db.prepare('SELECT key, value FROM site_config').all();
  const config = {};
  for (const row of rows) config[row.key] = row.value;
  config.soundsEnabled = config.soundsEnabled === 'true';
  config.animationsEnabled = config.animationsEnabled === 'true';
  config.inviteEnabled = config.inviteEnabled === 'true';
  return config;
}

router.get('/config', (req, res) => {
  res.json(getConfig());
});

module.exports = router;
module.exports.getConfig = getConfig;
