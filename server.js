// ============================================================================
// PROJECT: Dynamic Train Ticket & Waitlist System
// COMPONENT: Express & Native HTTP API Server (Raw Queries & PL/SQL Engine)
// AUTHOR: Database Administrator & UI/UX Lead Developer
// ============================================================================

const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const dbEngine = require('./db_engine');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for static assets
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Helper to parse JSON body from incoming requests
function getRequestBody(req) {
    return new Promise((resolve, reject) => {
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
        req.on('error', reject);
    });
}

// Helper to respond with JSON
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
}

// Serve static file
function serveStaticFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}

// Core Request Handler (Works for both native HTTP and Express middleware)
async function handleApiAndStatic(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;
    const method = req.method.toUpperCase();

    // CORS Pre-flight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    try {
        // --- API ROUTES ---
        if (pathname.startsWith('/api/')) {
            // 1. Health check & DB engine mode
            if (pathname === '/api/health' && method === 'GET') {
                return sendJSON(res, 200, {
                    status: 'ONLINE',
                    dbMode: dbEngine.isOracleConnected ? 'ORACLE_NATIVE' : 'ORACLE_PLSQL_RELATIONAL_ENGINE',
                    timestamp: new Date().toISOString()
                });
            }

            // 2. Trains
            if (pathname === '/api/trains' && method === 'GET') {
                return sendJSON(res, 200, dbEngine.getTrains());
            }

            // 3. Stations
            if (pathname === '/api/stations' && method === 'GET') {
                return sendJSON(res, 200, dbEngine.tables.Station);
            }

            // 4. Coach Classes
            if (pathname === '/api/coach-classes' && method === 'GET') {
                return sendJSON(res, 200, dbEngine.tables.Coach_Class);
            }

            // 5. Seats for a train
            if (pathname === '/api/seats' && method === 'GET') {
                const trainId = query.train_id || 101;
                return sendJSON(res, 200, dbEngine.getSeatsForTrain(trainId));
            }

            // 6. Promotions
            if (pathname === '/api/promo-codes' && method === 'GET') {
                return sendJSON(res, 200, dbEngine.tables.Promotion_Offer);
            }

            if (pathname === '/api/promo-codes' && method === 'POST') {
                const body = await getRequestBody(req);
                const offer = dbEngine.addPromotionOffer(body);
                return sendJSON(res, 201, offer);
            }

            if (pathname === '/api/promo-codes' && method === 'DELETE') {
                const body = await getRequestBody(req);
                const success = dbEngine.deletePromotionOffer(body.promo_code);
                return sendJSON(res, 200, { success });
            }

            // 7. Dynamic Fare Calculator (FN_CALCULATE_FARE)
            if (pathname === '/api/fare/calculate' && method === 'POST') {
                const body = await getRequestBody(req);
                const fareData = dbEngine.calculateFare(body.train_id, body.class_id, body.promo_code);
                return sendJSON(res, 200, fareData);
            }

            // 8. Book Ticket (STORED PROCEDURE BOOK_TICKET)
            if (pathname === '/api/tickets/book' && method === 'POST') {
                const body = await getRequestBody(req);
                const result = await dbEngine.bookTicket(body);
                return sendJSON(res, 200, result);
            }

            // 9. Cancel Ticket (STORED PROCEDURE CANCEL_TICKET + TRIGGER TRG_TICKET_CANCEL_WAITLIST)
            if (pathname === '/api/tickets/cancel' && method === 'POST') {
                const body = await getRequestBody(req);
                const result = await dbEngine.cancelTicket(body.ticket_id);
                return sendJSON(res, 200, result);
            }

            // 10. Tickets List
            if (pathname === '/api/tickets' && method === 'GET') {
                return sendJSON(res, 200, dbEngine.getTickets());
            }

            // 11. Waitlist Logs
            if (pathname === '/api/waitlist' && method === 'GET') {
                return sendJSON(res, 200, dbEngine.getWaitlistLogs());
            }

            // 12. Dashboard Real-Time Statistics
            if (pathname === '/api/dashboard/stats' && method === 'GET') {
                return sendJSON(res, 200, dbEngine.getDashboardSummary());
            }

            // 13. Maintenance Logs
            if (pathname === '/api/maintenance' && method === 'GET') {
                return sendJSON(res, 200, dbEngine.getMaintenanceLogs());
            }

            if (pathname === '/api/maintenance' && method === 'POST') {
                const body = await getRequestBody(req);
                const newLog = dbEngine.reportMaintenance(body);
                return sendJSON(res, 201, newLog);
            }

            if (pathname === '/api/maintenance/update' && method === 'POST') {
                const body = await getRequestBody(req);
                const updated = dbEngine.updateMaintenanceStatus(body.log_id, body.status);
                return sendJSON(res, 200, updated);
            }

            // 14. Real-Time Trigger Activity Logs
            if (pathname === '/api/trigger-logs' && method === 'GET') {
                return sendJSON(res, 200, dbEngine.triggerLog);
            }

            // 15. Raw Relational Table Explorer (Admin inspectability)
            if (pathname === '/api/db/export' && method === 'GET') {
                return sendJSON(res, 200, {
                    tables: dbEngine.tables,
                    sequences: dbEngine.sequences
                });
            }

            return sendJSON(res, 404, { error: 'API endpoint not found.' });
        }

        // --- STATIC ASSETS ---
        let safePath = pathname === '/' ? '/index.html' : pathname;
        // Prevent path traversal
        safePath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
        const targetFile = path.join(PUBLIC_DIR, safePath);

        if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
            return serveStaticFile(res, targetFile);
        } else {
            // Default fallback to index.html for SPA-like navigation
            return serveStaticFile(res, path.join(PUBLIC_DIR, 'index.html'));
        }

    } catch (err) {
        console.error('[SERVER ERROR]', err);
        return sendJSON(res, 500, { error: err.message || 'Server Internal Error' });
    }
}

// Start Server
async function startServer() {
    await dbEngine.init();

    const server = http.createServer(handleApiAndStatic);
    server.listen(PORT, () => {
        console.log(`================================================================`);
        console.log(`🚀 DYNAMIC TRAIN TICKET & WAITLIST SYSTEM ACTIVE`);
        console.log(`📡 URL: http://localhost:${PORT}`);
        console.log(`⚡ Mode: Full Relational 15-Entity Engine & PL/SQL Simulation`);
        console.log(`================================================================`);
    });
}

startServer();
