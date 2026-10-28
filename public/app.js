// ============================================================================
// PROJECT: Dynamic Train Ticket & Waitlist System
// COMPONENT: Client-Side Interactive Engine, Dynamic Fare Calc & PL/SQL Visualizer
// AUTHOR: Database Administrator & UI/UX Lead Developer
// ============================================================================

const API_BASE = '/api';

// Global Client State
const state = {
    trains: [],
    classes: [],
    seats: [],
    selectedTrainId: 101,
    selectedClassId: 4,
    selectedSeatNo: null,
    promoCode: '',
    discountPercentage: 0,
    fareDetails: { baseFare: 500, multiplier: 1.2, discountPercentage: 0, finalFare: 600 },
    activeView: 'passenger'
};

// =============================================================================
// 1. INITIALIZATION & DATA FETCHING
// =============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[CYBERAIL] Initializing Dynamic Transit Engine...');
    await checkSystemHealth();
    await loadInitialData();
    await refreshSeatsAndMetrics();
    await updateFareCalculation();
    await refreshAdminDashboard();

    // Auto-refresh telemetry every 6 seconds
    setInterval(() => {
        if (state.activeView === 'admin') {
            refreshAdminDashboard();
        } else {
            refreshSeatsAndMetrics(false);
        }
    }, 6000);
});

// View Navigation Switcher
function switchView(viewName) {
    state.activeView = viewName;
    document.querySelectorAll('.portal-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

    if (viewName === 'passenger') {
        document.getElementById('view-passenger').classList.add('active');
        document.getElementById('nav-passenger-btn').classList.add('active');
        refreshSeatsAndMetrics();
    } else {
        document.getElementById('view-admin').classList.add('active');
        document.getElementById('nav-admin-btn').classList.add('active');
        refreshAdminDashboard();
    }
}

// Check Backend DB Mode
async function checkSystemHealth() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        const data = await res.json();
        const telemetryEl = document.getElementById('telemetry-mode');
        if (telemetryEl && data.dbMode) {
            telemetryEl.innerText = data.dbMode === 'ORACLE_NATIVE' ? 'ORACLE NATIVE DB CONNECTED' : 'PL/SQL ENGINE (STANDALONE)';
        }
    } catch (e) {
        console.warn('Backend telemetry unreachable', e);
    }
}

// Load Foundational Trains & Classes
async function loadInitialData() {
    try {
        const [trainsRes, classesRes] = await Promise.all([
            fetch(`${API_BASE}/trains`),
            fetch(`${API_BASE}/coach-classes`)
        ]);

        const trainsData = await trainsRes.json();
        const classesData = await classesRes.json();

        if (Array.isArray(trainsData)) {
            state.trains = trainsData;
        } else {
            console.warn('Backend returned non-array for trains, using foundational catalog:', trainsData);
            state.trains = [
                { Train_ID: 101, Train_Name: 'Vande Bharat Express', Total_Capacity: 8, Type: 'Superfast Bullet', availableSeats: 8, bookedSeats: 0, waitlistCount: 0 },
                { Train_ID: 102, Train_Name: 'Rajdhani Express', Total_Capacity: 12, Type: 'Express Luxury', availableSeats: 12, bookedSeats: 0, waitlistCount: 0 },
                { Train_ID: 103, Train_Name: 'Tejas Hyperliner', Total_Capacity: 6, Type: 'Semi-High Speed', availableSeats: 6, bookedSeats: 0, waitlistCount: 0 }
            ];
        }

        if (Array.isArray(classesData)) {
            state.classes = classesData;
        } else {
            console.warn('Backend returned non-array for coach classes, using foundational catalog:', classesData);
            state.classes = [
                { Class_ID: 1, Class_Name: '1A - AC First Class', Base_Fare_Multiplier: 3.50 },
                { Class_ID: 2, Class_Name: '2A - AC 2-Tier', Base_Fare_Multiplier: 2.20 },
                { Class_ID: 3, Class_Name: '3A - AC 3-Tier', Base_Fare_Multiplier: 1.50 },
                { Class_ID: 4, Class_Name: 'CC - AC Chair Car', Base_Fare_Multiplier: 1.20 },
                { Class_ID: 5, Class_Name: 'SL - Sleeper Class', Base_Fare_Multiplier: 1.00 }
            ];
        }

        // Populate Train Selector
        const trainSelect = document.getElementById('train-select');
        trainSelect.innerHTML = state.trains.map(t => `
            <option value="${t.Train_ID}" ${t.Train_ID === 101 ? 'selected' : ''}>
                ${t.Train_ID} - ${t.Train_Name} (${t.Type})
            </option>
        `).join('');

        // Populate Coach Class Selector
        const classSelect = document.getElementById('class-select');
        classSelect.innerHTML = state.classes.map(c => `
            <option value="${c.Class_ID}" ${c.Class_ID === 4 ? 'selected' : ''}>
                ${c.Class_Name} (x${(c.Base_Fare_Multiplier || 1).toFixed(2)})
            </option>
        `).join('');

        state.selectedTrainId = Number(trainSelect.value) || 101;
        state.selectedClassId = Number(classSelect.value) || 4;

    } catch (err) {
        console.error('Initial data load error:', err);
    }
}

