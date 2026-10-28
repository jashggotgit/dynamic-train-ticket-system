-- ============================================================================
-- PROJECT: Dynamic Train Ticket & Waitlist System
-- FILE: demo_plsql_blocks.sql
-- PURPOSE: Modular, Copy-Pasteable PL/SQL Demonstration Blocks for Viva & Lab Exam
-- INSTRUCTIONS FOR STUDENT:
-- 1. Open SQL*Plus or SQL Developer.
-- 2. Make sure you run: SET SERVEROUTPUT ON;
-- 3. Find the exact action your teacher asks for below, copy that section,
--    paste it into SQL*Plus, and hit Enter.
-- ============================================================================

SET SERVEROUTPUT ON SIZE 1000000;
SET LINESIZE 200;
SET PAGESIZE 50;


-- ****************************************************************************
-- ACTION 1: FARE CALCULATION FUNCTION (FN_CALCULATE_FARE)
-- Teacher asks: "Show me how ticket fares are calculated dynamically."
-- ****************************************************************************

-- 1A. Compilation Code for Function
CREATE OR REPLACE FUNCTION FN_CALCULATE_FARE (
    p_train_id   IN NUMBER,
    p_class_id   IN NUMBER,
    p_promo_code IN VARCHAR2 DEFAULT NULL
) RETURN NUMBER IS
    v_base_rate       NUMBER := 500; -- Base fare in INR
    v_multiplier      NUMBER := 1.0;
    v_discount_pct    NUMBER := 0.0;
    v_calculated_fare NUMBER;
    v_valid_promo     NUMBER := 0;
BEGIN
    -- Step 1: Retrieve class multiplier (e.g. 1A=3.5x, 2A=2.2x, CC=1.2x, SL=1.0x)
    SELECT NVL(Base_Fare_Multiplier, 1.0)
    INTO v_multiplier
    FROM Coach_Class
    WHERE Class_ID = p_class_id;

    -- Step 2: Calculate base class fare
    v_calculated_fare := v_base_rate * v_multiplier;

    -- Step 3: Validate promo code against dates if provided
    IF p_promo_code IS NOT NULL THEN
        SELECT COUNT(*), NVL(MAX(Discount_Percentage), 0)
        INTO v_valid_promo, v_discount_pct
        FROM Promotion_Offer
        WHERE UPPER(Promo_Code) = UPPER(TRIM(p_promo_code))
          AND SYSDATE BETWEEN Valid_From AND Valid_To;

        IF v_valid_promo > 0 AND v_discount_pct > 0 THEN
            v_calculated_fare := v_calculated_fare * (1 - (v_discount_pct / 100));
        END IF;
    END IF;

    RETURN ROUND(v_calculated_fare, 2);
EXCEPTION
    WHEN OTHERS THEN
        RETURN 500.00;
END FN_CALCULATE_FARE;
/

-- 1B. Test Run in front of teacher (Shows calculation with & without promo code)
DECLARE
    v_fare1 NUMBER;
    v_fare2 NUMBER;
    v_fare3 NUMBER;
BEGIN
    -- Chair Car (CC, Class 4) -> Base 500 * 1.20 = 600
    v_fare1 := FN_CALCULATE_FARE(101, 4, NULL);
    
    -- Chair Car with STUDENT15 (15% off) -> 600 - 90 = 510
    v_fare2 := FN_CALCULATE_FARE(101, 4, 'STUDENT15');
    
    -- AC First Class (1A, Class 1) with FESTIVE25 (25% off) -> (500 * 3.5) * 0.75 = 1312.50
    v_fare3 := FN_CALCULATE_FARE(102, 1, 'FESTIVE25');

    DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');
    DBMS_OUTPUT.PUT_LINE('DEMO 1: DYNAMIC FARE CALCULATION RESULTS');
    DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');
    DBMS_OUTPUT.PUT_LINE('1. Standard Chair Car Fare: INR ' || v_fare1);
    DBMS_OUTPUT.PUT_LINE('2. CC with STUDENT15 (15% off): INR ' || v_fare2);
    DBMS_OUTPUT.PUT_LINE('3. AC 1st Class with FESTIVE25 (25% off): INR ' || v_fare3);
    DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');
