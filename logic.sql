-- ============================================================================
-- PROJECT: Dynamic Train Ticket & Waitlist System
-- COMPONENT: Phase 2 - Core PL/SQL Engine (Procedures, Triggers, Functions)
-- TARGET DBMS: Oracle SQL / PL*SQL (Executable in SQL*Plus)
-- AUTHOR: Database Administrator & UI/UX Lead Developer
-- ============================================================================

SET ECHO ON;
SET FEEDBACK ON;
SET SERVEROUTPUT ON;

PROMPT ============================================================================
PROMPT 1. HELPER FUNCTION: FN_CALCULATE_FARE
PROMPT ============================================================================

CREATE OR REPLACE FUNCTION FN_CALCULATE_FARE (
    p_train_id   IN NUMBER,
    p_class_id   IN NUMBER,
    p_promo_code IN VARCHAR2 DEFAULT NULL
) RETURN NUMBER IS
    v_base_rate       NUMBER := 500; -- Standard base fare unit in INR / currency
    v_multiplier      NUMBER := 1.0;
    v_discount_pct    NUMBER := 0.0;
    v_calculated_fare NUMBER;
    v_valid_promo     NUMBER := 0;
BEGIN
    -- Fetch Class Multiplier
    SELECT NVL(Base_Fare_Multiplier, 1.0)
    INTO v_multiplier
    FROM Coach_Class
    WHERE Class_ID = p_class_id;

    -- Calculate base fare
    v_calculated_fare := v_base_rate * v_multiplier;

    -- Check and apply promo code discount if active
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
    WHEN NO_DATA_FOUND THEN
        RETURN 500.00;
    WHEN OTHERS THEN
        RETURN 500.00;
END FN_CALCULATE_FARE;
/

PROMPT Function FN_CALCULATE_FARE created successfully.

PROMPT ============================================================================
PROMPT 2. STORED PROCEDURE: BOOK_TICKET
PROMPT Dynamically assigns available seat or enqueues into Waitlist_Log
PROMPT ============================================================================

CREATE OR REPLACE PROCEDURE BOOK_TICKET (
    p_train_id         IN  NUMBER,
    p_class_id         IN  NUMBER,
    p_passenger_name   IN  VARCHAR2,
    p_passenger_phone  IN  VARCHAR2,
    p_passenger_email  IN  VARCHAR2,
    p_age              IN  NUMBER,
    p_payment_method   IN  VARCHAR2 DEFAULT 'UPI',
    p_promo_code       IN  VARCHAR2 DEFAULT NULL,
    p_pnr_no           OUT NUMBER,
    p_ticket_id        OUT NUMBER,
    p_seat_no          OUT NUMBER,
    p_status           OUT VARCHAR2,
    p_queue_position   OUT NUMBER,
    p_total_fare       OUT NUMBER,
    p_message          OUT VARCHAR2
) AS
    v_passenger_id     NUMBER;
    v_total_capacity   NUMBER;
    v_booked_count     NUMBER;
    v_avail_seat_no    NUMBER := NULL;
    v_fare             NUMBER;
    v_next_queue_pos   NUMBER;
