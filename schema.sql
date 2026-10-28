-- ============================================================================
-- PROJECT: Dynamic Train Ticket & Waitlist System
-- COMPONENT: Phase 1 - Database Schema & Initialization
-- TARGET DBMS: Oracle SQL / PL*SQL (Executable directly in SQL*Plus)
-- AUTHOR: Database Administrator & UI/UX Lead Developer
-- ============================================================================

SET ECHO ON;
SET FEEDBACK ON;
SET SERVEROUTPUT ON;

PROMPT ============================================================================
PROMPT 1. SAFELY CLEANING UP PREVIOUS OBJECTS (IDEMPOTENT RESET)
PROMPT ============================================================================

-- Drop all tables cleanly handling constraints and dependencies
BEGIN
    FOR cur_tbl IN (
        SELECT table_name FROM user_tables WHERE table_name IN (
            'REFUND_LOG', 'PAYMENT', 'TICKET', 'WAITLIST_LOG', 'RESERVATION', 
            'PASSENGER', 'TRAIN_MAINTENANCE', 'SEAT', 'COACH_CLASS', 
            'ROUTE_SCHEDULE', 'EMPLOYEE', 'DEPARTMENT', 'STATION', 'TRAIN', 
            'PROMOTION_OFFER'
        )
    ) LOOP
        EXECUTE IMMEDIATE 'DROP TABLE ' || cur_tbl.table_name || ' CASCADE CONSTRAINTS PURGE';
        DBMS_OUTPUT.PUT_LINE('Dropped table: ' || cur_tbl.table_name);
    END LOOP;
END;
/

-- Drop all sequences cleanly
BEGIN
    FOR cur_seq IN (
        SELECT sequence_name FROM user_sequences WHERE sequence_name IN (
            'SEQ_TRAIN_ID', 'SEQ_STATION_ID', 'SEQ_SCHEDULE_ID', 'SEQ_CLASS_ID',
            'SEQ_SEAT_NO', 'SEQ_PASSENGER_ID', 'SEQ_PNR_NO', 'SEQ_TICKET_ID',
            'SEQ_WAITLIST_ID', 'SEQ_EMP_ID', 'SEQ_DEPT_ID', 'SEQ_PAYMENT_ID',
            'SEQ_REFUND_ID', 'SEQ_MAINT_LOG_ID'
        )
    ) LOOP
        EXECUTE IMMEDIATE 'DROP SEQUENCE ' || cur_seq.sequence_name;
        DBMS_OUTPUT.PUT_LINE('Dropped sequence: ' || cur_seq.sequence_name);
    END LOOP;
END;
/

PROMPT ============================================================================
PROMPT 2. CREATING SEQUENCES FOR AUTO-INCREMENTING IDENTIFIERS
PROMPT ============================================================================

CREATE SEQUENCE SEQ_TRAIN_ID       START WITH 101   INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_STATION_ID     START WITH 201   INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_SCHEDULE_ID    START WITH 301   INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_CLASS_ID       START WITH 1     INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_SEAT_NO        START WITH 1001  INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_PASSENGER_ID   START WITH 5001  INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_PNR_NO         START WITH 80000001 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_TICKET_ID      START WITH 90001 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_WAITLIST_ID    START WITH 7001  INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_EMP_ID         START WITH 4001  INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_DEPT_ID        START WITH 10    INCREMENT BY 10 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_PAYMENT_ID     START WITH 60001 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_REFUND_ID      START WITH 65001 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE SEQ_MAINT_LOG_ID   START WITH 10001 INCREMENT BY 1 NOCACHE NOCYCLE;

PROMPT Sequences created successfully.

PROMPT ============================================================================
PROMPT 3. CREATING RELATIONAL TABLES (15 CORE ENTITIES)
PROMPT ============================================================================

-- ----------------------------------------------------------------------------
-- ENTITY 1: Train
-- ----------------------------------------------------------------------------
CREATE TABLE Train (
    Train_ID        NUMBER          NOT NULL,
    Train_Name      VARCHAR2(100)   NOT NULL,
    Total_Capacity  NUMBER(5)       NOT NULL,
    Type            VARCHAR2(50)    NOT NULL,
    CONSTRAINT PK_Train PRIMARY KEY (Train_ID),
    CONSTRAINT CHK_Train_Capacity CHECK (Total_Capacity > 0)
);