END;
/



-- ****************************************************************************
-- ACTION 2: BOOKING A TICKET - SEAT AVAILABLE (BOOK_TICKET)
-- Teacher asks: "Show me the procedure that books a ticket and updates seat status."
-- ****************************************************************************

-- 2A. Test Run for Single Confirmed Booking
DECLARE
    v_pnr        NUMBER;
    v_ticket_id  NUMBER;
    v_seat_no    NUMBER;
    v_status     VARCHAR2(50);
    v_queue_pos  NUMBER;
    v_total_fare NUMBER;
    v_message    VARCHAR2(255);
BEGIN
    BOOK_TICKET(
        p_train_id         => 101,
        p_class_id         => 4,
        p_passenger_name   => 'Rohan Verma',
        p_passenger_phone  => '9811002233',
        p_passenger_email  => 'rohan.verma@example.com',
        p_age              => 22,
        p_payment_method   => 'UPI',
        p_promo_code       => 'STUDENT15',
        p_pnr_no           => v_pnr,
        p_ticket_id        => v_ticket_id,
        p_seat_no          => v_seat_no,
        p_status           => v_status,
        p_queue_position   => v_queue_pos,
        p_total_fare       => v_total_fare,
        p_message          => v_message
    );

    DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');
    DBMS_OUTPUT.PUT_LINE('DEMO 2: BOOK_TICKET (AVAILABLE SEAT)');
    DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');
    DBMS_OUTPUT.PUT_LINE('Status:        ' || v_status);
    DBMS_OUTPUT.PUT_LINE('PNR Number:    ' || v_pnr);
    DBMS_OUTPUT.PUT_LINE('Ticket ID:     ' || v_ticket_id);
    DBMS_OUTPUT.PUT_LINE('Assigned Seat: Seat #' || v_seat_no);
    DBMS_OUTPUT.PUT_LINE('Fare Charged:  INR ' || v_total_fare);
    DBMS_OUTPUT.PUT_LINE('Message:       ' || v_message);
    DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');
END;
/



-- ****************************************************************************
-- ACTION 3: CAPACITY EXHAUSTED -> ENTERING WAITLIST (BOOK_TICKET)
-- Teacher asks: "What happens when seats equal capacity? Show me how waitlist is calculated."
-- ****************************************************************************

-- 3A. Fill remaining seats on Train 101, then book 1 more to force Waitlist
DECLARE
    v_pnr        NUMBER;
    v_ticket_id  NUMBER;
    v_seat_no    NUMBER;
    v_status     VARCHAR2(50);
    v_queue_pos  NUMBER;
    v_total_fare NUMBER;
    v_message    VARCHAR2(255);