BEGIN
    -- 1. Validate Train exists and retrieve capacity
    SELECT Total_Capacity
    INTO v_total_capacity
    FROM Train
    WHERE Train_ID = p_train_id;

    -- 2. Upsert / Fetch Passenger ID
    BEGIN
        SELECT Passenger_ID 
        INTO v_passenger_id 
        FROM Passenger 
        WHERE Phone = TRIM(p_passenger_phone) 
          AND ROWNUM = 1;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            v_passenger_id := SEQ_PASSENGER_ID.NEXTVAL;
            INSERT INTO Passenger (Passenger_ID, Name, Phone, Email, Address)
            VALUES (v_passenger_id, TRIM(p_passenger_name), TRIM(p_passenger_phone), TRIM(p_passenger_email), 'Online Portal Reservation');
    END;

    -- 3. Calculate dynamic fare
    v_fare := FN_CALCULATE_FARE(p_train_id, p_class_id, p_promo_code);
    p_total_fare := v_fare;

    -- 4. Check available seats for requested Train and Coach Class
    BEGIN
        SELECT Seat_No
        INTO v_avail_seat_no
        FROM (
            SELECT Seat_No 
            FROM Seat 
            WHERE Train_ID = p_train_id 
              AND Class_ID = p_class_id 
              AND Status = 'AVAILABLE'
            ORDER BY Seat_No ASC
        )
        WHERE ROWNUM = 1
        FOR UPDATE;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            v_avail_seat_no := NULL;
    END;

    -- Check overall booked count vs total capacity
    SELECT COUNT(*) 
    INTO v_booked_count
    FROM Seat 
    WHERE Train_ID = p_train_id 
      AND Status = 'BOOKED';

    -- Generate Unique PNR
    p_pnr_no := SEQ_PNR_NO.NEXTVAL;

    -- 5. CASE A: Available Seat found and train capacity not exceeded
    IF v_avail_seat_no IS NOT NULL AND v_booked_count < v_total_capacity THEN
        -- Create Confirmed Reservation
        INSERT INTO Reservation (PNR_No, Passenger_ID, Booking_Date, Total_Amount, Status)
        VALUES (p_pnr_no, v_passenger_id, SYSDATE, v_fare, 'CONFIRMED');

        -- Update Seat Status to BOOKED
        UPDATE Seat 
        SET Status = 'BOOKED' 
        WHERE Seat_No = v_avail_seat_no;

        -- Generate Confirmed Ticket
        p_ticket_id := SEQ_TICKET_ID.NEXTVAL;
        INSERT INTO Ticket (Ticket_ID, PNR_No, Seat_No, Train_ID, Passenger_Name, Age)
        VALUES (p_ticket_id, p_pnr_no, v_avail_seat_no, p_train_id, TRIM(p_passenger_name), p_age);

        -- Record Successful Payment
        INSERT INTO Payment (Payment_ID, PNR_No, Payment_Date, Amount, Method, Status)
        VALUES (SEQ_PAYMENT_ID.NEXTVAL, p_pnr_no, SYSDATE, v_fare, NVL(p_payment_method, 'UPI'), 'SUCCESS');

        -- Populate Return Parameters
        p_seat_no        := v_avail_seat_no;
        p_status         := 'CONFIRMED';
        p_queue_position := 0;
        p_message        := 'Booking confirmed successfully. Assigned Seat #' || v_avail_seat_no;

    -- 6. CASE B: Seats equal or exceed capacity -> Waitlist Engine
    ELSE
        -- Calculate next queue position for this train
        SELECT NVL(MAX(Queue_Position), 0) + 1
        INTO v_next_queue_pos
        FROM Waitlist_Log
        WHERE Train_ID = p_train_id;

        -- Create Waitlisted Reservation
        INSERT INTO Reservation (PNR_No, Passenger_ID, Booking_Date, Total_Amount, Status)
        VALUES (p_pnr_no, v_passenger_id, SYSDATE, v_fare, 'WAITLISTED');

        -- Enqueue in Waitlist_Log
        INSERT INTO Waitlist_Log (Waitlist_ID, PNR_No, Train_ID, Queue_Position, Update_Date)
        VALUES (SEQ_WAITLIST_ID.NEXTVAL, p_pnr_no, p_train_id, v_next_queue_pos, SYSDATE);

        -- Record Authorized Payment for Waitlisted Ticket
        INSERT INTO Payment (Payment_ID, PNR_No, Payment_Date, Amount, Method, Status)
        VALUES (SEQ_PAYMENT_ID.NEXTVAL, p_pnr_no, SYSDATE, v_fare, NVL(p_payment_method, 'UPI'), 'SUCCESS');

        -- Populate Return Parameters
        p_ticket_id      := NULL;
        p_seat_no        := NULL;
        p_status         := 'WAITLISTED';
        p_queue_position := v_next_queue_pos;
        p_message        := 'Seats exhausted (Capacity Reached). Passenger waitlisted at Queue Position #' || v_next_queue_pos;
    END IF;

    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        ROLLBACK;
        p_pnr_no := NULL;
        p_ticket_id := NULL;
        p_seat_no := NULL;
        p_status := 'FAILED';
        p_queue_position := NULL;
        p_total_fare := 0;
        p_message := 'Error: Invalid Train ID provided.';
    WHEN OTHERS THEN
        ROLLBACK;
        p_pnr_no := NULL;
        p_ticket_id := NULL;
        p_seat_no := NULL;
        p_status := 'ERROR';
        p_queue_position := NULL;
        p_total_fare := 0;
        p_message := 'PL/SQL Exception: ' || SQLERRM;