-- ----------------------------------------------------------------------------
-- ENTITY 2: Station
-- ----------------------------------------------------------------------------
CREATE TABLE Station (
    Station_ID      NUMBER          NOT NULL,
    Station_Name    VARCHAR2(100)   NOT NULL,
    City            VARCHAR2(100)   NOT NULL,
    Platform_Count  NUMBER(3)       NOT NULL,
    CONSTRAINT PK_Station PRIMARY KEY (Station_ID),
    CONSTRAINT UQ_Station_Name_City UNIQUE (Station_Name, City),
    CONSTRAINT CHK_Station_Platforms CHECK (Platform_Count > 0)
);

-- ----------------------------------------------------------------------------
-- ENTITY 3: Route_Schedule
-- ----------------------------------------------------------------------------
CREATE TABLE Route_Schedule (
    Schedule_ID     NUMBER          NOT NULL,
    Train_ID        NUMBER          NOT NULL,
    Station_ID      NUMBER          NOT NULL,
    Arrival_Time    DATE,
    Departure_Time  DATE,
    CONSTRAINT PK_Route_Schedule PRIMARY KEY (Schedule_ID),
    CONSTRAINT FK_RS_Train FOREIGN KEY (Train_ID) 
        REFERENCES Train(Train_ID) ON DELETE CASCADE,
    CONSTRAINT FK_RS_Station FOREIGN KEY (Station_ID) 
        REFERENCES Station(Station_ID) ON DELETE CASCADE,
    CONSTRAINT CHK_RS_Times CHECK (Departure_Time IS NULL OR Arrival_Time IS NULL OR Departure_Time >= Arrival_Time)
);

-- ----------------------------------------------------------------------------
-- ENTITY 4: Coach_Class
-- ----------------------------------------------------------------------------
CREATE TABLE Coach_Class (
    Class_ID             NUMBER         NOT NULL,
    Class_Name           VARCHAR2(50)   NOT NULL,
    Base_Fare_Multiplier NUMBER(4, 2)   DEFAULT 1.00 NOT NULL,
    Description          VARCHAR2(255),
    CONSTRAINT PK_Coach_Class PRIMARY KEY (Class_ID),
    CONSTRAINT UQ_Class_Name UNIQUE (Class_Name),
    CONSTRAINT CHK_Class_Multiplier CHECK (Base_Fare_Multiplier > 0)
);

-- ----------------------------------------------------------------------------
-- ENTITY 5: Seat
-- ----------------------------------------------------------------------------
CREATE TABLE Seat (
    Seat_No         NUMBER          NOT NULL,
    Train_ID        NUMBER          NOT NULL,
    Class_ID        NUMBER          NOT NULL,
    Status          VARCHAR2(20)    DEFAULT 'AVAILABLE' NOT NULL,
    CONSTRAINT PK_Seat PRIMARY KEY (Seat_No),
    CONSTRAINT FK_Seat_Train FOREIGN KEY (Train_ID) 
        REFERENCES Train(Train_ID) ON DELETE CASCADE,
    CONSTRAINT FK_Seat_Class FOREIGN KEY (Class_ID) 
        REFERENCES Coach_Class(Class_ID),
    CONSTRAINT CHK_Seat_Status CHECK (Status IN ('AVAILABLE', 'BOOKED', 'RESERVED', 'MAINTENANCE'))
);

-- ----------------------------------------------------------------------------
-- ENTITY 6: Passenger
-- ----------------------------------------------------------------------------
CREATE TABLE Passenger (
    Passenger_ID    NUMBER          NOT NULL,
    Name            VARCHAR2(100)   NOT NULL,
    Phone           VARCHAR2(20)    NOT NULL,
    Email           VARCHAR2(100),
    Address         VARCHAR2(255),
    CONSTRAINT PK_Passenger PRIMARY KEY (Passenger_ID),
    CONSTRAINT UQ_Passenger_Email UNIQUE (Email)
);