// =============================================================================
// 2. PASSENGER PORTAL: INTERACTIVE SEAT MATRIX & METRICS
// =============================================================================
async function refreshSeatsAndMetrics(animate = true) {
    try {
        const [seatsRes, trainsRes] = await Promise.all([
            fetch(`${API_BASE}/seats?train_id=${state.selectedTrainId}`),
            fetch(`${API_BASE}/trains`)
        ]);

        const seatsData = await seatsRes.json();
        const trainsData = await trainsRes.json();

        if (Array.isArray(seatsData)) state.seats = seatsData;
        if (Array.isArray(trainsData)) state.trains = trainsData;

        const currentTrain = state.trains.find(t => t.Train_ID === state.selectedTrainId);

        // Update Top Metric Badges
        if (currentTrain) {
            document.getElementById('metric-capacity').innerText = `${currentTrain.Total_Capacity} SEATS`;
            document.getElementById('metric-available').innerText = currentTrain.availableSeats ?? 8;
            document.getElementById('metric-waitlist').innerText = currentTrain.waitlistCount ?? 0;
            document.getElementById('waitlist-badge-indicator').innerText = currentTrain.waitlistCount ?? 0;
        }

        // Render Physical Seat Matrix
        renderSeatMap();

    } catch (err) {
        console.error('Error refreshing seats matrix', err);
    }
}

function renderSeatMap() {
    const grid = document.getElementById('seats-grid');
    if (!grid) return;

    if (!state.seats || state.seats.length === 0) {
        grid.innerHTML = '<div class="loader-text">No seats configured for this train.</div>';
        return;
    }

    grid.innerHTML = state.seats.map(seat => {
        const isSelected = state.selectedSeatNo === seat.Seat_No;
        const isBooked = seat.Status === 'BOOKED';
        const isAvail = seat.Status === 'AVAILABLE';

        let statusClass = 'available';
        if (isBooked) statusClass = 'booked';
        if (isSelected) statusClass = 'selected';

        return `
            <div class="seat-element ${statusClass}" 
                 onclick="${isAvail ? `selectSeat(${seat.Seat_No})` : ''}"
                 title="Seat #${seat.Seat_No} - ${seat.className} (${seat.Status})">
                <span class="seat-code">${seat.Seat_Code || 'S-' + seat.Seat_No}</span>
                <span class="seat-class-tag">${seat.Status}</span>
            </div>
        `;
    }).join('');
}

function selectSeat(seatNo) {
    if (state.selectedSeatNo === seatNo) {
        state.selectedSeatNo = null; // deselect
    } else {
        state.selectedSeatNo = seatNo;
        showToast(`Selected Seat #${seatNo}`, 'success');
    }
    renderSeatMap();
}

function onTrainChange() {
    const select = document.getElementById('train-select');
    state.selectedTrainId = Number(select.value);
    state.selectedSeatNo = null;
    refreshSeatsAndMetrics();
    updateFareCalculation();
}

function onClassChange() {
    const select = document.getElementById('class-select');
    state.selectedClassId = Number(select.value);
    updateFareCalculation();
}