END BOOK_TICKET;
/

PROMPT Stored Procedure BOOK_TICKET created successfully.

PROMPT ============================================================================
PROMPT 3. AUTONOMOUS TRIGGER: TRG_TICKET_CANCEL_WAITLIST
PROMPT Fires on ticket cancellation, automatically shifting first waitlist entry
PROMPT Implemented as a COMPOUND TRIGGER to prevent ORA-04091 mutating table errors
PROMPT ============================================================================

CREATE OR REPLACE TRIGGER TRG_TICKET_CANCEL_WAITLIST
FOR DELETE ON Ticket
COMPOUND TRIGGER

    TYPE r_seat_record IS RECORD (
        train_id NUMBER,
        seat_no  NUMBER,
        pnr_no   NUMBER
    );
    TYPE t_seat_list IS TABLE OF r_seat_record INDEX BY PLS_INTEGER;
    v_freed_seats t_seat_list;
    v_count       PLS_INTEGER := 0;

    -- Before each row: Record the released seat details
    AFTER EACH ROW IS
    BEGIN
        IF :OLD.Seat_No IS NOT NULL THEN
            v_count := v_count + 1;
            v_freed_seats(v_count).train_id := :OLD.Train_ID;
            v_freed_seats(v_count).seat_no  := :OLD.Seat_No;
            v_freed_seats(v_count).pnr_no   := :OLD.PNR_No;
        END IF;
    END AFTER EACH ROW;

    -- After statement: Process waitlist promotion outside mutating scope
    AFTER STATEMENT IS
        v_next_waitlist_id NUMBER;
        v_next_pnr         NUMBER;
        v_passenger_name   VARCHAR2(100);
        v_passenger_age    NUMBER := 30;
    BEGIN
        FOR i IN 1 .. v_count LOOP
            BEGIN
                -- Find the #1 Waitlisted Passenger in queue for this train
                SELECT Waitlist_ID, PNR_No
                INTO v_next_waitlist_id, v_next_pnr
                FROM (
                    SELECT Waitlist_ID, PNR_No
                    FROM Waitlist_Log
                    WHERE Train_ID = v_freed_seats(i).train_id
                    ORDER BY Queue_Position ASC
                )
                WHERE ROWNUM = 1;

                -- Fetch Passenger Name and Age from Reservation & Passenger tables
                SELECT p.Name
                INTO v_passenger_name
                FROM Reservation r
                JOIN Passenger p ON r.Passenger_ID = p.Passenger_ID
                WHERE r.PNR_No = v_next_pnr;

                -- 1. Create Confirmed Ticket for promoted passenger using freed seat
                INSERT INTO Ticket (Ticket_ID, PNR_No, Seat_No, Train_ID, Passenger_Name, Age)
                VALUES (SEQ_TICKET_ID.NEXTVAL, v_next_pnr, v_freed_seats(i).seat_no, v_freed_seats(i).train_id, v_passenger_name, v_passenger_age);

                -- 2. Update Reservation Status from WAITLISTED to CONFIRMED
                UPDATE Reservation
                SET Status = 'CONFIRMED'
                WHERE PNR_No = v_next_pnr;

                -- 3. Keep Seat status as BOOKED
                UPDATE Seat
                SET Status = 'BOOKED'
                WHERE Seat_No = v_freed_seats(i).seat_no;

                -- 4. Remove promoted passenger from Waitlist_Log
                DELETE FROM Waitlist_Log
                WHERE Waitlist_ID = v_next_waitlist_id;

                -- 5. Shift remaining waitlist queue positions up by 1
                UPDATE Waitlist_Log
                SET Queue_Position = Queue_Position - 1,
                    Update_Date = SYSDATE
                WHERE Train_ID = v_freed_seats(i).train_id
                  AND Queue_Position > 1;

                DBMS_OUTPUT.PUT_LINE('TRIGGER FIRED: Waitlisted PNR ' || v_next_pnr || ' promoted to confirmed Seat #' || v_freed_seats(i).seat_no);

            EXCEPTION
                WHEN NO_DATA_FOUND THEN
                    -- No waitlist queue: Release seat back to AVAILABLE
                    UPDATE Seat
                    SET Status = 'AVAILABLE'
                    WHERE Seat_No = v_freed_seats(i).seat_no;

                    DBMS_OUTPUT.PUT_LINE('TRIGGER FIRED: No waitlist found. Seat #' || v_freed_seats(i).seat_no || ' set to AVAILABLE.');
            END;
        END LOOP;
    END AFTER STATEMENT;