-- ----------------------------------------------------------------------------
-- ENTITY 7: Reservation
-- ----------------------------------------------------------------------------
CREATE TABLE Reservation (
    PNR_No          NUMBER(10)      NOT NULL,
    Passenger_ID    NUMBER          NOT NULL,
    Booking_Date    DATE            DEFAULT SYSDATE NOT NULL,
    Total_Amount    NUMBER(10, 2)   DEFAULT 0.00 NOT NULL,
    Status          VARCHAR2(20)    DEFAULT 'CONFIRMED' NOT NULL,
    CONSTRAINT PK_Reservation PRIMARY KEY (PNR_No),
    CONSTRAINT FK_Res_Passenger FOREIGN KEY (Passenger_ID) 
        REFERENCES Passenger(Passenger_ID) ON DELETE CASCADE,
    CONSTRAINT CHK_Res_Amount CHECK (Total_Amount >= 0),
    CONSTRAINT CHK_Res_Status CHECK (Status IN ('CONFIRMED', 'WAITLISTED', 'CANCELLED', 'PARTIAL'))
);

-- ----------------------------------------------------------------------------
-- ENTITY 8: Ticket
-- ----------------------------------------------------------------------------
CREATE TABLE Ticket (
    Ticket_ID       NUMBER          NOT NULL,
    PNR_No          NUMBER(10)      NOT NULL,
    Seat_No         NUMBER,
    Train_ID        NUMBER          NOT NULL,
    Passenger_Name  VARCHAR2(100)   NOT NULL,
    Age             NUMBER(3)       NOT NULL,
    CONSTRAINT PK_Ticket PRIMARY KEY (Ticket_ID),
    CONSTRAINT FK_Ticket_PNR FOREIGN KEY (PNR_No) 
        REFERENCES Reservation(PNR_No) ON DELETE CASCADE,
    CONSTRAINT FK_Ticket_Seat FOREIGN KEY (Seat_No) 
        REFERENCES Seat(Seat_No) ON DELETE SET NULL,
    CONSTRAINT FK_Ticket_Train FOREIGN KEY (Train_ID) 
        REFERENCES Train(Train_ID),
    CONSTRAINT CHK_Ticket_Age CHECK (Age >= 0 AND Age <= 125)
);

-- ----------------------------------------------------------------------------
-- ENTITY 9: Waitlist_Log
-- ----------------------------------------------------------------------------
CREATE TABLE Waitlist_Log (
    Waitlist_ID     NUMBER          NOT NULL,
    PNR_No          NUMBER(10)      NOT NULL,
    Train_ID        NUMBER          NOT NULL,
    Queue_Position  NUMBER(5)       NOT NULL,
    Update_Date     DATE            DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_Waitlist_Log PRIMARY KEY (Waitlist_ID),
    CONSTRAINT FK_Waitlist_PNR FOREIGN KEY (PNR_No) 
        REFERENCES Reservation(PNR_No) ON DELETE CASCADE,
    CONSTRAINT FK_Waitlist_Train FOREIGN KEY (Train_ID) 
        REFERENCES Train(Train_ID) ON DELETE CASCADE,
    CONSTRAINT CHK_Waitlist_Pos CHECK (Queue_Position >= 1)
);

-- ----------------------------------------------------------------------------
-- ENTITY 10: Department
-- Note: Manager_ID FK references Employee(Emp_ID) added after Employee creation
-- ----------------------------------------------------------------------------
CREATE TABLE Department (
    Dept_ID         NUMBER          NOT NULL,
    Dept_Name       VARCHAR2(100)   NOT NULL,
    Manager_ID      NUMBER,
    CONSTRAINT PK_Department PRIMARY KEY (Dept_ID),
    CONSTRAINT UQ_Dept_Name UNIQUE (Dept_Name)
);

-- ----------------------------------------------------------------------------
-- ENTITY 11: Employee
-- ----------------------------------------------------------------------------
CREATE TABLE Employee (
    Emp_ID          NUMBER          NOT NULL,
    Name            VARCHAR2(100)   NOT NULL,
    Phone           VARCHAR2(20)    NOT NULL,
    Station_ID      NUMBER,
    Dept_ID         NUMBER,
    CONSTRAINT PK_Employee PRIMARY KEY (Emp_ID),
    CONSTRAINT FK_Emp_Station FOREIGN KEY (Station_ID) 
        REFERENCES Station(Station_ID) ON DELETE SET NULL,
    CONSTRAINT FK_Emp_Dept FOREIGN KEY (Dept_ID) 
        REFERENCES Department(Dept_ID) ON DELETE SET NULL
);

-- Add circular Foreign Key constraint from Department to Employee
ALTER TABLE Department
    ADD CONSTRAINT FK_Dept_Manager FOREIGN KEY (Manager_ID) 
    REFERENCES Employee(Emp_ID) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- ENTITY 12: Payment
