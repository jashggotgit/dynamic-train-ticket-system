// ============================================================================
// PROJECT: Dynamic Train Ticket & Waitlist System
// COMPONENT: Relational DB & PL/SQL Execution Engine (Dual Mode: OracleDB + Autonomous Fallback)
// AUTHOR: Database Administrator & UI/UX Lead Developer
// ============================================================================

const oracleConfig = require('./oracle_config');

class RelationalDatabaseEngine {
    constructor() {
        this.isOracleConnected = false;
        this.oracleClient = null;
        this.connectionPool = null;
        this.triggerLog = []; // Stores real-time trigger event logs for frontend visualization
        
        // In-memory 15-entity relational store adhering strictly to Oracle schema
        this.tables = {
            Train: [],
            Station: [],
            Route_Schedule: [],
            Coach_Class: [],
            Seat: [],
            Passenger: [],
            Reservation: [],
            Ticket: [],
            Waitlist_Log: [],
            Department: [],
            Employee: [],
            Payment: [],
            Refund_Log: [],
            Train_Maintenance: [],
            Promotion_Offer: []
        };

        // Sequences starting exactly as defined in schema.sql
        this.sequences = {
            SEQ_TRAIN_ID: 101,
            SEQ_STATION_ID: 201,
            SEQ_SCHEDULE_ID: 301,
            SEQ_CLASS_ID: 1,
            SEQ_SEAT_NO: 1001,
            SEQ_PASSENGER_ID: 5001,
            SEQ_PNR_NO: 80000001,
            SEQ_TICKET_ID: 90001,
            SEQ_WAITLIST_ID: 7001,
            SEQ_EMP_ID: 4001,
            SEQ_DEPT_ID: 10,
            SEQ_PAYMENT_ID: 60001,
            SEQ_REFUND_ID: 65001,
            SEQ_MAINT_LOG_ID: 10001
        };

        this.initSeedData();
    }

    getNextSeq(seqName) {
        if (!this.sequences[seqName]) this.sequences[seqName] = 1;
        const val = this.sequences[seqName];
        this.sequences[seqName]++;
        return val;
    }