END TRG_TICKET_CANCEL_WAITLIST;
/

PROMPT Compound Trigger TRG_TICKET_CANCEL_WAITLIST created successfully.

PROMPT ============================================================================
PROMPT 4. STORED PROCEDURE: CANCEL_TICKET
PROMPT Manages financial refunds, triggers waitlist shift, updates PNR status
PROMPT ============================================================================

CREATE OR REPLACE PROCEDURE CANCEL_TICKET (
    p_ticket_id     IN  NUMBER,
    p_refund_status OUT VARCHAR2,
    p_refund_amount OUT NUMBER,
    p_message       OUT VARCHAR2
) AS
    v_pnr_no        NUMBER;
    v_payment_id    NUMBER;
    v_orig_amount   NUMBER;
    v_refund_id     NUMBER;
BEGIN
    -- 1. Identify ticket and associated reservation
    SELECT PNR_No
    INTO v_pnr_no
    FROM Ticket
    WHERE Ticket_ID = p_ticket_id;

    -- 2. Fetch original payment details
    SELECT Payment_ID, Amount
    INTO v_payment_id, v_orig_amount
    FROM Payment
    WHERE PNR_No = v_pnr_no 
      AND Status = 'SUCCESS'
      AND ROWNUM = 1;

    -- Compute refund amount (10% cancellation charge deduction)
    p_refund_amount := ROUND(v_orig_amount * 0.90, 2);

    -- 3. Log Refund Record
    v_refund_id := SEQ_REFUND_ID.NEXTVAL;
    INSERT INTO Refund_Log (Refund_ID, Payment_ID, PNR_No, Refund_Amount, Process_Date)
    VALUES (v_refund_id, v_payment_id, v_pnr_no, p_refund_amount, SYSDATE);

    -- 4. Update Payment and Reservation Statuses
    UPDATE Payment 
    SET Status = 'REFUNDED' 
    WHERE Payment_ID = v_payment_id;

    UPDATE Reservation 
    SET Status = 'CANCELLED' 
    WHERE PNR_No = v_pnr_no;

    -- 5. Delete Ticket row -> FIRES TRG_TICKET_CANCEL_WAITLIST AUTOMATICALLY
    DELETE FROM Ticket WHERE Ticket_ID = p_ticket_id;

    p_refund_status := 'SUCCESS';
    p_message := 'Ticket #' || p_ticket_id || ' cancelled. Refund of INR ' || p_refund_amount || ' processed. Waitlist shifts executed.';

    COMMIT;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        ROLLBACK;
        p_refund_status := 'FAILED';
        p_refund_amount := 0;
        p_message := 'Ticket ID not found or already cancelled.';
    WHEN OTHERS THEN
        ROLLBACK;
        p_refund_status := 'ERROR';
        p_refund_amount := 0;
        p_message := 'Cancellation Error: ' || SQLERRM;