-- ----------------------------------------------------------------------------
CREATE TABLE Payment (
    Payment_ID      NUMBER          NOT NULL,
    PNR_No          NUMBER(10)      NOT NULL,
    Payment_Date    DATE            DEFAULT SYSDATE NOT NULL,
    Amount          NUMBER(10, 2)   NOT NULL,
    Method          VARCHAR2(50)    NOT NULL,
    Status          VARCHAR2(20)    DEFAULT 'SUCCESS' NOT NULL,
    CONSTRAINT PK_Payment PRIMARY KEY (Payment_ID),
    CONSTRAINT FK_Payment_PNR FOREIGN KEY (PNR_No) 
        REFERENCES Reservation(PNR_No) ON DELETE CASCADE,
    CONSTRAINT CHK_Payment_Amount CHECK (Amount >= 0),
    CONSTRAINT CHK_Payment_Status CHECK (Status IN ('SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'))
);

-- ----------------------------------------------------------------------------
-- ENTITY 13: Refund_Log
-- ----------------------------------------------------------------------------
CREATE TABLE Refund_Log (
    Refund_ID       NUMBER          NOT NULL,
    Payment_ID      NUMBER          NOT NULL,
    PNR_No          NUMBER(10)      NOT NULL,
    Refund_Amount   NUMBER(10, 2)   NOT NULL,
    Process_Date    DATE            DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_Refund_Log PRIMARY KEY (Refund_ID),
    CONSTRAINT FK_Refund_Payment FOREIGN KEY (Payment_ID) 
        REFERENCES Payment(Payment_ID) ON DELETE CASCADE,
    CONSTRAINT FK_Refund_PNR FOREIGN KEY (PNR_No) 
        REFERENCES Reservation(PNR_No) ON DELETE CASCADE,
    CONSTRAINT CHK_Refund_Amount CHECK (Refund_Amount >= 0)
);

-- ----------------------------------------------------------------------------
-- ENTITY 14: Train_Maintenance
-- ----------------------------------------------------------------------------
CREATE TABLE Train_Maintenance (
    Log_ID            NUMBER          NOT NULL,
    Train_ID          NUMBER          NOT NULL,
    Emp_ID            NUMBER          NOT NULL,
    Issue_Description VARCHAR2(500)   NOT NULL,
    Report_Date       DATE            DEFAULT SYSDATE NOT NULL,
    Status            VARCHAR2(30)    DEFAULT 'REPORTED' NOT NULL,
    CONSTRAINT PK_Train_Maintenance PRIMARY KEY (Log_ID),
    CONSTRAINT FK_Maint_Train FOREIGN KEY (Train_ID) 
        REFERENCES Train(Train_ID) ON DELETE CASCADE,
    CONSTRAINT FK_Maint_Emp FOREIGN KEY (Emp_ID) 
        REFERENCES Employee(Emp_ID) ON DELETE CASCADE,
    CONSTRAINT CHK_Maint_Status CHECK (Status IN ('REPORTED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'))
);

-- ----------------------------------------------------------------------------
-- ENTITY 15: Promotion_Offer
-- ----------------------------------------------------------------------------
CREATE TABLE Promotion_Offer (
    Promo_Code          VARCHAR2(30)    NOT NULL,
    Discount_Percentage NUMBER(5, 2)    NOT NULL,
    Valid_From          DATE            NOT NULL,
    Valid_To            DATE            NOT NULL,
    Description         VARCHAR2(255),
    CONSTRAINT PK_Promotion_Offer PRIMARY KEY (Promo_Code),
    CONSTRAINT CHK_Promo_Discount CHECK (Discount_Percentage >= 0 AND Discount_Percentage <= 100),
    CONSTRAINT CHK_Promo_Dates CHECK (Valid_To >= Valid_From)
);

PROMPT All 15 relational tables created successfully with strict PK/FK constraints.

PROMPT ============================================================================
PROMPT 4. CREATING PERFORMANCE INDEXES FOR FOREIGN KEYS & SEARCH FIELDS
PROMPT ============================================================================