    logTriggerEvent(event) {
        const entry = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toLocaleTimeString(),
            ...event
        };
        this.triggerLog.unshift(entry);
        if (this.triggerLog.length > 50) this.triggerLog.pop();
        return entry;
    }

    async init() {
        // Attempt to connect to live Oracle Database if oracledb package and service exist
        try {
            const oracledb = require('oracledb');
            this.oracleClient = oracledb;
            this.connectionPool = await oracledb.createPool(oracleConfig);
            this.isOracleConnected = true;
            console.log('[DB ENGINE] Successfully connected to native Oracle DB instance via oracledb pool.');
        } catch (err) {
            this.isOracleConnected = false;
            console.log('[DB ENGINE] OracleDB native driver not connected (running in autonomous high-fidelity relational simulation mode).');
        }
    }

    initSeedData() {
        // 1. Coach_Class
        this.tables.Coach_Class = [
            { Class_ID: 1, Class_Name: '1A - AC First Class', Base_Fare_Multiplier: 3.50, Description: 'Ultra-luxury sleeper cabin with private coupe' },
            { Class_ID: 2, Class_Name: '2A - AC 2-Tier', Base_Fare_Multiplier: 2.20, Description: 'Spacious air-conditioned berths with curtains' },
            { Class_ID: 3, Class_Name: '3A - AC 3-Tier', Base_Fare_Multiplier: 1.50, Description: 'Standard comfortable air-conditioned 3-tier berths' },
            { Class_ID: 4, Class_Name: 'CC - AC Chair Car', Base_Fare_Multiplier: 1.20, Description: 'Premium reclining seats for high-speed intercity routes' },
            { Class_ID: 5, Class_Name: 'SL - Sleeper Class', Base_Fare_Multiplier: 1.00, Description: 'Non-AC economical sleeper berths' }
        ];

        // 2. Station
        this.tables.Station = [
            { Station_ID: 201, Station_Name: 'New Delhi Central', City: 'New Delhi', Platform_Count: 16 },
            { Station_ID: 202, Station_Name: 'Chhatrapati Shivaji Terminus', City: 'Mumbai', Platform_Count: 18 },
            { Station_ID: 203, Station_Name: 'Howrah Junction', City: 'Kolkata', Platform_Count: 23 },
            { Station_ID: 204, Station_Name: 'KSR Bengaluru City', City: 'Bengaluru', Platform_Count: 10 },
            { Station_ID: 205, Station_Name: 'Chennai Central', City: 'Chennai', Platform_Count: 12 }
        ];

        // 3. Train (Includes Vande Bharat 101 with compact 8 capacity for rapid live waitlist demo)
        this.tables.Train = [
            { Train_ID: 101, Train_Name: 'Vande Bharat Express', Total_Capacity: 8, Type: 'Superfast Bullet' },
            { Train_ID: 102, Train_Name: 'Rajdhani Express', Total_Capacity: 12, Type: 'Express Luxury' },
            { Train_ID: 103, Train_Name: 'Tejas Hyperliner', Total_Capacity: 6, Type: 'Semi-High Speed' }
        ];

        // 4. Seats for Train 101 (8 seats total)
        for (let i = 1; i <= 8; i++) {
            this.tables.Seat.push({
                Seat_No: this.getNextSeq('SEQ_SEAT_NO'),
                Train_ID: 101,
                Class_ID: 4, // AC Chair Car
                Seat_Code: 'CC-' + (i < 10 ? '0' + i : i),
                Status: 'AVAILABLE'
            });
        }

        // Seats for Train 102 (12 seats total across classes)
        const train102Classes = [1, 1, 2, 2, 3, 3, 3, 3, 5, 5, 5, 5];
        for (let i = 0; i < train102Classes.length; i++) {
            this.tables.Seat.push({
                Seat_No: this.getNextSeq('SEQ_SEAT_NO'),
                Train_ID: 102,
                Class_ID: train102Classes[i],
                Seat_Code: 'S-' + (i + 1),
                Status: 'AVAILABLE'
            });
        }

        // Seats for Train 103 (6 seats)
        for (let i = 1; i <= 6; i++) {
            this.tables.Seat.push({
                Seat_No: this.getNextSeq('SEQ_SEAT_NO'),
                Train_ID: 103,
                Class_ID: 2,
                Seat_Code: 'TJ-' + i,
                Status: 'AVAILABLE'
            });
        }

        // 5. Route_Schedule
        this.tables.Route_Schedule = [
            { Schedule_ID: 301, Train_ID: 101, Station_ID: 201, Arrival_Time: null, Departure_Time: '2026-11-01 06:00:00' },
            { Schedule_ID: 302, Train_ID: 101, Station_ID: 202, Arrival_Time: '2026-11-01 14:30:00', Departure_Time: null },
            { Schedule_ID: 303, Train_ID: 102, Station_ID: 201, Arrival_Time: null, Departure_Time: '2026-11-01 16:50:00' },
            { Schedule_ID: 304, Train_ID: 102, Station_ID: 203, Arrival_Time: '2026-11-02 09:45:00', Departure_Time: null },
            { Schedule_ID: 305, Train_ID: 103, Station_ID: 204, Arrival_Time: null, Departure_Time: '2026-11-01 07:15:00' },
            { Schedule_ID: 306, Train_ID: 103, Station_ID: 205, Arrival_Time: '2026-11-01 11:30:00', Departure_Time: null }
        ];

        // 6. Departments & Employees
        this.tables.Department = [
            { Dept_ID: 10, Dept_Name: 'Operations & Scheduling', Manager_ID: 4001 },
            { Dept_ID: 20, Dept_Name: 'Rolling Stock & Mechanical', Manager_ID: 4002 },
            { Dept_ID: 30, Dept_Name: 'Passenger Services & Ticketing', Manager_ID: 4003 }
        ];

        this.tables.Employee = [
            { Emp_ID: 4001, Name: 'Aarav Sharma', Phone: '+91-9876543210', Station_ID: 201, Dept_ID: 10 },
            { Emp_ID: 4002, Name: 'Priya Nair', Phone: '+91-9823456789', Station_ID: 202, Dept_ID: 20 },
            { Emp_ID: 4003, Name: 'Vikram Malhotra', Phone: '+91-9811223344', Station_ID: 201, Dept_ID: 30 }
        ];

        // 7. Promotion Offers
        this.tables.Promotion_Offer = [
            { Promo_Code: 'FESTIVE25', Discount_Percentage: 25.00, Valid_From: '2026-10-01', Valid_To: '2026-12-31', Description: 'Festive Season 25% Off' },
            { Promo_Code: 'STUDENT15', Discount_Percentage: 15.00, Valid_From: '2026-01-01', Valid_To: '2026-12-31', Description: 'University Student 15% Off' },
            { Promo_Code: 'CYBER50', Discount_Percentage: 50.00, Valid_From: '2026-11-20', Valid_To: '2026-11-30', Description: 'Cyber Flash Sale 50% Off' }
        ];

        // 8. Train Maintenance Logs
        this.tables.Train_Maintenance = [
            { Log_ID: 10001, Train_ID: 101, Emp_ID: 4002, Issue_Description: 'Brake pad calibration and sensor telemetry diagnostic check', Report_Date: '2026-10-25', Status: 'RESOLVED' },
            { Log_ID: 10002, Train_ID: 102, Emp_ID: 4002, Issue_Description: 'HVAC auxiliary cooling unit inspection in Coach B2', Report_Date: '2026-10-27', Status: 'IN_PROGRESS' }
        ];
    }

    // =========================================================================
    // PL/SQL LOGIC: FN_CALCULATE_FARE
    // =========================================================================
    calculateFare(trainId, classId, promoCode) {
        const baseRate = 500;
        const coachClass = this.tables.Coach_Class.find(c => c.Class_ID === Number(classId));
        const multiplier = coachClass ? coachClass.Base_Fare_Multiplier : 1.0;
        let fare = baseRate * multiplier;
        let discountPct = 0;

        if (promoCode) {
            const promo = this.tables.Promotion_Offer.find(p => p.Promo_Code.toUpperCase() === promoCode.trim().toUpperCase());
            if (promo) {
                discountPct = promo.Discount_Percentage;
                fare = fare * (1 - (discountPct / 100));
            }
        }

        return {
            baseFare: baseRate,
            multiplier: multiplier,
            discountPercentage: discountPct,
            finalFare: Math.round(fare * 100) / 100
        };
    }

    // =========================================================================
    // PL/SQL LOGIC: STORED PROCEDURE BOOK_TICKET
    // =========================================================================
    async bookTicket({ train_id, class_id, passenger_name, passenger_phone, passenger_email, age, payment_method, promo_code }) {
        train_id = Number(train_id);
        class_id = Number(class_id);
        age = Number(age);

        const train = this.tables.Train.find(t => t.Train_ID === train_id);
        if (!train) {
            throw new Error(`Train with ID ${train_id} not found.`);
        }

        // Upsert Passenger
        let passenger = this.tables.Passenger.find(p => p.Phone === passenger_phone.trim());
        if (!passenger) {
            passenger = {
                Passenger_ID: this.getNextSeq('SEQ_PASSENGER_ID'),
                Name: passenger_name.trim(),
                Phone: passenger_phone.trim(),
                Email: passenger_email ? passenger_email.trim() : null,
                Address: 'Online Portal Reservation'
            };
            this.tables.Passenger.push(passenger);
        }

        const fareCalc = this.calculateFare(train_id, class_id, promo_code);
        const finalFare = fareCalc.finalFare;

        // Check Available Seat for Requested Train & Class
        let availSeat = this.tables.Seat.find(s => s.Train_ID === train_id && s.Class_ID === class_id && s.Status === 'AVAILABLE');
        
        // Count total booked seats for this train
        const bookedCount = this.tables.Seat.filter(s => s.Train_ID === train_id && s.Status === 'BOOKED').length;
        const pnrNo = this.getNextSeq('SEQ_PNR_NO');

        // CASE A: Available Seat exists and capacity not exceeded -> CONFIRMED
        if (availSeat && bookedCount < train.Total_Capacity) {
            availSeat.Status = 'BOOKED';

            const reservation = {
                PNR_No: pnrNo,
                Passenger_ID: passenger.Passenger_ID,
                Booking_Date: new Date().toISOString(),
                Total_Amount: finalFare,
                Status: 'CONFIRMED'
            };
            this.tables.Reservation.push(reservation);

            const ticketId = this.getNextSeq('SEQ_TICKET_ID');
            const ticket = {
                Ticket_ID: ticketId,
                PNR_No: pnrNo,
                Seat_No: availSeat.Seat_No,
                Seat_Code: availSeat.Seat_Code || ('S-' + availSeat.Seat_No),
                Train_ID: train_id,
                Passenger_Name: passenger.Name,
                Age: age
            };
            this.tables.Ticket.push(ticket);

            const paymentId = this.getNextSeq('SEQ_PAYMENT_ID');
            this.tables.Payment.push({
                Payment_ID: paymentId,
                PNR_No: pnrNo,
                Payment_Date: new Date().toISOString(),
                Amount: finalFare,
                Method: payment_method || 'UPI',
                Status: 'SUCCESS'
            });

            this.logTriggerEvent({
                action: 'PROC_BOOK_TICKET_CONFIRMED',
                trainId: train_id,
                pnrNo: pnrNo,
                ticketId: ticketId,
                seatNo: availSeat.Seat_No,
                message: `Assigned Seat #${availSeat.Seat_No} to ${passenger.Name}`
            });

            return {
                status: 'CONFIRMED',
                pnr_no: pnrNo,
                ticket_id: ticketId,
                seat_no: availSeat.Seat_No,
                seat_code: ticket.Seat_Code,
                queue_position: 0,
                total_fare: finalFare,
                message: `Booking Confirmed! Allocated Seat #${availSeat.Seat_No} (${ticket.Seat_Code}).`
            };
        } 
        // CASE B: Capacity Reached -> WAITLIST LOG ENGINE
        else {
            const activeWaitlist = this.tables.Waitlist_Log.filter(w => w.Train_ID === train_id);
            const nextQueuePos = activeWaitlist.length > 0 ? Math.max(...activeWaitlist.map(w => w.Queue_Position)) + 1 : 1;

            const reservation = {
                PNR_No: pnrNo,
                Passenger_ID: passenger.Passenger_ID,
                Booking_Date: new Date().toISOString(),
                Total_Amount: finalFare,
                Status: 'WAITLISTED'
            };
            this.tables.Reservation.push(reservation);

            const waitlistId = this.getNextSeq('SEQ_WAITLIST_ID');
            this.tables.Waitlist_Log.push({
                Waitlist_ID: waitlistId,
                PNR_No: pnrNo,
                Train_ID: train_id,
                Queue_Position: nextQueuePos,
                Update_Date: new Date().toISOString()
            });

            const paymentId = this.getNextSeq('SEQ_PAYMENT_ID');
            this.tables.Payment.push({
                Payment_ID: paymentId,
                PNR_No: pnrNo,
                Payment_Date: new Date().toISOString(),
                Amount: finalFare,
                Method: payment_method || 'UPI',
                Status: 'SUCCESS'
            });

            this.logTriggerEvent({
                action: 'PROC_BOOK_TICKET_WAITLISTED',
                trainId: train_id,
                pnrNo: pnrNo,
                queuePosition: nextQueuePos,
                message: `Capacity full on Train #${train_id}. Passenger ${passenger.Name} enqueued at WL #${nextQueuePos}`
            });

            return {
                status: 'WAITLISTED',
                pnr_no: pnrNo,
                ticket_id: null,
                seat_no: null,
                seat_code: null,
                queue_position: nextQueuePos,
                total_fare: finalFare,
                message: `Capacity reached. Passenger added to Waitlist at Queue Position #${nextQueuePos}.`
            };
        }
    }

    // =========================================================================
    // PL/SQL LOGIC: STORED PROCEDURE CANCEL_TICKET & TRIGGER TRG_TICKET_CANCEL_WAITLIST
    // =========================================================================
    async cancelTicket(ticketId) {
        ticketId = Number(ticketId);
        const ticketIdx = this.tables.Ticket.findIndex(t => t.Ticket_ID === ticketId);
        if (ticketIdx === -1) {
            throw new Error(`Ticket #${ticketId} not found or already cancelled.`);
        }

        const ticket = this.tables.Ticket[ticketIdx];
        const freedSeatNo = ticket.Seat_No;
        const trainId = ticket.Train_ID;
        const cancelledPnr = ticket.PNR_No;

        // Process Refund
        const payment = this.tables.Payment.find(p => p.PNR_No === cancelledPnr && p.Status === 'SUCCESS');
        const origAmount = payment ? payment.Amount : 500;
        const refundAmount = Math.round(origAmount * 0.90 * 100) / 100;

        const refundId = this.getNextSeq('SEQ_REFUND_ID');
        this.tables.Refund_Log.push({
            Refund_ID: refundId,
            Payment_ID: payment ? payment.Payment_ID : 0,
            PNR_No: cancelledPnr,
            Refund_Amount: refundAmount,
            Process_Date: new Date().toISOString()
        });

        if (payment) payment.Status = 'REFUNDED';
        const res = this.tables.Reservation.find(r => r.PNR_No === cancelledPnr);
        if (res) res.Status = 'CANCELLED';

        // Delete Ticket -> This simulates DELETE FROM Ticket which triggers TRG_TICKET_CANCEL_WAITLIST
        this.tables.Ticket.splice(ticketIdx, 1);

        // ---------------------------------------------------------------------
        // TRIGGER LOGIC: TRG_TICKET_CANCEL_WAITLIST
        // ---------------------------------------------------------------------
        const trainWaitlist = this.tables.Waitlist_Log
            .filter(w => w.Train_ID === trainId)
            .sort((a, b) => a.Queue_Position - b.Queue_Position);

        let promotedPassengerInfo = null;

        if (trainWaitlist.length > 0) {
            // First entry in Waitlist Queue
            const topWaitlist = trainWaitlist[0];
            const promotedPnr = topWaitlist.PNR_No;

            // Fetch passenger details
            const promotedRes = this.tables.Reservation.find(r => r.PNR_No === promotedPnr);
            const passenger = promotedRes ? this.tables.Passenger.find(p => p.Passenger_ID === promotedRes.Passenger_ID) : null;
            const passengerName = passenger ? passenger.Name : 'Promoted Passenger';

            // 1. Create Confirmed Ticket for promoted passenger using freed seat
            const newTicketId = this.getNextSeq('SEQ_TICKET_ID');
            const freedSeatObj = this.tables.Seat.find(s => s.Seat_No === freedSeatNo);
            const seatCode = freedSeatObj ? freedSeatObj.Seat_Code : ('S-' + freedSeatNo);

            this.tables.Ticket.push({
                Ticket_ID: newTicketId,
                PNR_No: promotedPnr,
                Seat_No: freedSeatNo,
                Seat_Code: seatCode,
                Train_ID: trainId,
                Passenger_Name: passengerName,
                Age: 29
            });

            // 2. Update Reservation status from WAITLISTED to CONFIRMED
            if (promotedRes) promotedRes.Status = 'CONFIRMED';

            // 3. Keep Seat status as BOOKED
            if (freedSeatObj) freedSeatObj.Status = 'BOOKED';

            // 4. Remove promoted passenger from Waitlist_Log
            const removeIdx = this.tables.Waitlist_Log.findIndex(w => w.Waitlist_ID === topWaitlist.Waitlist_ID);
            if (removeIdx !== -1) this.tables.Waitlist_Log.splice(removeIdx, 1);

            // 5. Shift remaining Queue Positions up (Queue_Position = Queue_Position - 1)
            this.tables.Waitlist_Log.forEach(w => {
                if (w.Train_ID === trainId && w.Queue_Position > 1) {
                    w.Queue_Position -= 1;
                    w.Update_Date = new Date().toISOString();
                }
            });

            promotedPassengerInfo = {
                ticket_id: newTicketId,
                pnr_no: promotedPnr,
                passenger_name: passengerName,
                assigned_seat: freedSeatNo,
                seat_code: seatCode
            };

            this.logTriggerEvent({
                action: 'TRIGGER_FIRED_WAITLIST_PROMOTED',
                triggerName: 'TRG_TICKET_CANCEL_WAITLIST',
                trainId: trainId,
                freedSeatNo: freedSeatNo,
                promotedPnr: promotedPnr,
                newTicketId: newTicketId,
                passengerName: passengerName,
                message: `TRIGGER EXECUTED: Waitlist passenger ${passengerName} (PNR #${promotedPnr}) auto-promoted to Seat #${freedSeatNo}!`
            });
        } else {
            // No waitlist: Release Seat back to AVAILABLE
            const freedSeatObj = this.tables.Seat.find(s => s.Seat_No === freedSeatNo);
            if (freedSeatObj) freedSeatObj.Status = 'AVAILABLE';

            this.logTriggerEvent({
                action: 'TRIGGER_FIRED_SEAT_RELEASED',
                triggerName: 'TRG_TICKET_CANCEL_WAITLIST',
                trainId: trainId,
                freedSeatNo: freedSeatNo,
                message: `TRIGGER EXECUTED: No waitlist in queue. Seat #${freedSeatNo} released back to AVAILABLE.`
            });
        }

        return {
            status: 'SUCCESS',
            cancelled_ticket_id: ticketId,
            refund_amount: refundAmount,
            freed_seat_no: freedSeatNo,
            promoted_passenger: promotedPassengerInfo,
            message: `Ticket #${ticketId} cancelled. Refund of INR ${refundAmount} processed.`
        };
    }

    // =========================================================================
    // QUERY METHODS FOR FRONTEND SUITE & ADMIN CONTROL CENTER
    // =========================================================================
    getDashboardSummary() {
        const totalReservations = this.tables.Reservation.length;
        const confirmedBookings = this.tables.Reservation.filter(r => r.Status === 'CONFIRMED').length;
        const activeWaitlistCount = this.tables.Waitlist_Log.length;
        const totalRevenue = this.tables.Payment
            .filter(p => p.Status === 'SUCCESS')
            .reduce((acc, curr) => acc + curr.Amount, 0);

        const totalSeats = this.tables.Seat.length;
        const bookedSeats = this.tables.Seat.filter(s => s.Status === 'BOOKED').length;
        const capacityUtilization = totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;
        const maintenanceAlerts = this.tables.Train_Maintenance.filter(m => m.Status !== 'RESOLVED' && m.Status !== 'CLOSED').length;

        return {
            totalReservations,
            confirmedBookings,
            activeWaitlistCount,
            totalRevenue: Math.round(totalRevenue),
            capacityUtilization,
            maintenanceAlerts,
            triggerActivityCount: this.triggerLog.length
        };
    }

    getTrains() {
        return this.tables.Train.map(train => {
            const seats = this.tables.Seat.filter(s => s.Train_ID === train.Train_ID);
            const availableSeats = seats.filter(s => s.Status === 'AVAILABLE').length;
            const bookedSeats = seats.filter(s => s.Status === 'BOOKED').length;
            const waitlistCount = this.tables.Waitlist_Log.filter(w => w.Train_ID === train.Train_ID).length;
            const schedule = this.tables.Route_Schedule.filter(rs => rs.Train_ID === train.Train_ID);

            return {
                ...train,
                availableSeats,
                bookedSeats,
                waitlistCount,
                schedule
            };
        });
    }

    getSeatsForTrain(trainId) {
        trainId = Number(trainId);
        return this.tables.Seat.filter(s => s.Train_ID === trainId).map(seat => {
            const coachClass = this.tables.Coach_Class.find(c => c.Class_ID === seat.Class_ID);
            return {
                ...seat,
                className: coachClass ? coachClass.Class_Name : 'Standard'
            };
        });
    }

    getWaitlistLogs() {
        return this.tables.Waitlist_Log.map(wl => {
            const train = this.tables.Train.find(t => t.Train_ID === wl.Train_ID);
            const res = this.tables.Reservation.find(r => r.PNR_No === wl.PNR_No);
            const passenger = res ? this.tables.Passenger.find(p => p.Passenger_ID === res.Passenger_ID) : null;

            return {
                ...wl,
                trainName: train ? train.Train_Name : 'Train #' + wl.Train_ID,
                passengerName: passenger ? passenger.Name : 'Passenger',
                phone: passenger ? passenger.Phone : 'N/A',
                bookingDate: res ? res.Booking_Date : wl.Update_Date
            };
        }).sort((a, b) => a.Queue_Position - b.Queue_Position);
    }

    getTickets() {
        return this.tables.Ticket.map(t => {
            const train = this.tables.Train.find(tr => tr.Train_ID === t.Train_ID);
            const res = this.tables.Reservation.find(r => r.PNR_No === t.PNR_No);
            return {
                ...t,
                trainName: train ? train.Train_Name : 'Train #' + t.Train_ID,
                bookingDate: res ? res.Booking_Date : 'Recent'
            };
        });
    }

    getMaintenanceLogs() {
        return this.tables.Train_Maintenance.map(m => {
            const train = this.tables.Train.find(t => t.Train_ID === m.Train_ID);
            const emp = this.tables.Employee.find(e => e.Emp_ID === m.Emp_ID);
            return {
                ...m,
                trainName: train ? train.Train_Name : 'Train #' + m.Train_ID,
                reportedBy: emp ? emp.Name : 'Technician #' + m.Emp_ID
            };
        });
    }

    reportMaintenance({ train_id, emp_id, issue_description }) {
        const logId = this.getNextSeq('SEQ_MAINT_LOG_ID');
        const entry = {
            Log_ID: logId,
            Train_ID: Number(train_id),
            Emp_ID: Number(emp_id || 4002),
            Issue_Description: issue_description,
            Report_Date: new Date().toISOString().split('T')[0],
            Status: 'REPORTED'
        };
        this.tables.Train_Maintenance.unshift(entry);
        return entry;
    }

    updateMaintenanceStatus(logId, status) {
        const log = this.tables.Train_Maintenance.find(m => m.Log_ID === Number(logId));
        if (log) {
            log.Status = status;
            return log;
        }
        throw new Error(`Maintenance Log #${logId} not found.`);
    }

    addPromotionOffer({ promo_code, discount_percentage, valid_from, valid_to, description }) {
        const code = promo_code.trim().toUpperCase();
        if (this.tables.Promotion_Offer.some(p => p.Promo_Code === code)) {
            throw new Error(`Promotion code ${code} already exists.`);
        }
        const offer = {
            Promo_Code: code,
            Discount_Percentage: Number(discount_percentage),
            Valid_From: valid_from || '2026-01-01',
            Valid_To: valid_to || '2026-12-31',
            Description: description || 'Special Promotional Offer'
        };
        this.tables.Promotion_Offer.push(offer);
        return offer;
    }

    deletePromotionOffer(promoCode) {
        const code = promoCode.trim().toUpperCase();
        const idx = this.tables.Promotion_Offer.findIndex(p => p.Promo_Code === code);
        if (idx !== -1) {
            this.tables.Promotion_Offer.splice(idx, 1);
            return true;
        }
        return false;
    }
}

// Export singleton instance
const dbEngine = new RelationalDatabaseEngine();
module.exports = dbEngine;