// =============================================================================
// 3. DYNAMIC FARE CALCULATOR (FN_CALCULATE_FARE)
// =============================================================================
async function updateFareCalculation() {
    try {
        const res = await fetch(`${API_BASE}/fare/calculate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                train_id: state.selectedTrainId,
                class_id: state.selectedClassId,
                promo_code: state.promoCode
            })
        });

        const data = await res.json();
        state.fareDetails = data;

        // Update UI Breakdown
        document.getElementById('fare-base').innerText = `₹${data.baseFare.toFixed(2)}`;
        document.getElementById('fare-multiplier').innerText = `x ${data.multiplier.toFixed(2)}`;
        
        const discountRow = document.getElementById('fare-discount-row');
        if (data.discountPercentage > 0) {
            discountRow.style.display = 'flex';
            const savedAmt = (data.baseFare * data.multiplier * (data.discountPercentage / 100)).toFixed(2);
            document.getElementById('fare-discount').innerText = `- ₹${savedAmt} (${data.discountPercentage}% OFF)`;
        } else {
            discountRow.style.display = 'none';
        }

        document.getElementById('fare-total').innerText = `₹${data.finalFare.toFixed(2)}`;

    } catch (err) {
        console.error('Error updating fare', err);
    }
}

function setPromo(code) {
    document.getElementById('promo-code').value = code;
    applyPromoCode();
}

function applyPromoCode() {
    const code = document.getElementById('promo-code').value.trim();
    state.promoCode = code;
    updateFareCalculation();
    if (code) {
        showToast(`Promo voucher '${code}' applied!`, 'success');
    }
}

// =============================================================================
// 4. BOOK TICKET (STORED PROCEDURE BOOK_TICKET)
// =============================================================================
async function handleBookTicket(event) {
    event.preventDefault();

    const bookBtn = document.getElementById('book-btn');
    const originalText = bookBtn.innerHTML;
    bookBtn.disabled = true;
    bookBtn.innerHTML = '<span class="btn-text">CALLING PL/SQL PROCEDURE...</span>';

    const payload = {
        train_id: state.selectedTrainId,
        class_id: state.selectedClassId,
        passenger_name: document.getElementById('passenger-name').value.trim(),
        passenger_phone: document.getElementById('passenger-phone').value.trim(),
        passenger_email: document.getElementById('passenger-email').value.trim(),
        age: Number(document.getElementById('passenger-age').value),
        payment_method: document.getElementById('payment-method').value,
        promo_code: state.promoCode
    };

    try {
        const res = await fetch(`${API_BASE}/tickets/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        bookBtn.disabled = false;
        bookBtn.innerHTML = originalText;

        if (result.status === 'CONFIRMED' || result.status === 'WAITLISTED') {
            openTicketModal(result, payload);
            showToast(result.message, result.status === 'CONFIRMED' ? 'success' : 'warning');
            state.selectedSeatNo = null;
            await refreshSeatsAndMetrics();
            await refreshAdminDashboard();
        } else {
            showToast(result.message || 'Booking failed.', 'error');
        }

    } catch (err) {
        bookBtn.disabled = false;
        bookBtn.innerHTML = originalText;
        showToast('Network / Server Error while calling BOOK_TICKET.', 'error');
        console.error(err);
    }
}

// =============================================================================
// 5. TICKET MODAL DISPLAY (BOARDING PASS)
// =============================================================================
function openTicketModal(result, payload) {
    const modal = document.getElementById('ticket-modal');
    const badgeContainer = document.getElementById('modal-badge-container');
    const isConfirmed = result.status === 'CONFIRMED';

    // Set Dynamic Status Badge
    badgeContainer.innerHTML = isConfirmed ? `
        <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid var(--green); color: var(--green); padding: 8px 16px; border-radius: 20px; display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; margin-bottom: 14px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 10px var(--green);"></span>
            CONFIRMED TICKET GENERATED
        </div>
    ` : `
        <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid var(--amber); color: var(--amber); padding: 8px 16px; border-radius: 20px; display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; margin-bottom: 14px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--amber); box-shadow: 0 0 10px var(--amber);"></span>
            CAPACITY FULL // WAITLIST QUEUE POSITION #${result.queue_position}
        </div>
    `;

    const train = state.trains.find(t => t.Train_ID === state.selectedTrainId);
    document.getElementById('slip-train-name').innerText = train ? train.Train_Name : `Train #${state.selectedTrainId}`;
    document.getElementById('slip-pnr').innerText = result.pnr_no;
    document.getElementById('slip-passenger').innerText = payload.passenger_name;
    document.getElementById('slip-amount').innerText = `₹${result.total_fare.toFixed(2)}`;

    const seatEl = document.getElementById('slip-seat');
    const statusEl = document.getElementById('slip-status');

    if (isConfirmed) {
        seatEl.innerText = `Seat #${result.seat_no} (${result.seat_code || 'CC'})`;
        seatEl.className = 'slip-data seat-glow';
        statusEl.innerText = 'CONFIRMED';
        statusEl.className = 'slip-data status-confirmed';
    } else {
        seatEl.innerText = `WL #${result.queue_position} (Unassigned)`;
        seatEl.className = 'slip-data text-amber';
        statusEl.innerText = `WAITLISTED (#${result.queue_position})`;
        statusEl.className = 'slip-data status-waitlisted';
    }

    modal.classList.add('active');
}

function closeTicketModal() {
    document.getElementById('ticket-modal').classList.remove('active');
}

// =============================================================================
// 6. ADMIN CONTROL CENTER: REAL-TIME KPIS, TABLES & TRIGGER EXECUTION
// =============================================================================
async function refreshAdminDashboard() {
    try {
        const [statsRes, ticketsRes, waitlistRes, maintRes, triggerRes, promoRes] = await Promise.all([
            fetch(`${API_BASE}/dashboard/stats`),
            fetch(`${API_BASE}/tickets`),
            fetch(`${API_BASE}/waitlist`),
            fetch(`${API_BASE}/maintenance`),
            fetch(`${API_BASE}/trigger-logs`),
            fetch(`${API_BASE}/promo-codes`)
        ]);

        const stats = (await statsRes.json()) || {};
        const tickets = (await ticketsRes.json()) || [];
        const waitlist = (await waitlistRes.json()) || [];
        const maintenance = (await maintRes.json()) || [];
        const triggerLogs = (await triggerRes.json()) || [];
        const promos = (await promoRes.json()) || [];

        // 1. KPI Badges
        document.getElementById('stat-reservations').innerText = stats.totalReservations ?? 0;
        document.getElementById('stat-waitlist').innerText = stats.activeWaitlistCount ?? 0;
        document.getElementById('stat-revenue').innerText = `₹${(stats.totalRevenue ?? 0).toLocaleString()}`;
        document.getElementById('stat-utilization').innerText = `${stats.capacityUtilization ?? 0}%`;
        document.getElementById('waitlist-badge-indicator').innerText = stats.activeWaitlistCount ?? 0;

        // 2. Active Waitlist Glowing Alert Banner
        const alertBanner = document.getElementById('waitlist-alert-banner');
        if (alertBanner) {
            if ((stats.activeWaitlistCount || 0) > 0) {
                alertBanner.style.display = 'flex';
                document.getElementById('waitlist-alert-text').innerHTML = `⚠️ <strong>ACTIVE WAITLIST ALERT:</strong> ${stats.activeWaitlistCount} passengers currently queued! Cancelling any confirmed ticket will instantly execute <code>TRG_TICKET_CANCEL_WAITLIST</code> to auto-promote.`;
            } else {
                alertBanner.style.display = 'none';
            }
        }

        // 3. Waitlist Queue Table
        renderWaitlistTable(Array.isArray(waitlist) ? waitlist : []);

        // 4. Confirmed Tickets Table
        renderTicketsTable(Array.isArray(tickets) ? tickets : []);

        // 5. Maintenance Table
        renderMaintenanceTable(Array.isArray(maintenance) ? maintenance : []);

        // 6. Promotion Offers Table
        renderPromoTable(Array.isArray(promos) ? promos : []);

        // 7. Trigger Execution Logs Feed
        renderTriggerLogs(Array.isArray(triggerLogs) ? triggerLogs : []);

    } catch (err) {
        console.error('Error refreshing admin dashboard', err);
    }
}

function renderWaitlistTable(waitlist) {
    const tbody = document.getElementById('waitlist-table-body');
    const chip = document.getElementById('waitlist-count-chip');
    chip.innerText = `${waitlist.length} Waiting`;

    if (!waitlist || waitlist.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 24px; color: var(--text-dim);">No passengers currently in waitlist queue. All clear!</td></tr>';
        return;
    }

    tbody.innerHTML = waitlist.map(w => `
        <tr>
            <td><strong style="color: var(--amber);">WL #${w.Queue_Position}</strong></td>
            <td><code>${w.PNR_No}</code></td>
            <td>${w.trainName}</td>
            <td><strong>${w.passengerName}</strong></td>
            <td>${w.phone}</td>
            <td>${new Date(w.Update_Date).toLocaleTimeString()}</td>
        </tr>
    `).join('');
}

function renderTicketsTable(tickets) {
    const tbody = document.getElementById('tickets-table-body');

    if (!tickets || tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 24px; color: var(--text-dim);">No active confirmed tickets. Book one from the passenger portal!</td></tr>';
        return;
    }

    tbody.innerHTML = tickets.map(t => `
        <tr>
            <td><code>#${t.Ticket_ID}</code></td>
            <td><code>${t.PNR_No}</code></td>
            <td>${t.trainName}</td>
            <td><span class="seat-glow" style="font-weight: 700;">Seat #${t.Seat_No}</span></td>
            <td>${t.Passenger_Name} (${t.Age}y)</td>
            <td>
                <button class="table-action-btn" onclick="handleCancelTicket(${t.Ticket_ID})">
                    CANCEL TICKET [TEST TRIGGER]
                </button>
            </td>
        </tr>
    `).join('');
}

function renderMaintenanceTable(logs) {
    const tbody = document.getElementById('maintenance-table-body');
    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No maintenance logs reported.</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(m => {
        let badgeColor = 'var(--amber)';
        if (m.Status === 'RESOLVED') badgeColor = 'var(--green)';
        if (m.Status === 'REPORTED') badgeColor = 'var(--cyan)';

        return `
            <tr>
                <td><code>#${m.Log_ID}</code></td>
                <td>${m.trainName}</td>
                <td>${m.Issue_Description}</td>
                <td><span style="color: ${badgeColor}; font-weight: 700; font-family: var(--font-mono);">${m.Status}</span></td>
                <td>
                    ${m.Status !== 'RESOLVED' ? `
                        <button class="cyber-btn-outline" style="padding: 3px 8px; font-size: 10px;" onclick="resolveMaintenance(${m.Log_ID})">
                            MARK RESOLVED
                        </button>
                    ` : '<span style="color: var(--text-dim); font-size: 11px;">CLOSED</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

function renderTriggerLogs(logs) {
    const container = document.getElementById('trigger-log-container');
    if (!logs || logs.length === 0) return;

    container.innerHTML = logs.slice(0, 15).map(log => {
        let actionStyle = 'term-time';
        if (log.action.includes('PROMOTED')) actionStyle = 'term-trigger';
        else if (log.action.includes('CONFIRMED')) actionStyle = 'term-confirmed';
        else if (log.action.includes('WAITLISTED')) actionStyle = 'term-waitlisted';

        return `
            <div class="terminal-line">
                <span class="term-time">[${log.timestamp}]</span>
                <span class="${actionStyle}">[${log.action}]</span>
                <span>${log.message}</span>
            </div>
        `;
    }).join('');
}

function loadTriggerLogs() {
    refreshAdminDashboard();
    showToast('Telemetry execution logs updated.', 'success');
}

// =============================================================================
// 7. CANCEL TICKET (TRIGGER DEMO: AUTO-SHIFT WAITLIST)
// =============================================================================
async function handleCancelTicket(ticketId) {
    if (!confirm(`Are you sure you want to cancel Ticket #${ticketId}?\nThis will execute CANCEL_TICKET and fire TRG_TICKET_CANCEL_WAITLIST to promote the next waitlisted passenger!`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/tickets/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticket_id: ticketId })
        });

        const data = await res.json();
        if (data.status === 'SUCCESS') {
            if (data.promoted_passenger) {
                showToast(`TRIGGER FIRED! ${data.promoted_passenger.passenger_name} (PNR #${data.promoted_passenger.pnr_no}) auto-promoted to Seat #${data.freed_seat_no}!`, 'success');
            } else {
                showToast(`Ticket #${ticketId} cancelled. Seat #${data.freed_seat_no} returned to available pool.`, 'success');
            }
            await refreshAdminDashboard();
            await refreshSeatsAndMetrics();
        } else {
            showToast(data.message || 'Cancellation failed.', 'error');
        }
    } catch (err) {
        showToast('Error during ticket cancellation.', 'error');
        console.error(err);
    }
}