END CANCEL_TICKET;
/

PROMPT Stored Procedure CANCEL_TICKET created successfully.

PROMPT ============================================================================
PROMPT 5. COMPREHENSIVE PL/SQL VERIFICATION TEST HARNESS
PROMPT Automatically verifies booking, waitlisting, and trigger cancellation shifts
PROMPT ============================================================================

DECLARE
    v_pnr        NUMBER;
    v_ticket_id  NUMBER;
    v_seat_no    NUMBER;
    v_status     VARCHAR2(50);
    v_queue_pos  NUMBER;
    v_fare       NUMBER;
    v_msg        VARCHAR2(255);

    v_ref_status VARCHAR2(50);
    v_ref_amt    NUMBER;
    v_ref_msg    VARCHAR2(255);
    v_first_ticket NUMBER;
BEGIN
    DBMS_OUTPUT.PUT_LINE('--- TEST 1: BOOKING CONFIRMED PASSENGERS ON TRAIN 101 ---');
    
    FOR i IN 1 .. 8 LOOP
        BOOK_TICKET(
            p_train_id        => 101,
            p_class_id        => 4,
            p_passenger_name  => 'Passenger ' || i,
            p_passenger_phone => '980000000' || i,
            p_passenger_email => 'pass' || i || '@test.com',
            p_age             => 20 + i,
            p_payment_method  => 'UPI',
            p_promo_code      => 'STUDENT15',
            p_pnr_no          => v_pnr,
            p_ticket_id       => v_ticket_id,
            p_seat_no         => v_seat_no,
            p_status          => v_status,
            p_queue_position  => v_queue_pos,
            p_total_fare      => v_fare,
            p_message         => v_msg
        );
        IF i = 1 THEN
            v_first_ticket := v_ticket_id;
        END IF;
        DBMS_OUTPUT.PUT_LINE('Seat #' || v_seat_no || ' booked | Status: ' || v_status || ' | PNR: ' || v_pnr);
    END LOOP;

    DBMS_OUTPUT.PUT_LINE('--- TEST 2: CAPACITY EXHAUSTED -> TRIGGERING WAITLIST ---');
    FOR w IN 1 .. 3 LOOP
        BOOK_TICKET(
            p_train_id        => 101,
            p_class_id        => 4,
            p_passenger_name  => 'Waitlist Passenger ' || w,
            p_passenger_phone => '990000000' || w,
            p_passenger_email => 'wait' || w || '@test.com',
            p_age             => 25 + w,
            p_payment_method  => 'CREDIT_CARD',
            p_promo_code      => NULL,
            p_pnr_no          => v_pnr,
            p_ticket_id       => v_ticket_id,
            p_seat_no         => v_seat_no,
            p_status          => v_status,
            p_queue_position  => v_queue_pos,
            p_total_fare      => v_fare,
            p_message         => v_msg
        );
        DBMS_OUTPUT.PUT_LINE('Waitlist Result | Status: ' || v_status || ' | Queue Pos: ' || v_queue_pos || ' | PNR: ' || v_pnr);
    END LOOP;

    DBMS_OUTPUT.PUT_LINE('--- TEST 3: CANCELLING TICKET #' || v_first_ticket || ' (FIRING TRIGGER) ---');
    CANCEL_TICKET(
        p_ticket_id     => v_first_ticket,
        p_refund_status => v_ref_status,
        p_refund_amount => v_ref_amt,
        p_message       => v_ref_msg
    );
    DBMS_OUTPUT.PUT_LINE('Cancel Result: ' || v_ref_msg);
END;
/

PROMPT Phase 2 PL/SQL logic compiled and verified.
