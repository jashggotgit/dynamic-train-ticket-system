// ============================================================================
// PROJECT: Dynamic Train Ticket & Waitlist System
// COMPONENT: Oracle Database Configuration & Client Connection Wrapper
// AUTHOR: Database Administrator & UI/UX Lead Developer
// ============================================================================

module.exports = {
    user: process.env.NODE_ORACLEDB_USER || 'system',
    password: process.env.NODE_ORACLEDB_PASSWORD || 'oracle',
    connectString: process.env.NODE_ORACLEDB_CONNECTIONSTRING || 'localhost:1521/XE',
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 2,
    poolTimeout: 60
};