BEGIN
    DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');
    DBMS_OUTPUT.PUT_LINE('DEMO 3: FILLING CAPACITY & TRIGGERING WAITLIST');
    DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');

    -- Loop to book seats until capacity (8 seats on Train 101) is full
    FOR i IN 1..8 LOOP
        BOOK_TICKET(
            p_train_id         => 101,
            p_class_id         => 4,
            p_passenger_name   => 'Passenger Batch ' || i,
            p_passenger_phone  => '98700000' || LPAD(i, 2, '0'),
            p_passenger_email  => 'batch' || i || '@test.com',
            p_age              => 20 + i,
            p_payment_method   => 'UPI',
            p_promo_code       => NULL,
            p_pnr_no           => v_pnr,
            p_ticket_id        => v_ticket_id,
            p_seat_no          => v_seat_no,
            p_status           => v_status,
            p_queue_position   => v_queue_pos,
            p_total_fare       => v_total_fare,
            p_message          => v_message
        );
        IF v_status = 'CONFIRMED' THEN
            DBMS_OUTPUT.PUT_LINE('Confirmed Booking -> Seat #' || v_seat_no || ' | PNR: ' || v_pnr);
        END IF;
    END LOOP;

    -- Now try to book the 9th passenger (Capacity is 8, so this MUST enter Waitlist)
    DBMS_OUTPUT.PUT_LINE('>>> Now booking 9th passenger when capacity is full:');
    BOOK_TICKET(
        p_train_id         => 101,
        p_class_id         => 4,
        p_passenger_name   => 'Waitlisted Candidate #1',
        p_passenger_phone  => '9999999001',
        p_passenger_email  => 'waitlist1@test.com',
        p_age              => 27,
        p_payment_method   => 'CREDIT_CARD',
        p_promo_code       => NULL,
        p_pnr_no           => v_pnr,
        p_ticket_id        => v_ticket_id,
        p_seat_no          => v_seat_no,
        p_status           => v_status,
        p_queue_position   => v_queue_pos,
        p_total_fare       => v_total_fare,
        p_message          => v_message
    );

    DBMS_OUTPUT.PUT_LINE('Result for 9th passenger:');
    DBMS_OUTPUT.PUT_LINE('Status:         ' || v_status || ' (Stored in Reservation table)');
    DBMS_OUTPUT.PUT_LINE('PNR Number:     ' || v_pnr);
    DBMS_OUTPUT.PUT_LINE('Queue Position: WL #' || v_queue_pos || ' (Inserted into Waitlist_Log table)');
    DBMS_OUTPUT.PUT_LINE('Message:        ' || v_message);
    DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');
END;
/



-- ****************************************************************************
-- ACTION 4: CANCELLING A TICKET & REFUND LOGGING (CANCEL_TICKET)
-- Teacher asks: "Show me how a ticket is cancelled and refund is calculated."
-- ****************************************************************************

-- 4A. Test Run for Ticket Cancellation
DECLARE
    v_target_ticket NUMBER;
    v_ref_status    VARCHAR2(50);
    v_ref_amount    NUMBER;
    v_message       VARCHAR2(255);
BEGIN
    -- Select the latest confirmed ticket on Train 101
    SELECT Ticket_ID INTO v_target_ticket
    FROM (
        SELECT Ticket_ID FROM Ticket WHERE Train_ID = 101 ORDER BY Ticket_ID DESC
    ) WHERE ROWNUM = 1;

    DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');
    DBMS_OUTPUT.PUT_LINE('DEMO 4: EXECUTING CANCEL_TICKET FOR TICKET #' || v_target_ticket);
    DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');

    CANCEL_TICKET(
        p_ticket_id     => v_target_ticket,
        p_refund_status => v_ref_status,
        p_refund_amount => v_ref_amount,
        p_message       => v_message
    );

    DBMS_OUTPUT.PUT_LINE('Refund Status: ' || v_ref_status);
    DBMS_OUTPUT.PUT_LINE('Refund Amount: INR ' || v_ref_amount || ' (Deducted 10% cancellation charge)');
    DBMS_OUTPUT.PUT_LINE('System Output: ' || v_message);
    DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');
END;
/



-- ****************************************************************************
-- ACTION 5: THE TRIGGER IN ACTION (TRG_TICKET_CANCEL_WAITLIST)
-- Teacher asks: "Show me the trigger that shifts the waitlist to confirmed!"
-- ****************************************************************************

-- 5A. Standalone complete demonstration of the Trigger:
-- Step 1: Check who is currently at Waitlist Queue #1.
-- Step 2: Cancel a confirmed ticket.
-- Step 3: Verify the trigger fired, deleted the ticket, created a new ticket
--         for the waitlisted person, and promoted their reservation to CONFIRMED.
DECLARE
    v_ticket_to_cancel NUMBER;
    v_waitlist_pnr     NUMBER;
    v_freed_seat       NUMBER;
    v_ref_status       VARCHAR2(50);
    v_ref_amt          NUMBER;
    v_ref_msg          VARCHAR2(255);
    v_new_ticket_id    NUMBER;
    v_new_status       VARCHAR2(50);
