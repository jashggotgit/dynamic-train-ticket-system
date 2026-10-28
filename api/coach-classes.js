const dbEngine = require('./db_engine');

module.exports = (req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(dbEngine.tables.Coach_Class));
};
