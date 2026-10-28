// ============================================================================
// PROJECT: Dynamic Train Ticket & Waitlist System
// COMPONENT: Vercel Serverless Function API Entrypoint
// AUTHOR: Database Administrator & UI/UX Lead Developer
// ============================================================================

const url = require('url');
const dbEngine = require('../db_engine');

function getRequestBody(req) {
    return new Promise((resolve) => {
        if (req.body && typeof req.body === 'object') {
            return resolve(req.body);
        }
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (err) {
                resolve({});
            }
        });
    });
}

function sendJSON(res, statusCode, data) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end(JSON.stringify(data));
}

// Robust route extractor supporting Vercel rewrites, catch-all [...route], and direct queries
function getRoute(req) {
    const parsedUrl = url.parse(req.url, true);

    // 1. From Vercel catch-all param [...route]
    if (req.query && req.query.route) {
        if (Array.isArray(req.query.route)) {
            return '/' + req.query.route.join('/');
        }
        return '/' + req.query.route.replace(/^\/+/, '');
    }

    // 2. From rewrite query ?route=...
    if (parsedUrl.query && parsedUrl.query.route) {
        return '/' + parsedUrl.query.route.replace(/^\/+/, '');
    }

    // 3. From Vercel headers
    const matched = req.headers['x-matched-path'] || req.headers['x-invoke-path'];
    if (matched && matched.includes('/api/')) {
        return matched.substring(matched.indexOf('/api/') + 4);
    }

    // 4. From pathname
    let p = parsedUrl.pathname || '';
    if (p.startsWith('/api')) {
        p = p.substring(4);
    }
    if (p.startsWith('/index.js') || p.startsWith('/index')) {
        p = p.replace(/^\/index(\.js)?/, '');
    }
    return p.startsWith('/') ? p : '/' + p;
}

module.exports = async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const query = { ...parsedUrl.query, ...(req.query || {}) };
    const method = req.method.toUpperCase();
    const route = getRoute(req).toLowerCase().replace(/\/+$/, '') || '/';

    // CORS Pre-flight
    if (method === 'OPTIONS') {
        res.statusCode = 204;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.end();
    }

    try {
        // 1. Health check & DB mode
        if ((route === '/' || route === '/health') && method === 'GET') {
            return sendJSON(res, 200, {
                status: 'ONLINE',
                platform: 'VERCEL_SERVERLESS',
                dbMode: dbEngine.isOracleConnected ? 'ORACLE_NATIVE' : 'ORACLE_PLSQL_RELATIONAL_ENGINE',
                timestamp: new Date().toISOString()
            });
        }

        // 2. Trains
        if (route === '/trains' && method === 'GET') {
            return sendJSON(res, 200, dbEngine.getTrains());
        }

        // 3. Stations
        if (route === '/stations' && method === 'GET') {
            return sendJSON(res, 200, dbEngine.tables.Station);
        }

        // 4. Coach Classes
        if (route === '/coach-classes' && method === 'GET') {
            return sendJSON(res, 200, dbEngine.tables.Coach_Class);
        }

        // 5. Seats for a train
        if (route === '/seats' && method === 'GET') {
            const trainId = query.train_id || 101;
            return sendJSON(res, 200, dbEngine.getSeatsForTrain(trainId));
        }

        // 6. Promotions
        if (route === '/promo-codes' && method === 'GET') {
            return sendJSON(res, 200, dbEngine.tables.Promotion_Offer);
        }

        if (route === '/promo-codes' && method === 'POST') {
            const body = await getRequestBody(req);
            const offer = dbEngine.addPromotionOffer(body);
            return sendJSON(res, 201, offer);
        }

        if (route === '/promo-codes' && method === 'DELETE') {
            const body = await getRequestBody(req);
            const success = dbEngine.deletePromotionOffer(body.promo_code);
            return sendJSON(res, 200, { success });
        }

        // 7. Dynamic Fare Calculator (FN_CALCULATE_FARE)
        if (route === '/fare/calculate' && method === 'POST') {
            const body = await getRequestBody(req);
            const fareData = dbEngine.calculateFare(body.train_id, body.class_id, body.promo_code);
            return sendJSON(res, 200, fareData);
        }

        // 8. Book Ticket (STORED PROCEDURE BOOK_TICKET)
        if (route === '/tickets/book' && method === 'POST') {
            const body = await getRequestBody(req);
            const result = await dbEngine.bookTicket(body);
            return sendJSON(res, 200, result);
        }

        // 9. Cancel Ticket (STORED PROCEDURE CANCEL_TICKET + TRIGGER TRG_TICKET_CANCEL_WAITLIST)
        if (route === '/tickets/cancel' && method === 'POST') {
            const body = await getRequestBody(req);
            const result = await dbEngine.cancelTicket(body.ticket_id);
            return sendJSON(res, 200, result);
        }

        // 10. Tickets List
        if (route === '/tickets' && method === 'GET') {
            return sendJSON(res, 200, dbEngine.getTickets());
        }

        // 11. Waitlist Logs
        if (route === '/waitlist' && method === 'GET') {
            return sendJSON(res, 200, dbEngine.getWaitlistLogs());
        }

        // 12. Dashboard Real-Time Statistics
        if (route === '/dashboard/stats' && method === 'GET') {
            return sendJSON(res, 200, dbEngine.getDashboardSummary());
        }

        // 13. Maintenance Logs
        if (route === '/maintenance' && method === 'GET') {
            return sendJSON(res, 200, dbEngine.getMaintenanceLogs());
        }

        if (route === '/maintenance' && method === 'POST') {
            const body = await getRequestBody(req);
            const newLog = dbEngine.reportMaintenance(body);
            return sendJSON(res, 201, newLog);
        }

        if (route === '/maintenance/update' && method === 'POST') {
            const body = await getRequestBody(req);
            const updated = dbEngine.updateMaintenanceStatus(body.log_id, body.status);
            return sendJSON(res, 200, updated);
        }

        // 14. Real-Time Trigger Activity Logs
        if (route === '/trigger-logs' && method === 'GET') {
            return sendJSON(res, 200, dbEngine.triggerLog);
        }

        // 15. Raw Relational Table Explorer
        if (route === '/db/export' && method === 'GET') {
            return sendJSON(res, 200, {
                tables: dbEngine.tables,
                sequences: dbEngine.sequences
            });
        }

        return sendJSON(res, 404, { error: `Endpoint ${route} not found. (Original URL: ${req.url})` });

    } catch (err) {
        console.error('[VERCEL API ERROR]', err);
        return sendJSON(res, 500, { error: err.message || 'Serverless Internal Error' });
    }
};