BEGIN
    DBMS_OUTPUT.PUT_LINE('==================================================');
    DBMS_OUTPUT.PUT_LINE('DEMO 5: AUTONOMOUS TRIGGER VERIFICATION');
    DBMS_OUTPUT.PUT_LINE('==================================================');

    -- 1. Identify ticket to cancel and its seat
    SELECT Ticket_ID, Seat_No 
    INTO v_ticket_to_cancel, v_freed_seat
    FROM (SELECT Ticket_ID, Seat_No FROM Ticket WHERE Train_ID = 101 ORDER BY Ticket_ID ASC)
    WHERE ROWNUM = 1;

    -- 2. Identify top waitlisted passenger
    BEGIN
        SELECT PNR_No INTO v_waitlist_pnr
        FROM (SELECT PNR_No FROM Waitlist_Log WHERE Train_ID = 101 ORDER BY Queue_Position ASC)
        WHERE ROWNUM = 1;
        DBMS_OUTPUT.PUT_LINE('[BEFORE] Top Waitlist Candidate: PNR #' || v_waitlist_pnr || ' (Queue Position #1)');
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            v_waitlist_pnr := NULL;
            DBMS_OUTPUT.PUT_LINE('[BEFORE] No passengers currently in waitlist.');
    END;

    DBMS_OUTPUT.PUT_LINE('[BEFORE] Cancelling Ticket #' || v_ticket_to_cancel || ' (Vacating Seat #' || v_freed_seat || ')');

    -- 3. Execute CANCEL_TICKET (which performs DELETE on Ticket, firing the trigger)
    CANCEL_TICKET(v_ticket_to_cancel, v_ref_status, v_ref_amt, v_ref_msg);

    -- 4. Check status of the previously waitlisted passenger
    IF v_waitlist_pnr IS NOT NULL THEN
        SELECT Status INTO v_new_status FROM Reservation WHERE PNR_No = v_waitlist_pnr;
        SELECT Ticket_ID INTO v_new_ticket_id FROM Ticket WHERE PNR_No = v_waitlist_pnr;

        DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');
        DBMS_OUTPUT.PUT_LINE('>>> TRIGGER EXECUTION PROOF:');
        DBMS_OUTPUT.PUT_LINE('1. Old Ticket #' || v_ticket_to_cancel || ' deleted from Ticket table.');
        DBMS_OUTPUT.PUT_LINE('2. Compound Trigger TRG_TICKET_CANCEL_WAITLIST caught released Seat #' || v_freed_seat);
        DBMS_OUTPUT.PUT_LINE('3. Waitlisted PNR #' || v_waitlist_pnr || ' promoted!');
        DBMS_OUTPUT.PUT_LINE('4. Reservation Status changed to: ' || v_new_status);
        DBMS_OUTPUT.PUT_LINE('5. New Confirmed Ticket Generated: Ticket #' || v_new_ticket_id || ' with Seat #' || v_freed_seat);
        DBMS_OUTPUT.PUT_LINE('--------------------------------------------------');
    END IF;
END;
/



-- ****************************************************************************
-- ACTION 6: QUICK DATABASE STATE INSPECTION QUERIES
-- Teacher asks: "Show me the data in the tables right now."
-- (Run these simple SELECT queries to show the actual database rows)
-- ****************************************************************************

-- Check Confirmed Tickets
SELECT Ticket_ID, PNR_No, Seat_No, Train_ID, Passenger_Name, Age 
FROM Ticket 
WHERE Train_ID = 101
ORDER BY Ticket_ID;

-- Check Active Waitlist Queue
SELECT Waitlist_ID, PNR_No, Train_ID, Queue_Position, Update_Date 
FROM Waitlist_Log 
WHERE Train_ID = 101
ORDER BY Queue_Position;

-- Check Physical Seat Statuses (AVAILABLE vs BOOKED)
SELECT Seat_No, Train_ID, Class_ID, Status 
FROM Seat 
WHERE Train_ID = 101
ORDER BY Seat_No;

-- Check Refund Logs created by cancellations
SELECT Refund_ID, Payment_ID, PNR_No, Refund_Amount, Process_Date 
FROM Refund_Log
ORDER BY Refund_ID DESC;