CREATE INDEX IDX_RS_TRAIN        ON Route_Schedule(Train_ID);
CREATE INDEX IDX_RS_STATION      ON Route_Schedule(Station_ID);
CREATE INDEX IDX_SEAT_LOOKUP     ON Seat(Train_ID, Status);
CREATE INDEX IDX_RES_PASSENGER   ON Reservation(Passenger_ID);
CREATE INDEX IDX_TICKET_PNR      ON Ticket(PNR_No);
CREATE INDEX IDX_TICKET_TRAIN    ON Ticket(Train_ID);
CREATE INDEX IDX_WAITLIST_LOOKUP ON Waitlist_Log(Train_ID, Queue_Position);
CREATE INDEX IDX_PAYMENT_PNR     ON Payment(PNR_No);
CREATE INDEX IDX_MAINT_TRAIN     ON Train_Maintenance(Train_ID, Status);

PROMPT Indexes created successfully.

PROMPT ============================================================================
PROMPT 5. SEEDING FOUNDATIONAL SAMPLE DATA FOR TESTING & VERIFICATION
PROMPT ============================================================================

-- Insert Coach Classes
INSERT INTO Coach_Class (Class_ID, Class_Name, Base_Fare_Multiplier, Description)
VALUES (SEQ_CLASS_ID.NEXTVAL, '1A - AC First Class', 3.50, 'Ultra-luxury sleeper cabin with private coupe');
INSERT INTO Coach_Class (Class_ID, Class_Name, Base_Fare_Multiplier, Description)
VALUES (SEQ_CLASS_ID.NEXTVAL, '2A - AC 2-Tier', 2.20, 'Spacious air-conditioned berths with curtains');
INSERT INTO Coach_Class (Class_ID, Class_Name, Base_Fare_Multiplier, Description)
VALUES (SEQ_CLASS_ID.NEXTVAL, '3A - AC 3-Tier', 1.50, 'Standard comfortable air-conditioned 3-tier berths');
INSERT INTO Coach_Class (Class_ID, Class_Name, Base_Fare_Multiplier, Description)
VALUES (SEQ_CLASS_ID.NEXTVAL, 'CC - AC Chair Car', 1.20, 'Premium reclining seats for high-speed intercity routes');
INSERT INTO Coach_Class (Class_ID, Class_Name, Base_Fare_Multiplier, Description)
VALUES (SEQ_CLASS_ID.NEXTVAL, 'SL - Sleeper Class', 1.00, 'Non-AC economical sleeper berths');

-- Insert Stations
INSERT INTO Station (Station_ID, Station_Name, City, Platform_Count)
VALUES (SEQ_STATION_ID.NEXTVAL, 'New Delhi Central', 'New Delhi', 16);
INSERT INTO Station (Station_ID, Station_Name, City, Platform_Count)
VALUES (SEQ_STATION_ID.NEXTVAL, 'Chhatrapati Shivaji Maharaj Terminus', 'Mumbai', 18);
INSERT INTO Station (Station_ID, Station_Name, City, Platform_Count)
VALUES (SEQ_STATION_ID.NEXTVAL, 'Howrah Junction', 'Kolkata', 23);
INSERT INTO Station (Station_ID, Station_Name, City, Platform_Count)
VALUES (SEQ_STATION_ID.NEXTVAL, 'KSR Bengaluru City', 'Bengaluru', 10);
INSERT INTO Station (Station_ID, Station_Name, City, Platform_Count)
VALUES (SEQ_STATION_ID.NEXTVAL, 'Chennai Central', 'Chennai', 12);

-- Insert Trains (including small test capacity train for easy waitlist testing in Phase 2)
INSERT INTO Train (Train_ID, Train_Name, Total_Capacity, Type)
VALUES (SEQ_TRAIN_ID.NEXTVAL, 'Vande Bharat Express', 8, 'Superfast Bullet');
INSERT INTO Train (Train_ID, Train_Name, Total_Capacity, Type)
VALUES (SEQ_TRAIN_ID.NEXTVAL, 'Rajdhani Express', 12, 'Express Luxury');
INSERT INTO Train (Train_ID, Train_Name, Total_Capacity, Type)
VALUES (SEQ_TRAIN_ID.NEXTVAL, 'Tejas Hyperliner', 6, 'Semi-High Speed');

-- Insert Seats for Train 101 (Vande Bharat Express - Capacity 8)
-- 4 Executive Chair Car seats, 4 Chair Car seats
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 101, 4, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 101, 4, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 101, 4, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 101, 4, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 101, 4, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 101, 4, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 101, 4, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 101, 4, 'AVAILABLE');

