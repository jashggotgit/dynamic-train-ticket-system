# CYBERAIL // Dynamic Train Ticket & Waitlist System
**Enterprise University DBMS Project**  
*Built with Oracle SQL (3NF), PL/SQL Stored Procedures & Triggers, Node.js Backend, and a Cyberpunk Glassmorphism Frontend.*

---

## 📑 Table of Contents
1. [Project Overview & Architecture](#-project-overview--architecture)
2. [Phase 1: Relational Database Schema (15 Entities)](#-phase-1-relational-database-schema-15-entities)
3. [Phase 2: PL/SQL Core Logic & Trigger Mechanics](#-phase-2-plsql-core-logic--trigger-mechanics)
4. [Phase 3: Web Dashboard & UI/UX Features](#-phase-3-web-dashboard--uiux-features)
5. [Quick Start & Execution Guide](#-quick-start--execution-guide)
6. [API Endpoints Reference](#-api-endpoints-reference)

---

## ⚡ Project Overview & Architecture

CYBERAIL is a state-of-the-art dynamic train reservation and waitlist automation engine designed for high-concurrency transit booking. When train seating reaches capacity, incoming passenger reservations transition into an active FIFO Waitlist Queue (`Waitlist_Log`). Whenever a confirmed ticket is cancelled, an **Autonomous PL/SQL Trigger** fires instantly, auto-allocating the vacated seat to the top waitlisted passenger and shifting all remaining queue positions up.

```mermaid
flowchart TD
    User([Passenger / Portal User]) -->|1. Submit Booking| Backend[Node.js / Express Server]
    Backend -->|2. Call Procedure| Proc["PL/SQL: BOOK_TICKET()"]
    Proc -->|Check Capacity| SeatCheck{Seats Available?}
    
    SeatCheck -->|Yes| Confirmed["Mark Seat BOOKED\nGenerate Confirmed Ticket\nRecord Payment"]
    SeatCheck -->|No (Capacity Full)| Waitlisted["Calculate Queue Position\nInsert Waitlist_Log\nRecord Deposit Payment"]

    Admin([Admin / Passenger]) -->|3. Cancel Ticket| CancelProc["PL/SQL: CANCEL_TICKET()"]
    CancelProc -->|Delete Ticket| Trigger["COMPOUND TRIGGER:\nTRG_TICKET_CANCEL_WAITLIST"]
    Trigger --> TopWL{Waitlist Queue Exists?}
    TopWL -->|Yes| Promote["Pop WL #1\nAssign Freed Seat\nConfirm Reservation\nShift Queue (WL_Pos - 1)"]
    TopWL -->|No| FreeSeat["Release Seat to AVAILABLE"]
```

---

## 🏛️ Phase 1: Relational Database Schema (15 Entities)

All tables strictly enforce 3NF normalization, primary keys, foreign keys with cascading actions, and domain check constraints:

| Entity # | Table Name | Primary Key | Key Foreign Keys | Purpose |
|---|---|---|---|---|
| **01** | `Train` | `Train_ID` | - | Fleet trains, types, total capacities |
| **02** | `Station` | `Station_ID` | - | Transit stations, cities, platform counts |
| **03** | `Route_Schedule` | `Schedule_ID` | `Train_ID`, `Station_ID` | Route stops, arrival/departure timestamps |
| **04** | `Coach_Class` | `Class_ID` | - | Fare multipliers (1A, 2A, 3A, CC, SL) |
| **05** | `Seat` | `Seat_No` | `Train_ID`, `Class_ID` | Physical seats and availability state |
| **06** | `Passenger` | `Passenger_ID` | - | Passenger identity and contact registry |
| **07** | `Reservation` | `PNR_No` | `Passenger_ID` | Booking transaction, amount, status |
| **08** | `Ticket` | `Ticket_ID` | `PNR_No`, `Seat_No`, `Train_ID` | Confirmed boarding pass allocation |
| **09** | `Waitlist_Log` | `Waitlist_ID` | `PNR_No`, `Train_ID` | Real-time FIFO waitlist queue order |
| **10** | `Department` | `Dept_ID` | `Manager_ID` (Emp_ID) | Operational organizational units |
| **11** | `Employee` | `Emp_ID` | `Station_ID`, `Dept_ID` | Staff, technicians, station managers |
| **12** | `Payment` | `Payment_ID` | `PNR_No` | Financial transaction audit trail |
| **13** | `Refund_Log` | `Refund_ID` | `Payment_ID`, `PNR_No` | Refund calculations on cancellations |
| **14** | `Train_Maintenance` | `Log_ID` | `Train_ID`, `Emp_ID` | Safety diagnostics & mechanical status |
| **15** | `Promotion_Offer` | `Promo_Code` | - | Time-bound voucher discount codes |

---

## ⚙️ Phase 2: PL/SQL Core Logic & Trigger Mechanics

### 1. Stored Procedure: `BOOK_TICKET`
- Atomically checks seat availability in the requested class and locks the row (`FOR UPDATE`).
- If seats are available, updates `Seat.Status = 'BOOKED'`, creates `Reservation` (`CONFIRMED`), issues `Ticket`, and logs `Payment`.
- If capacity is exhausted, computes `NVL(MAX(Queue_Position), 0) + 1` and registers a record into `Waitlist_Log` with `Reservation` (`WAITLISTED`).

### 2. Autonomous Compound Trigger: `TRG_TICKET_CANCEL_WAITLIST`
- **Mutating Table Prevention:** Implemented as a **Compound Trigger** (`FOR DELETE ON Ticket COMPOUND TRIGGER`). Captures the freed seat in `AFTER EACH ROW` and executes the promotion query in `AFTER STATEMENT`, permanently eliminating Oracle's `ORA-04091: mutating table` error.
- **Auto-Promotion:** Fetches the top waitlisted passenger (`ROWNUM = 1 ORDER BY Queue_Position ASC`), creates a confirmed `Ticket` with the freed seat, updates `Reservation.Status = 'CONFIRMED'`, deletes the waitlist record, and decrements all remaining queue positions (`Queue_Position = Queue_Position - 1`).

### 3. Stored Procedure: `CANCEL_TICKET`
- Calculates refund amount (deducting 10% processing fee), inserts audit entry into `Refund_Log`, updates `Payment.Status = 'REFUNDED'`, marks `Reservation.Status = 'CANCELLED'`, and deletes the `Ticket` row, which automatically triggers `TRG_TICKET_CANCEL_WAITLIST`.

---

## 🎨 Phase 3: Web Dashboard & UI/UX Features

- **Dark-Themed Cyberpunk Aesthetic:** Deep dark space background (`#07090e`), frosted glassmorphism cards (`backdrop-filter: blur(20px)`), and glowing neon cyan/purple/green accents.
- **Interactive Physical Seat Matrix:** Real-time visual chassis representation of train seating with dynamic color-coded state indicators (Available, Booked, Selected).
- **Dynamic Fare Engine:** Calculates base fare $\times$ coach class multiplier $-$ promotional discount percentage in real time.
- **Admin Control Center:**
  - Real-time KPI summary counters (Total Reservations, Active Waitlists, Revenue, Capacity Utilization).
  - Live PL/SQL Execution Telemetry Feed.
  - Interactive Waitlist Queue Table.
  - 1-Click Ticket Cancellation tool to demonstrate the PL/SQL Trigger firing live.
  - Train Maintenance and Safety dispatch console.

---

## 🚀 Quick Start & Execution Guide

### Option A: Running the Web Application
Double-click `start.bat` or run:
```bash
# In project folder:
node server.js
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Option B: Executing in Oracle SQL*Plus
```bash
# Connect to your Oracle DB instance:
sqlplus username/password@localhost:1521/XE

# Execute Phase 1 Schema & Seed Data:
SQL> @schema.sql

# Execute Phase 2 PL/SQL Logic & Automated Test Harness:
SQL> @logic.sql
```

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service status & active Oracle engine telemetry |
| `GET` | `/api/trains` | List of trains with available seats & waitlist counts |
| `GET` | `/api/seats?train_id=101` | Physical seating matrix for train |
| `POST` | `/api/fare/calculate` | Computes dynamic fare based on class & promo |
| `POST` | `/api/tickets/book` | Calls PL/SQL `BOOK_TICKET` procedure |
| `POST` | `/api/tickets/cancel` | Calls PL/SQL `CANCEL_TICKET` procedure |
| `GET` | `/api/tickets` | Active confirmed tickets |
| `GET` | `/api/waitlist` | Current waitlist queue entries |
| `GET` | `/api/dashboard/stats` | Real-time KPI analytics |
| `GET` | `/api/trigger-logs` | Live PL/SQL trigger execution telemetry |
| `GET` | `/api/maintenance` | Maintenance & safety logs |
| `POST` | `/api/maintenance` | Dispatch new maintenance log |