// =============================================================================
// 8. MAINTENANCE ACTIONS
// =============================================================================
function openMaintenanceModal() {
    document.getElementById('maintenance-modal').classList.add('active');
}

function closeMaintenanceModal() {
    document.getElementById('maintenance-modal').classList.remove('active');
}

async function handleCreateMaintenance(event) {
    event.preventDefault();
    const trainId = document.getElementById('maint-train-select').value;
    const desc = document.getElementById('maint-desc').value.trim();

    try {
        const res = await fetch(`${API_BASE}/maintenance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                train_id: trainId,
                emp_id: 4002,
                issue_description: desc
            })
        });

        if (res.ok) {
            closeMaintenanceModal();
            document.getElementById('maint-desc').value = '';
            showToast('Maintenance issue dispatched successfully.', 'success');
            await refreshAdminDashboard();
        }
    } catch (err) {
        showToast('Error submitting maintenance report.', 'error');
    }
}

async function resolveMaintenance(logId) {
    try {
        const res = await fetch(`${API_BASE}/maintenance/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log_id: logId, status: 'RESOLVED' })
        });

        if (res.ok) {
            showToast(`Maintenance Log #${logId} marked as RESOLVED.`, 'success');
            await refreshAdminDashboard();
        }
    } catch (err) {
        showToast('Error updating maintenance status.', 'error');
    }
}