-- Insert Seats for Train 102 (Rajdhani Express - Capacity 12)
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 102, 1, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 102, 1, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 102, 2, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 102, 2, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 102, 3, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 102, 3, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 102, 3, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 102, 3, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 102, 5, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 102, 5, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 102, 5, 'AVAILABLE');
INSERT INTO Seat (Seat_No, Train_ID, Class_ID, Status) VALUES (SEQ_SEAT_NO.NEXTVAL, 102, 5, 'AVAILABLE');

-- Insert Route Schedules
INSERT INTO Route_Schedule (Schedule_ID, Train_ID, Station_ID, Arrival_Time, Departure_Time)
VALUES (SEQ_SCHEDULE_ID.NEXTVAL, 101, 201, NULL, TO_DATE('2026-11-01 06:00:00', 'YYYY-MM-DD HH24:MI:SS'));
INSERT INTO Route_Schedule (Schedule_ID, Train_ID, Station_ID, Arrival_Time, Departure_Time)
VALUES (SEQ_SCHEDULE_ID.NEXTVAL, 101, 202, TO_DATE('2026-11-01 14:30:00', 'YYYY-MM-DD HH24:MI:SS'), NULL);

-- Insert Departments
INSERT INTO Department (Dept_ID, Dept_Name, Manager_ID)
VALUES (SEQ_DEPT_ID.NEXTVAL, 'Operations & Scheduling', NULL);
INSERT INTO Department (Dept_ID, Dept_Name, Manager_ID)
VALUES (SEQ_DEPT_ID.NEXTVAL, 'Rolling Stock & Mechanical', NULL);
INSERT INTO Department (Dept_ID, Dept_Name, Manager_ID)
VALUES (SEQ_DEPT_ID.NEXTVAL, 'Passenger Services & Ticketing', NULL);

-- Insert Employees
INSERT INTO Employee (Emp_ID, Name, Phone, Station_ID, Dept_ID)
VALUES (SEQ_EMP_ID.NEXTVAL, 'Aarav Sharma', '+91-9876543210', 201, 10);
INSERT INTO Employee (Emp_ID, Name, Phone, Station_ID, Dept_ID)
VALUES (SEQ_EMP_ID.NEXTVAL, 'Priya Nair', '+91-9823456789', 202, 20);
INSERT INTO Employee (Emp_ID, Name, Phone, Station_ID, Dept_ID)
VALUES (SEQ_EMP_ID.NEXTVAL, 'Vikram Malhotra', '+91-9811223344', 201, 30);

-- Update Department Managers
UPDATE Department SET Manager_ID = 4001 WHERE Dept_ID = 10;
UPDATE Department SET Manager_ID = 4002 WHERE Dept_ID = 20;
UPDATE Department SET Manager_ID = 4003 WHERE Dept_ID = 30;

-- Insert Promo Codes
INSERT INTO Promotion_Offer (Promo_Code, Discount_Percentage, Valid_From, Valid_To, Description)
VALUES ('FESTIVE25', 25.00, TO_DATE('2026-10-01', 'YYYY-MM-DD'), TO_DATE('2026-12-31', 'YYYY-MM-DD'), 'Diwali & New Year Special 25% Off');
INSERT INTO Promotion_Offer (Promo_Code, Discount_Percentage, Valid_From, Valid_To, Description)
VALUES ('STUDENT15', 15.00, TO_DATE('2026-01-01', 'YYYY-MM-DD'), TO_DATE('2026-12-31', 'YYYY-MM-DD'), 'All-Season University Student Discount');
INSERT INTO Promotion_Offer (Promo_Code, Discount_Percentage, Valid_From, Valid_To, Description)
VALUES ('CYBER50', 50.00, TO_DATE('2026-11-20', 'YYYY-MM-DD'), TO_DATE('2026-11-30', 'YYYY-MM-DD'), 'Cyber Rail Flash Sale');

COMMIT;

PROMPT ============================================================================
PROMPT 6. SCHEMA VERIFICATION & SUMMARY REPORT
PROMPT ============================================================================

SELECT table_name, num_rows 
FROM user_tables 
ORDER BY table_name;

SELECT sequence_name, last_number 
FROM user_sequences 
ORDER BY sequence_name;

PROMPT Phase 1 Database Schema and Seed Data installation complete.
PROMPT Ready for Phase 2: PL/SQL Logic.
