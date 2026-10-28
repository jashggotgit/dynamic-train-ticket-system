// ============================================================================
// PROJECT: Dynamic Train Ticket & Waitlist System
// COMPONENT: Vercel Serverless Function API Entrypoint
// AUTHOR: Database Administrator & UI/UX Lead Developer
// ============================================================================

const url = require('url');
const path = require('path');
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

module.exports = async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;
    const method = req.method.toUpperCase();

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
        if ((pathname === '/api/health' || pathname === '/health') && method === 'GET') {
            return sendJSON(res, 200, {
                status: 'ONLINE',
                platform: 'VERCEL_SERVERLESS',
                dbMode: dbEngine.isOracleConnected ? 'ORACLE_NATIVE' : 'ORACLE_PLSQL_RELATIONAL_ENGINE',
                timestamp: new Date().toISOString()
            });
        }

        // 2. Trains
        if ((pathname === '/api/trains' || pathname === '/trains') && method === 'GET') {
            return sendJSON(res, 200, dbEngine.getTrains());
        }

        // 3. Stations
        if ((pathname === '/api/stations' || pathname === '/stations') && method === 'GET') {
            return sendJSON(res, 200, dbEngine.tables.Station);
        }

        // 4. Coach Classes
        if ((pathname === '/api/coach-classes' || pathname === '/coach-classes') && method === 'GET') {
            return sendJSON(res, 200, dbEngine.tables.Coach_Class);
        }

        // 5. Seats for a train
        if ((pathname === '/api/seats' || pathname === '/seats') && method === 'GET') {
            const trainId = query.train_id || 101;
            return sendJSON(res, 200, dbEngine.getSeatsForTrain(trainId));
        }

        // 6. Promotions
        if ((pathname === '/api/promo-codes' || pathname === '/promo-codes') && method === 'GET') {
            return sendJSON(res, 200, dbEngine.tables.Promotion_Offer);
        }

        if ((pathname === '/api/promo-codes' || pathname === '/promo-codes') && method === 'POST') {
            const body = await getRequestBody(req);
            const offer = dbEngine.addPromotionOffer(body);
            return sendJSON(res, 201, offer);
        }

        if ((pathname === '/api/promo-codes' || pathname === '/promo-codes') && method === 'DELETE') {
            const body = await getRequestBody(req);
            const success = dbEngine.deletePromotionOffer(body.promo_code);
            return sendJSON(res, 200, { success });
        }

        // 7. Dynamic Fare Calculator (FN_CALCULATE_FARE)
        if ((pathname === '/api/fare/calculate' || pathname === '/fare/calculate') && method === 'POST') {
            const body = await getRequestBody(req);
            const fareData = dbEngine.calculateFare(body.train_id, body.class_id, body.promo_code);
            return sendJSON(res, 200, fareData);
        }

        // 8. Book Ticket (STORED PROCEDURE BOOK_TICKET)
        if ((pathname === '/api/tickets/book' || pathname === '/tickets/book') && method === 'POST') {
            const body = await getRequestBody(req);
            const result = await dbEngine.bookTicket(body);
            return sendJSON(res, 200, result);
        }

        // 9. Cancel Ticket (STORED PROCEDURE CANCEL_TICKET + TRIGGER TRG_TICKET_CANCEL_WAITLIST)
        if ((pathname === '/api/tickets/cancel' || pathname === '/tickets/cancel') && method === 'POST') {
            const body = await getRequestBody(req);
            const result = await dbEngine.cancelTicket(body.ticket_id);
            return sendJSON(res, 200, result);
        }

        // 10. Tickets List
        if ((pathname === '/api/tickets' || pathname === '/tickets') && method === 'GET') {
            return sendJSON(res, 200, dbEngine.getTickets());
        }

        // 11. Waitlist Logs
        if ((pathname === '/api/waitlist' || pathname === '/waitlist') && method === 'GET') {
            return sendJSON(res, 200, dbEngine.getWaitlistLogs());
        }

        // 12. Dashboard Real-Time Statistics
        if ((pathname === '/api/dashboard/stats' || pathname === '/dashboard/stats') && method === 'GET') {
            return sendJSON(res, 200, dbEngine.getDashboardSummary());
        }

        // 13. Maintenance Logs
        if ((pathname === '/api/maintenance' || pathname === '/maintenance') && method === 'GET') {
            return sendJSON(res, 200, dbEngine.getMaintenanceLogs());
        }

        if ((pathname === '/api/maintenance' || pathname === '/maintenance') && method === 'POST') {
            const body = await getRequestBody(req);
            const newLog = dbEngine.reportMaintenance(body);
            return sendJSON(res, 201, newLog);
        }

        if ((pathname === '/api/maintenance/update' || pathname === '/maintenance/update') && method === 'POST') {
            const body = await getRequestBody(req);
            const updated = dbEngine.updateMaintenanceStatus(body.log_id, body.status);
            return sendJSON(res, 200, updated);
        }

        // 14. Real-Time Trigger Activity Logs
        if ((pathname === '/api/trigger-logs' || pathname === '/trigger-logs') && method === 'GET') {
            return sendJSON(res, 200, dbEngine.triggerLog);
        }

        // 15. Raw Relational Table Explorer
        if ((pathname === '/api/db/export' || pathname === '/db/export') && method === 'GET') {
            return sendJSON(res, 200, {
                tables: dbEngine.tables,
                sequences: dbEngine.sequences
            });
        }

        return sendJSON(res, 404, { error: `Endpoint ${pathname} not found.` });

    } catch (err) {
        console.error('[VERCEL API ERROR]', err);
        return sendJSON(res, 500, { error: err.message || 'Serverless Internal Error' });
    }
};