// =============================================================================
// 8.1 PROMOTION OFFER SUITE ACTIONS (ENTITY 15)
// =============================================================================
function renderPromoTable(promos) {
    const tbody = document.getElementById('promo-table-body');
    if (!tbody) return;

    if (!promos || promos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No active promotion vouchers found.</td></tr>';
        return;
    }

    tbody.innerHTML = promos.map(p => `
        <tr>
            <td><strong style="color: var(--cyan); font-family: var(--font-mono);">${p.Promo_Code}</strong></td>
            <td><span class="seat-glow">${p.Discount_Percentage}% OFF</span></td>
            <td>${p.Valid_To}</td>
            <td>
                <div style="display: flex; gap: 6px;">
                    <button class="cyber-btn-outline" style="padding: 3px 8px; font-size: 10px;" onclick="copyAndUsePromo('${p.Promo_Code}')">
                        USE
                    </button>
                    <button class="table-action-delete" onclick="handleDeletePromo('${p.Promo_Code}')">
                        ✕
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function copyAndUsePromo(code) {
    state.promoCode = code;
    document.getElementById('promo-code').value = code;
    switchView('passenger');
    applyPromoCode();
    showToast(`Loaded voucher '${code}' into booking portal!`, 'success');
}

function openPromoModal() {
    document.getElementById('promo-modal').classList.add('active');
}

function closePromoModal() {
    document.getElementById('promo-modal').classList.remove('active');
}

async function handleCreatePromo(event) {
    event.preventDefault();
    const code = document.getElementById('new-promo-code').value.trim().toUpperCase();
    const discount = Number(document.getElementById('new-promo-discount').value);
    const validFrom = document.getElementById('new-promo-from').value;
    const validTo = document.getElementById('new-promo-to').value;
    const desc = document.getElementById('new-promo-desc').value.trim();

    try {
        const res = await fetch(`${API_BASE}/promo-codes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                promo_code: code,
                discount_percentage: discount,
                valid_from: validFrom,
                valid_to: validTo,
                description: desc
            })
        });

        const data = await res.json();
        if (res.ok) {
            closePromoModal();
            document.getElementById('new-promo-code').value = '';
            document.getElementById('new-promo-desc').value = '';
            showToast(`Promo voucher '${code}' activated with ${discount}% discount!`, 'success');
            await refreshAdminDashboard();
        } else {
            showToast(data.error || 'Failed to create promo code.', 'error');
        }
    } catch (err) {
        showToast('Error saving promotion offer.', 'error');
    }
}

async function handleDeletePromo(code) {
    if (!confirm(`Are you sure you want to deactivate promotion '${code}'?`)) return;

    try {
        const res = await fetch(`${API_BASE}/promo-codes`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ promo_code: code })
        });

        if (res.ok) {
            showToast(`Promo voucher '${code}' removed.`, 'info');
            await refreshAdminDashboard();
        }
    } catch (err) {
        showToast('Error removing promo voucher.', 'error');
    }
}

// =============================================================================
// 9. TOAST NOTIFICATION UTILITY
// =============================================================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '⚡';
    if (type === 'warning') icon = '⏳';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `
        <span style="font-size: 18px;">${icon}</span>
        <div>${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}
