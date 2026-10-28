const url = require('url');
const dbEngine = require('./db_engine');

module.exports = (req, res) => {
    const parsed = url.parse(req.url, true);
    const trainId = parsed.query.train_id || (req.query && req.query.train_id) || 101;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(dbEngine.getSeatsForTrain(trainId)));
};
