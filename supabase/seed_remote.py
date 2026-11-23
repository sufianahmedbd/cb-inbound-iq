#!/usr/bin/env python3
"""
Carrybee InboundIQ — Master Database Seed Script (PRD v3.2 Final)
Seeds:
- 64 Root Causes (RC-01..RC-64 -> 12 Categories -> 5 Accountability Buckets)
- 49 Authoritative Taxonomy v4 Contact Reasons (3_Matrix)
- Verbatim Global Category > Sub-Category Catalog (6_Global_Ref)
- CarryBee Bangladesh Hub Master (ISD / OSD / CTG)
- Live 5-Column Merchant KAM Master + Business Fallback + Parcel Cache
- Churn Score Config (0-100 Rule Weights) + 8-Spreadsheet Registry
- Seeded Operational Call Logs, Track A / Track B Tickets, Overflow Watch & Audit Logs
"""
import os, json, urllib.request, urllib.error, datetime

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cvgrryozzonwfnwpjxuf.supabase.co")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation,resolution=merge-duplicates",
}

def upsert(table, rows, conflict=None):
    inserted = []
    path = f"/rest/v1/{table}" + (f"?on_conflict={conflict}" if conflict else "")
    for row in rows:
        clean_row = {k: v for k, v in row.items() if v is not None}
        r = urllib.request.Request(SUPABASE_URL + path, data=json.dumps(clean_row).encode("utf-8"), headers=HEADERS, method="POST")
        try:
            with urllib.request.urlopen(r, timeout=30) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                inserted.extend(res if isinstance(res, list) else [res])
        except urllib.error.HTTPError as e:
            print(f"ERROR {table} ({e.code}) on row {clean_row.get('ticket_id') or clean_row.get('call_ref')}: {e.read().decode('utf-8')[:500]}")
            raise
    print(f"Upserted {table}: {len(inserted)} rows")
    return inserted

r = urllib.request.Request(SUPABASE_URL + "/rest/v1/profiles?select=id,email,username,role,team_id", headers=HEADERS)
profiles = json.loads(urllib.request.urlopen(r).read().decode("utf-8"))
prof_by_user = {p["username"]: p for p in profiles}
print("Profiles loaded:", len(prof_by_user))

RC_RAW = [
    ("RC-01", "Pickup Operations", "Rider shortage in pickup zone", "Carrybee - Internal", "Operations (Pickup Inbound)"),
    ("RC-02", "Pickup Operations", "Pickup not attempted by rider", "Carrybee - Internal", "Operations (Pickup Inbound)"),
    ("RC-03", "Pickup Operations", "Pickup slot missed / rider late", "Carrybee - Internal", "Operations (Pickup Inbound)"),
    ("RC-04", "Pickup Operations", "Pickup request not created or not assigned", "Carrybee - Internal", "Operations (Pickup Inbound)"),
    ("RC-05", "Pickup Operations", "Rider refused parcel (size, weight, COD or area)", "Carrybee - Internal", "Operations (Pickup Inbound)"),
    ("RC-06", "Delivery Operations (Last Mile)", "False attempt / false hold note by rider", "Carrybee - Internal", "Operations (Delivery Inbound)"),
    ("RC-07", "Delivery Operations (Last Mile)", "Delivery not attempted (rider shortage or workload)", "Carrybee - Internal", "Operations (Delivery Inbound)"),
    ("RC-08", "Delivery Operations (Last Mile)", "Rider unreachable (phone off or not answering)", "Carrybee - Internal", "Operations (Delivery Inbound)"),
    ("RC-09", "Delivery Operations (Last Mile)", "Rider misbehaviour / unprofessional conduct", "Carrybee - Internal", "Operations (Delivery Inbound)"),
    ("RC-10", "Delivery Operations (Last Mile)", "Rider collected extra or wrong COD", "Carrybee - Internal", "Operations (Delivery Inbound)"),
    ("RC-11", "Delivery Operations (Last Mile)", "Closed-box / POD process not followed", "Carrybee - Internal", "Operations (Delivery Inbound)"),
    ("RC-12", "Delivery Operations (Last Mile)", "Parcel returned without informing merchant", "Carrybee - Internal", "Operations (Delivery Inbound)"),
    ("RC-13", "Delivery Operations (Last Mile)", "Remote or hard-to-reach area", "Carrybee - Internal", "Operations (Delivery Inbound)"),
    ("RC-14", "Hub & Processing", "Processing delay at hub", "Carrybee - Internal", "Operations (Hub & Processing)"),
    ("RC-15", "Hub & Processing", "Wrong sorting / routing / tag", "Carrybee - Internal", "Operations (Central Sort)"),
    ("RC-16", "Hub & Processing", "Parcel not scanned or status not updated", "Carrybee - Internal", "Operations (Central Sort)"),
    ("RC-17", "Hub & Processing", "Parcel misplaced or lost at hub", "Carrybee - Internal", "Operations (Delivery Inbound)"),
    ("RC-18", "Hub & Processing", "Mishandling / poor handling (damage)", "Carrybee - Internal", "Operations (Delivery Inbound)"),
    ("RC-19", "Hub & Processing", "Hub payment / cash not submitted", "Carrybee - Internal", "Operations (Delivery Inbound)"),
    ("RC-20", "Hub & Processing", "Return not created or not dispatched", "Carrybee - Internal", "Operations (Delivery Inbound)"),
    ("RC-21", "Hub & Processing", "Peak-season backlog", "Carrybee - Internal", "Operations (Delivery Inbound)"),
    ("RC-22", "Finance & Billing", "Invoice not generated", "Carrybee - Internal", "Accounts"),
    ("RC-23", "Finance & Billing", "Payment cycle delay (not yet due)", "Carrybee - Internal", "Accounts"),
    ("RC-24", "Finance & Billing", "Payout failed or on hold", "Carrybee - Internal", "Accounts"),
    ("RC-25", "Finance & Billing", "Charge or weight miscalculated", "Carrybee - Internal", "Accounts"),
    ("RC-26", "Finance & Billing", "COD amount mismatch recorded", "Carrybee - Internal", "Accounts"),
    ("RC-27", "Finance & Billing", "Compensation process pending", "Carrybee - Internal", "Accounts"),
    ("RC-28", "Merchant-side", "Wrong or incomplete order info entered (address, phone, COD, weight)", "Merchant", "Business Team / CM"),
    ("RC-29", "Merchant-side", "Poor packaging by merchant", "Merchant", "Business Team / CM"),
    ("RC-30", "Merchant-side", "Parcel not ready / not handed over at pickup", "Merchant", "Business Team / CM"),
    ("RC-31", "Merchant-side", "Defective or wrong product sent", "Merchant", "Business Team / CM"),
    ("RC-32", "Merchant-side", "Merchant unreachable / store closed", "Merchant", "Business Team / CM"),
    ("RC-33", "Merchant-side", "Merchant unaware of process or policy", "Merchant", "Business Team / CM"),
    ("RC-34", "Merchant-side", "Wrong bank / MFS details provided", "Merchant", "Business Team / CM"),
    ("RC-35", "Customer-side", "Customer unreachable / phone off", "Customer", "Business Team / CM"),
    ("RC-36", "Customer-side", "Customer not available / asked to reschedule", "Customer", "Business Team / CM"),
    ("RC-37", "Customer-side", "Customer refused or changed mind", "Customer", "Business Team / CM"),
    ("RC-38", "Customer-side", "Customer gave wrong address or location", "Customer", "Business Team / CM"),
    ("RC-39", "Customer-side", "Customer misconduct (forced check, threat)", "Customer", "Business Team / CM"),
    ("RC-40", "Technology / System", "Panel or app bug / downtime", "Carrybee - Internal", "Tech & Product"),
    ("RC-41", "Technology / System", "Status sync or tracking error", "Carrybee - Internal", "Tech & Product"),
    ("RC-42", "Technology / System", "OTP or login failure", "Carrybee - Internal", "Tech & Product"),
    ("RC-43", "Technology / System", "Entry / return ID creation error", "Carrybee - Internal", "Tech & Product"),
    ("RC-44", "Technology / System", "Integration or API failure", "Carrybee - Internal", "Tech & Product"),
    ("RC-45", "Technology / System", "Duplicate or data error", "Carrybee - Internal", "Tech & Product"),
    ("RC-46", "KAM / Support", "KAM not reachable or not responsive", "Carrybee - Internal", "Business Team (KAM)"),
    ("RC-47", "KAM / Support", "Callback or follow-up missed", "Carrybee - Internal", "Business Team (KAM)"),
    ("RC-48", "KAM / Support", "Slow resolution (internal SLA breached)", "Carrybee - Internal", "Business Team (KAM)"),
    ("RC-49", "KAM / Support", "KAM change without handover", "Carrybee - Internal", "Business Team (KAM)"),
    ("RC-50", "KAM / Support", "Wrong information given by agent or staff", "Carrybee - Internal", "Inbound CC"),
    ("RC-51", "KAM / Support", "Escalation not raised", "Carrybee - Internal", "Inbound CC"),
    ("RC-52", "Process / Policy", "Policy or SLA not communicated to merchant", "Carrybee - Internal", "Business Team (KAM)"),
    ("RC-53", "Process / Policy", "Process gap - no owner defined", "Carrybee - Internal", "Issue Resolution"),
    ("RC-54", "Process / Policy", "Rate or charge policy unclear", "Carrybee - Internal", "Business Team (KAM)"),
    ("RC-55", "Process / Policy", "Service not available in area (coverage limit)", "Carrybee - Internal", "Activation"),
    ("RC-56", "Sales & Onboarding", "Onboarding follow-up not done", "Carrybee - Internal", "Activation"),
    ("RC-57", "Sales & Onboarding", "Account approval or activation delayed", "Carrybee - Internal", "Activation"),
    ("RC-58", "Sales & Onboarding", "Documents incomplete", "Carrybee - Internal", "Activation"),
    ("RC-59", "External", "Weather / road / strike (hartal)", "External", "Issue Resolution"),
    ("RC-60", "External", "Force majeure / act of God", "External", "Issue Resolution"),
    ("RC-61", "External", "Theft / robbery / hijack", "External", "Issue Resolution"),
    ("RC-62", "Not Determined", "Under investigation (confirm at closure)", "To be determined", "Inbound CC"),
    ("RC-63", "Not Determined", "Not applicable - information-only call", "To be determined", "Inbound CC"),
    ("RC-64", "Not Determined", "Unknown after investigation", "To be determined", "Inbound CC"),
]
upsert("root_cause_catalog", [{
    "rc_code": c, "rc_category": cat, "rc_label": lbl, "accountability": acc,
    "default_team": tm, "picker_label": f"{c} | {cat} — {lbl}"
} for c, cat, lbl, acc, tm in RC_RAW], "rc_code")

ALL_USERS = ["Existing Merchant", "New Merchant", "Potential Merchant", "Delivery Agent", "Customer"]
TAX_RAW = [
    (1, None, ["Existing Merchant","New Merchant"], "Request", "Pickup Request (new / scheduled)", ["Pickup scheduled today","First pickup request","Bulk pickup","Other"], ["Created/confirmed pickup & shared slot","Pushed Pickup Request to Global MX"], "YES", "Operations", "Pickup", ["Pickup Request","Pickup Request - On-Demand"], "Regular", None, "Global SLA", 0, False),
    (2, None, ["Existing Merchant","New Merchant"], "Issue", "Pickup Missed / Delayed / Not Attempted", ["Pickup missed","Rider did not collect","Pickup late","Other"], ["Raised Pickup issue in Global MX & rebooked","Confirmed urgent pickup slot"], "YES", "Operations", "Pickup", ["Pickup Not Attempted By Agent","Pickup Timing Issue","Rider Shortage"], "Regular", None, "Global SLA", 0, False),
    (3, "G-18", ["Existing Merchant","New Merchant","Customer"], "Inquiry", "Parcel / Order Status Inquiry", ["Where is my parcel?","Parcel kothay?","Status update","Other"], ["Gave live status from panel (FCR)","Shared ETA — no ticket needed"], "NO", "Resolve on call", None, [], None, 0, "On call", 0, False),
    (4, None, ["Existing Merchant","Customer"], "Issue", "Parcel Status Not Updated / Wrong Status", ["No update for days","Marked delivered but not received","Wrong status on panel","Other"], ["Raised Panel Status issue & checked hub scan","Escalated wrong status to Global MX"], "YES", "Operations", "Panel Status", ["Agent/Hub Didn't Update Status Timely","Wrong Status","Technical Error"], "Regular", None, "Global SLA", 0, False),
    (5, None, ["Existing Merchant","New Merchant","Customer"], "Issue", "Delivery Delay (parcel taking longer than expected)", ["Delivery delay","Stuck at hub >48h","Rider shortage delay","Other"], ["Raised Delivery Delay in Global MX & gave revised ETA","Noted hub scan & escalated"], "YES", "Operations", "Delivery Delay", ["Processing Delay","Rider Shortage","Remote Area","Delivery Delay - On-Demand"], "Regular", None, "Global SLA", 0, False),
    (6, None, ["Existing Merchant"], "Request", "Urgent Delivery Request", ["Urgent delivery today","VIP deadline","Other"], ["Flagged Urgent Delivery in Global MX","Confirmed feasibility & shared reference"], "YES", "Operations", "Delivery Delay", ["Urgent Delivery"], "Urgent", None, "Global SLA", 0, False),
    (7, "G-11", ["Existing Merchant","Customer"], "Inquiry", "Delivery Timeline / ETA Inquiry", ["When will it deliver?","Kobe pabo?","Zone SLA inquiry","Other"], ["Shared area SLA/ETA on call (FCR)","Resolved on call — no ticket"], "NO", "Resolve on call", None, [], None, 0, "On call", 0, False),
    (8, None, ["Existing Merchant","Customer"], "Issue", "Fake / Missed Delivery Attempt (false note / hold / return)", ["Fake attempt","Customer ke call kore ni","False hold note","Other"], ["Raised Complain Why Return in Global MX","Arranged re-attempt & flagged rider"], "YES", "Operations", "Complain Why Return", ["False Return Note","Improper Delivery Attempt","Merchant Not Informed Before Returning"], "Regular", None, "Global SLA", 0, False),
    (9, None, ["Existing Merchant","Customer"], "Issue", "Rider Not Delivering / Refuses Delivery", ["Rider delivery korche na","Refuses home delivery","Other"], ["Raised Delivery Not Attempted in Global MX","Requested rider reassignment"], "YES", "Operations", "Delivery Delay", ["Delivery Not Attempted By Agent"], "Regular", None, "Global SLA", 0, False),
    (10, None, ["Existing Merchant","Customer"], "Issue", "Rider Unreachable (phone off / not answering)", ["Number off","Rider dhorche na","Wrong rider number","Other"], ["Raised Execution Request in Global MX","Requested hub to update rider contact"], "YES", "Operations", "Execution Request", ["Agent details missing/wrong number"], "Urgent", None, "Global SLA", 0, False),
    (11, None, ["Existing Merchant","Customer"], "Issue", "Complaint Against Delivery Agent / Rider (abuse, extra money)", ["Kharap byabohar","Extra taka niyeche","Unprofessional conduct","Other"], ["Raised Unprofessionalism / Extra Charge in Global MX","Logged rider details for audit"], "YES", "Operations", "Unprofessionalism", ["Misbehavior By DA","Misbehavior By PA"], "Critical", None, "Global SLA", 0, False),
    (12, None, ["Existing Merchant","Customer","Delivery Agent"], "Issue", "Complaint Against Office / Hub Staff", ["Hub staff misbehaviour","Office staff complaint","Other"], ["Raised Misbehavior By Employee in Global MX","Escalated to Hub & Processing"], "YES", "Operations", "Unprofessionalism", ["Misbehavior By Employee"], "Critical", None, "Global SLA", 0, False),
    (13, None, ["Existing Merchant","Customer"], "Issue", "Missing / Damaged Item (damage, leakage, poor packaging)", ["Product broken / vanga","Liquid leakage","Item missing","Other"], ["Raised Damage ticket & started claim path","Captured photo reference & pushed MX"], "YES", "Operations", "Damage", ["Mishandling","Liquid Leakage","Poor Packaging","Partial Missing"], "Critical", None, "Global SLA", 0, False),
    (14, None, ["Existing Merchant"], "Issue", "Lost Parcel / Compensation Sought", ["Parcel lost / hariye geche","Trackless >72h","Compensation sought","Other"], ["Raised Lost Parcel investigation in Global MX","Shared compensation review SLA"], "YES", "Operations", "Lost", ["Parcel Lost By OPS","Trackless","Empty Package/Empty Packet/Empty Box"], "Critical", None, "Global SLA", 0, False),
    (15, None, ["Existing Merchant"], "Issue", "No-Entry Parcel (handed over, not in system)", ["No entry in panel","Double entry","Info mismatch","Other"], ["Raised No Entry/Cancelled in Global MX","Verified pickup receipt & parcel count"], "YES", "Operations", "No Entry/Cancelled", ["No Entry","Double Entry","Info Mismatch"], "Critical", None, "Global SLA", 0, False),
    (16, None, ["Existing Merchant","Customer","Delivery Agent"], "Issue", "Fraud / Theft / Hijacking Reported", ["Fraudulent activity","Robbery","Parcel snatched","Other"], ["Immediate escalation to Global MX & Security","Logged police/incident details"], "YES", "Operations", "Forcefully Taken", ["Fraudulent Activity","Defective Product Sent By Merchant"], "Urgent", None, "Global SLA", 0, True),
    (17, None, ["Existing Merchant"], "Issue", "Wrong Routing / Wrong Tag / Zone Change", ["Wrong zone","Zone change needed","Wrong tag attached","Other"], ["Raised Wrong Routing in Global MX","Requested hub re-route"], "YES", "Operations", "Wrong Routing", ["Wrong Routing By Processing Team","Incomplete/ Wrong Info Input On Panel","Technical Error"], "Critical", None, "Global SLA", 0, False),
    (18, None, ["Existing Merchant","Customer"], "Issue", "Breach of CLOSEBOX / POD Not Followed", ["POD not followed","OTP bypassed","Closed-box opened","Other"], ["Raised Breach of CLOSEBOX in Global MX","Flagged rider for POD compliance"], "YES", "Operations", "Breach of CLOSEBOX", ["POD Not Followed By Agent","Forcefully Checked By Customer"], "Critical", None, "Global SLA", 0, False),
    (19, None, ["Existing Merchant"], "Request", "Return / Exchange Request (reprocess, reverse pickup)", ["Reprocess delivery","Reverse pickup","Exchange request","Other"], ["Raised Reprocess / Reverse Pickup in Global MX","Confirmed return instruction"], "YES", "Operations", "Complain Why Return", ["Reprocess Request by Merchant"], "Regular", None, "Global SLA", 0, False),
    (20, None, ["Existing Merchant"], "Issue", "Return Delayed / Return ID Not Created / Return Damaged", ["Return not received","Return ID not created","Return damaged","Other"], ["Raised Return Delay in Global MX","Escalated to Hub & Processing"], "YES", "Operations", "Return Delay", ["Processing Delay","Return ID Not Created","Merchant Unreachable/Store Closed"], "Regular", None, "Global SLA", 0, False),
    (21, "G-18", ["Existing Merchant","Customer"], "Inquiry", "Return / Exchange Status Inquiry", ["Return status","Ferot kobe pabo?","Other"], ["Shared return scan status on call (FCR)","Resolved on call — no ticket"], "NO", "Resolve on call", None, [], None, 0, "On call", 0, False),
    (22, None, ["Existing Merchant","New Merchant"], "Request", "Cancel / Hold Request", ["Cancel parcel","Hold at hub","Customer cancelled","Other"], ["Submitted Order Cancellation / Hold in Global MX","Confirmed back to merchant"], "YES", "Operations", "Execution Request", ["Order Cancellation Request","Hold Request"], "Urgent", None, "Global SLA", 0, False),
    (23, None, ["Existing Merchant","New Merchant","Customer"], "Request", "Address / Contact Correction (customer address / phone)", ["Address change","Phone number typo","Location update","Other"], ["Read back updated details & pushed Global MX","Submitted Customer Address/Contact Update"], "YES", "Operations", "Execution Request", ["Customer Address Update","Customer Contact Update"], "Urgent", None, "Global SLA", 0, False),
    (24, None, ["Existing Merchant","New Merchant"], "Request", "COD / Weight / Price Correction", ["COD change","Weight correction","Price update","Other"], ["Verified merchant & pushed Price Updatation Request","Confirmed updated COD amount"], "YES", "Operations", "Execution Request", ["Price Updatation Request"], "Urgent", None, "Global SLA", 0, False),
    (25, None, ["Existing Merchant"], "Request", "Order Details Update (partial delivery, special instruction)", ["Partial delivery","Special instruction","Store info update","Other"], ["Pushed Partial delivery / special instruction to MX","Confirmed instruction with caller"], "YES", "Operations", "Execution Request", ["Partial delivery request - special instruction","Store Info Update","Profile Info Update","Uninformed Info change"], "Urgent", None, "Global SLA", 0, False),
    (26, None, ["Existing Merchant"], "Issue", "Payment Not Received / Delayed / Short (payout)", ["Payment pai ni","Invoice generated no disbursement","Short payout","Other"], ["Raised Payment Issue in Global MX","Checked payout cycle & due date"], "YES", "Operations", "Payment Issue", ["Invoice Generated But Payment Not Disbursed","Invoice Not Generated"], "Regular", None, "Global SLA", 0, False),
    (27, None, ["Existing Merchant"], "Issue", "COD Settlement Dispute (collected less, cash lost, not reflected)", ["COD mismatch","Hub payment not submitted","Cash lost","Other"], ["Raised COD Settlement Dispute in Global MX","Escalated to Finance / Hub"], "YES", "Operations", "Payment Issue", ["Hub Payment Not Submitted","Cash Lost By OPS"], "Regular", None, "Global SLA", 0, False),
    (28, None, ["Existing Merchant"], "Issue", "Charge Dispute (delivery / return / weight charge too high)", ["Charge beshi","Weight charge dispute","Wrong COD charge","Other"], ["Raised Charge Extra/Wrong COD in Global MX","Logged parcel for fee recalculation"], "YES", "Operations", "Charge Extra/Wrong COD", ["Miscalculation Of Delivery/Return Charge","Miscalculation Of Weight Charge","Miscalculation Of COD Charge","Wrong COD Collection"], "Critical", None, "Global SLA", 0, False),
    (29, "G-10", ["Existing Merchant","New Merchant"], "Inquiry", "Payment When / How / Statement Inquiry", ["Payment kobe?","Invoice statement request","EFT status check","Other"], ["Routed statement/EFT check to Accounts Sheet (2h SLA)","Shared payout cycle schedule"], "NO", "Accounts", None, [], None, 120, "2 hours (Fri +2h)", 120, False),
    (30, None, ["Existing Merchant"], "Request", "Payment Method / Bank / MFS Change", ["bKash / Nagad change","Bank account update","Other"], ["Pushed Payment Info Update to Global MX","Verified OTP / callback requirement"], "YES", "Operations", "Execution Request", ["Payment Info Update"], "Urgent", None, "Global SLA", 0, False),
    (31, "G-01", ["Existing Merchant","New Merchant","Delivery Agent"], "Issue", "System / App Issue (login, panel, bulk upload, API, tracking link)", ["Login hocche na","Bulk CSV upload failing","API / webhook error","Tracking link broken","Other"], ["Routed to Tech & Product Sheet (G-01 · 2h SLA)","Shared temporary workaround & logged store ID"], "NO", "Tech & Product", None, [], None, 120, "2 hours", 0, True),
    (32, None, ["Existing Merchant","New Merchant"], "Request", "Account Access / OTP / Password", ["OTP pai ni","Password reset","Account locked","Other"], ["Pushed Profile Password Update to Global MX","Guided password reset"], "YES", "Operations", "Execution Request", ["Profile Password Update"], "Urgent", None, "Global SLA", 0, False),
    (33, "G-02", ["Existing Merchant","New Merchant"], "Request", "Merchant Seeking KAM / Wants KAM Contact / KAM Change", ["Wants KAM contact","KAM change request","Custom rate slab / nobody contacted me","Other"], ["Routed to Business Team (KAM) Sheet (30m SLA)","Promised KAM callback & shared ticket ref"], "NO", "Business Team (KAM)", None, [], None, 30, "30 min (Fri 2h 30m)", 120, True),
    (34, "G-03", ["Existing Merchant","New Merchant"], "Issue", "Complaint Against KAM (not responding, wrong info, no handover)", ["KAM not responding","Wrong info given by KAM","No KAM handover","Other"], ["Escalated to Business Team (KAM Lead) Sheet (30m SLA)","Flagged churn watch & promised same-day callback"], "NO", "Business Team (KAM)", None, [], None, 30, "30 min (Fri 2h 30m)", 120, True),
    (35, "G-04", ["Existing Merchant","New Merchant","Customer"], "Inquiry", "Merchant Follow-up on Previous Issue", ["Follow-up on open ticket","SLA breached — urgent chase","Already escalated","Other"], ["Linked & chased existing ticket (E-11)","Escalated breached ticket to Issue Resolution"], "NO", "Issue Resolution", None, [], None, 360, "Same day 6:00 PM", 0, False),
    (36, None, ["New Merchant","Potential Merchant"], "Request", "Store Approval / Registration Assistance", ["Store approval delayed >24h","KYC approval help","Account activation","Other"], ["Pushed Store Approval to Global MX (E-05)","Logged onboarding follow-up"], "YES", "Operations", "Execution Request", ["Store Approval"], "Urgent", None, "Global SLA", 0, False),
    (37, "G-05", ["New Merchant","Potential Merchant"], "Inquiry", "New Merchant Onboarding Info (how to create parcels, KYC, rate)", ["How to create parcels?","KYC documents needed","First pickup setup","Other"], ["Guided on call & routed to Activation Sheet","Scheduled onboarding call (Next WD 6:00 PM)"], "NO", "Activation", None, [], None, 1440, "Next working day 6:00 PM", 0, False),
    (38, "G-15", ["Potential Merchant"], "Inquiry", "Potential Merchant Joining Inquiry (pricing, coverage, callback)", ["Wants to join CarryBee","Corporate rate card","Sales callback requested","Other"], ["Qualified lead & pushed to Activation Sheet (G-15)","Booked Activation sales callback"], "NO", "Activation", None, [], None, 1440, "Next working day 6:00 PM", 0, False),
    (39, "G-15", ["Existing Merchant","New Merchant","Potential Merchant"], "Inquiry", "Delivery Coverage / Charges Inquiry (rate, area, bulk)", ["Rate koto?","Area coverage check","Bulk volume rate","Other"], ["Shared coverage/rate card & logged Activation lead","Resolved rate query on call"], "NO", "Activation", None, [], None, 1440, "Next working day 6:00 PM", 0, False),
    (40, "G-06", ["Delivery Agent"], "Inquiry", "Agent Operations Support (app, handover, route, unreachable guidance)", ["App handover query","Customer unreachable guidance","Hub route support","Other"], ["Guided DA on call & logged to Supply Sheet","Confirmed hub handover SOP"], "NO", "Supply", None, [], None, 1440, "Next working day 6:00 PM", 0, False),
    (41, "G-07", ["Delivery Agent"], "Inquiry", "Agent Payment Status Inquiry (commission, COD submission, deduction info)", ["Commission payout status","COD submission procedure","Settlement date","Other"], ["Shared DA settlement status & logged Supply Sheet","Explained payout schedule"], "NO", "Supply", None, [], None, 1440, "Next working day 6:00 PM", 0, False),
    (42, "G-08", ["Delivery Agent"], "Issue", "Agent Payment / Deduction Dispute", ["Commission delayed","Wrong COD deduction","Hub cash deposit mismatch","Other"], ["Raised DA Payment Dispute in Supply Sheet (G-08)","Logged DA ID, Hub & disputed BDT amount (E-10)"], "NO", "Supply", None, [], None, 1440, "Next working day 6:00 PM", 0, True),
    (43, "G-16", ["Delivery Agent"], "Inquiry", "Agent Recruitment Inquiry (wants to join as rider)", ["Wants to join as rider","Rider documents & hub slot","Other"], ["Qualified rider lead & pushed to Supply Sheet (G-16)","Shared hub walk-in schedule"], "NO", "Supply", None, [], None, 1440, "Next working day 6:00 PM", 0, False),
    (44, "G-09", ["Delivery Agent","Existing Merchant","Customer"], "Issue", "Safety / Security Incident (robbery, threat, accident)", ["Parcel snatched / robbery","Physical threat / assault","Road accident during delivery","Other"], ["Immediate CRITICAL Safety escalation to Supply Sheet (G-09)","Dual-Push: Global Lost › Hijacking/Robbery + Supply Sheet"], "PARTIAL", "Supply", "Lost", ["Hijacking/Robbery"], "Critical", 60, "Immediate — same day", 0, True),
    (45, "G-14", ["Existing Merchant","Customer"], "Inquiry", "Service Feedback / Suggestion", ["Service suggestion","Appreciation / general feedback","Other"], ["Logged feedback in CRM (G-14 — no Global ticket)","Thanked caller & tagged Product/CC review"], "NO", "Inbound CC", None, [], None, 360, "Same day", 0, False),
    (46, "G-12", ["Existing Merchant","Potential Merchant","Customer"], "Inquiry", "General Inquiry (service, prohibited items, hours)", ["Prohibited items list","Office / holiday hours","Hub address","Other"], ["Answered from knowledge base (FCR)","Resolved on call — no ticket"], "NO", "Resolve on call", None, [], None, 0, "On call", 0, False),
    (47, "G-13", ["Customer"], "Inquiry", "Merchant-Side Order Issue — Redirect (wrong/defective product, refund)", ["Wrong product sent by seller","Defective item / refund from merchant","Cancel with seller","Other"], ["Shared merchant contact & logged Redirect to Merchant (G-13)","Closed without Ops ticket (E-08)"], "NO", "Redirect to Merchant", None, [], None, 0, "N/A (redirect)", 0, False),
    (48, "G-17", ["Existing Merchant","New Merchant"], "Inquiry", "Missed Hotline Call / Callback Request", ["Missed hotline call","Requested callback at preferred time","Other"], ["Scheduled callback in Inbound CC Callback Queue","Logged preferred AM/PM time"], "NO", "Inbound CC", None, [], None, 120, "Same day", 0, False),
    (49, None, ALL_USERS, "None", "Non-Service / Silent / Wrong Vertical / Abandoned", ["Silent / blank call","Dropped line","Wrong vertical (Food/Ride)","Wrong number"], ["Closed as None — Log Only (E-13)","Transferred wrong vertical — zero ticket"], "NO", "No ticket", None, [], None, 0, "N/A", 0, False),
]
upsert("taxonomy_matrix", [{
    "matrix_id": mid, "gap_code": gap, "user_types": ut, "call_type": ct,
    "contact_reason": cr, "themes": th, "actions_taken": act, "push_to_global": ptg,
    "owner_queue": oq, "global_category": gc, "global_sub_categories": gsubs,
    "fallback_issue_type": fit, "sla_minutes": slam, "sla_label": slal,
    "friday_buffer_mins": fbuf, "is_critical_gate": crit
} for (mid, gap, ut, ct, cr, th, act, ptg, oq, gc, gsubs, fit, slam, slal, fbuf, crit) in TAX_RAW], "matrix_id")

GCAT_RAW = [
    ("Execution Request", "Order Cancellation Request", "Urgent", 1, 1, 1),
    ("Execution Request", "Price Updatation Request", "Urgent", 1, 1, 1),
    ("Execution Request", "Customer Address Update", "Urgent", 1, 1, 1),
    ("Execution Request", "Customer Contact Update", "Urgent", 1, 1, 1),
    ("Execution Request", "Payment Info Update", "Urgent", 1, 1, 1),
    ("Execution Request", "Profile Info Update", "Urgent", 1, 1, 1),
    ("Execution Request", "Profile Password Update", "Urgent", 1, 1, 1),
    ("Execution Request", "Store Approval", "Urgent", 1, 1, 1),
    ("Execution Request", "Store Info Update", "Urgent", 1, 1, 1),
    ("Execution Request", "Hold Request", "Urgent", 1, 1, 1),
    ("Execution Request", "Partial delivery request - special instruction", "Urgent", 1, 1, 1),
    ("Execution Request", "Uninformed Info change", "Urgent", 1, 1, 1),
    ("Execution Request", "Agent details missing/wrong number", "Urgent", 1, 1, 1),
    ("Forcefully Taken", "Defective Product Sent By Merchant", "Urgent", 1, 1, 1),
    ("Forcefully Taken", "Fraudulent Activity", "Urgent", 10, 10, 10),
    ("Charge Extra/Wrong COD", "Extra Charge Offered", "Critical", 2, 2, 2),
    ("Charge Extra/Wrong COD", "Extra Charge Demanded", "Critical", 2, 2, 2),
    ("Charge Extra/Wrong COD", "Wrong COD Collection", "Critical", 2, 2, 2),
    ("Charge Extra/Wrong COD", "Wrong Weight Input", "Critical", 2, 2, 2),
    ("Charge Extra/Wrong COD", "Miscalculation Of Weight Charge", "Critical", 1, 1, 1),
    ("Charge Extra/Wrong COD", "Miscalculation Of Delivery/Return Charge", "Critical", 1, 1, 1),
    ("Charge Extra/Wrong COD", "Miscalculation Of COD Charge", "Critical", 1, 1, 1),
    ("Damage", "Poor Packaging", "Critical", 5, 5, 5),
    ("Damage", "Liquid Leakage", "Critical", 2, 2, 2),
    ("Damage", "Mishandling", "Critical", 5, 7, 7),
    ("Lost", "Trackless", "Critical", 5, 7, 7),
    ("Lost", "Parcel Lost By OPS", "Critical", 5, 7, 7),
    ("Lost", "Hijacking/Robbery", "Critical", 7, 10, 10),
    ("Lost", "Empty Package/Empty Packet/Empty Box", "Critical", 5, 7, 7),
    ("Lost", "Partial Missing", "Critical", 5, 7, 7),
    ("No Entry/Cancelled", "Double Entry", "Critical", 5, 5, 5),
    ("No Entry/Cancelled", "No Entry", "Critical", 5, 5, 5),
    ("No Entry/Cancelled", "Info Mismatch", "Critical", 5, 5, 5),
    ("Unprofessionalism", "Misbehavior By PA", "Critical", 2, 3, 3),
    ("Unprofessionalism", "Misbehavior By DA", "Critical", 2, 3, 3),
    ("Unprofessionalism", "Misbehavior By Employee", "Critical", 2, 3, 3),
    ("Wrong Routing", "Incomplete/ Wrong Info Input On Panel", "Critical", 2, 5, 5),
    ("Wrong Routing", "Wrong Routing By Processing Team", "Critical", 2, 5, 5),
    ("Wrong Routing", "Technical Error", "Critical", 2, 5, 5),
    ("Wrong tag/Parcel swapped", "Wrong Tag By LMH", "Critical", 3, 5, 5),
    ("Wrong tag/Parcel swapped", "Wrong Tag By FMH", "Critical", 3, 5, 5),
    ("Breach of CLOSEBOX", "Forcefully Checked By Customer", "Critical", 2, 3, 3),
    ("Breach of CLOSEBOX", "POD Not Followed By Agent", "Critical", 2, 3, 3),
    ("Panel Status", "Agent/Hub Didn't Update Status Timely", "Regular", 2, 2, 2),
    ("Panel Status", "Wrong Status", "Regular", 3, 3, 3),
    ("Panel Status", "Technical Error", "Regular", 2, 5, 5),
    ("Complain Why Return", "Improper Delivery Attempt", "Regular", 2, 3, 3),
    ("Complain Why Return", "Merchant Not Informed Before Returning", "Regular", 2, 3, 3),
    ("Complain Why Return", "False Return Note", "Regular", 2, 3, 3),
    ("Complain Why Return", "Reprocess Request by Merchant", "Regular", 2, 3, 3),
    ("Delivery Delay", "Rescheduled By Customer/Customer Unreachable", "Regular", 2, 3, 3),
    ("Delivery Delay", "Remote Area", "Regular", 3, 5, 5),
    ("Delivery Delay", "Delivery Not Attempted By Agent", "Regular", 2, 3, 3),
    ("Delivery Delay", "False Hold Note", "Regular", 2, 3, 3),
    ("Delivery Delay", "Processing Delay", "Regular", 3, 5, 5),
    ("Delivery Delay", "Rider Shortage", "Regular", 3, 5, 5),
    ("Delivery Delay", "Delivery Delay - On-Demand", "Regular", 1, 10, 10),
    ("Delivery Delay", "Urgent Delivery", "Urgent", 1, 1, 1),
    ("Payment Issue", "Hub Payment Not Submitted", "Regular", 2, 3, 3),
    ("Payment Issue", "Cash Lost By OPS", "Regular", 3, 5, 5),
    ("Payment Issue", "Invoice Not Generated", "Regular", 3, 3, 3),
    ("Payment Issue", "Invoice Generated But Payment Not Disbursed", "Regular", 3, 3, 3),
    ("Pickup", "Pickup Request", "Regular", 2, 3, 3),
    ("Pickup", "Rider Shortage", "Regular", 3, 5, 5),
    ("Pickup", "Pickup Timing Issue", "Regular", 2, 3, 3),
    ("Pickup", "Pickup Request - On-Demand", "Regular", 1, 10, 10),
    ("Pickup", "Pickup Not Attempted By Agent", "Regular", 1, 2, 2),
    ("Return Delay", "Processing Delay", "Regular", 3, 5, 5),
    ("Return Delay", "Merchant Unreachable/Store Closed", "Regular", 2, 3, 3),
    ("Return Delay", "Return ID Not Created", "Regular", 2, 3, 3),
]
upsert("global_category_catalog", [{
    "global_category": c, "global_sub_category": s, "issue_type": it,
    "sla_isd_days": isd, "sla_osd_days": osd, "sla_ctg_days": ctg
} for c, s, it, isd, osd, ctg in GCAT_RAW], "global_category,global_sub_category")

HUBS_RAW = [
    ("Mirpur Hub", "ISD", "Dhaka"), ("Mirpur-10 Hub", "ISD", "Dhaka"), ("Uttara Hub", "ISD", "Dhaka"),
    ("Dhanmondi Hub", "ISD", "Dhaka"), ("Gulshan Hub", "ISD", "Dhaka"), ("Banani Hub", "ISD", "Dhaka"),
    ("Mohammadpur Hub", "ISD", "Dhaka"), ("Badda Hub", "ISD", "Dhaka"), ("Motijheel Hub", "ISD", "Dhaka"),
    ("Jatrabari Hub", "ISD", "Dhaka"), ("Old Dhaka Hub", "ISD", "Dhaka"), ("Tejgaon Central Sort", "ISD", "Dhaka"),
    ("Savar Hub", "OSD", "Dhaka Sub"), ("Gazipur Hub", "OSD", "Gazipur"), ("Tongi Hub", "OSD", "Gazipur"),
    ("Narayanganj Hub", "OSD", "Narayanganj"), ("Sylhet Hub", "OSD", "Sylhet"), ("Sylhet Central Hub", "OSD", "Sylhet"),
    ("Bogura Sadar Hub", "OSD", "Bogura"), ("Rajshahi Central Hub", "OSD", "Rajshahi"), ("Khulna Central Hub", "OSD", "Khulna"),
    ("Barishal Hub", "OSD", "Barishal"), ("Rangpur Hub", "OSD", "Rangpur"), ("Mymensingh Hub", "OSD", "Mymensingh"),
    ("Cumilla Hub", "OSD", "Cumilla"), ("Feni Hub", "OSD", "Feni"), ("Jashore Hub", "OSD", "Jashore"),
    ("Chattogram Central", "CTG", "Chattogram"), ("Agrabad Hub", "CTG", "Chattogram"), ("Nasirabad Hub", "CTG", "Chattogram"),
    ("Halishahar Hub", "CTG", "Chattogram"), ("Cox's Bazar Hub", "CTG", "Cox's Bazar"),
]
upsert("synced_hub_master", [{"hub_name": h, "zone": z, "district": d} for h, z, d in HUBS_RAW], "hub_name")

upsert("merchant_kam_directory", [
    {"business_id": "CB-M-10482", "business_name": "Dhaka Fashion House", "reg_number_raw": "01711223344", "reg_number_norm": "01711223344", "kam_name": "Tanvir Ahmed", "responsible_team": "Enterprise KAM", "completed_trips": 420, "sheet_row_number": 2},
    {"business_id": "CB-M-10911", "business_name": "Urban Gadgets BD", "reg_number_raw": "01819554433", "reg_number_norm": "01819554433", "kam_name": "Nusrat Jahan", "responsible_team": "SME KAM", "completed_trips": 185, "sheet_row_number": 3},
    {"business_id": "CB-M-10895", "business_name": "Glow Skincare BD", "reg_number_raw": "01614778899", "reg_number_norm": "01614778899", "kam_name": "Farhana Akter", "responsible_team": "Key Accounts", "completed_trips": 265, "sheet_row_number": 4},
    {"business_id": "CB-M-10544", "business_name": "Bengal Craft Studio", "reg_number_raw": "01712998877", "reg_number_norm": "01712998877", "kam_name": "Tanvir Ahmed", "responsible_team": "Enterprise KAM", "completed_trips": 310, "sheet_row_number": 5},
    {"business_id": "CB-M-10205", "business_name": "Dhaka Electronics Mart", "reg_number_raw": "01811334455", "reg_number_norm": "01811334455", "kam_name": "Tanvir Ahmed", "responsible_team": "Enterprise KAM", "completed_trips": 540, "sheet_row_number": 6},
    {"business_id": "CB-M-11950", "business_name": "Sylhet Tea & Organics", "reg_number_raw": "01915667788", "reg_number_norm": "01915667788", "kam_name": "Nabil Hasan", "responsible_team": "Growth KAM", "completed_trips": 0, "sheet_row_number": 7},
], "reg_number_norm")

upsert("merchant_business_fallback", [
    {"business_id": "CB-M-12400", "business_name": "KnitWear Express BD", "reg_number_norm": "01722889900", "completed_trips": 92, "default_hub": "Dhanmondi Hub", "default_zone": "ISD"},
    {"business_id": "CB-M-12910", "business_name": "Bongo Fresh Mart", "reg_number_norm": "01755990011", "completed_trips": 0, "default_hub": "Mohammadpur Hub", "default_zone": "ISD"},
], "business_id")

upsert("parcel_lookup_cache", [
    {"consignment_id": "CB982341009", "merchant_id": "CB-M-10482", "merchant_name": "Dhaka Fashion House", "merchant_phone": "01711223344", "customer_name": "Tariqul Islam", "customer_phone": "01799112233", "delivery_hub": "Mirpur Hub", "delivery_zone": "ISD", "last_parcel_status": "On Hold at Hub (51h)", "cod_amount": 1850, "scans": [{"at": "Nov 22, 2:15 PM", "text": "Picked up from Dhaka Fashion House"}, {"at": "Nov 22, 8:40 PM", "text": "Sorted at Tejgaon Central Sort"}, {"at": "Nov 23, 9:10 AM", "text": "On Hold at Mirpur Hub — Customer Unreachable note logged"}], "discrepancy_hint": "Parcel held >48h with 'Customer Unreachable' note — check E-08/M#08 False Attempt"},
    {"consignment_id": "CB982339014", "merchant_id": "CB-M-10482", "merchant_name": "Dhaka Fashion House", "merchant_phone": "01711223344", "customer_name": "Rafiq Mia", "customer_phone": "01911223344", "delivery_hub": "Mirpur Hub", "delivery_zone": "ISD", "last_parcel_status": "Out for Delivery", "cod_amount": 2400, "scans": [{"at": "Today, 8:50 AM", "text": "Out for delivery with DA-419 (Md. Karim)"}], "discrepancy_hint": None},
    {"consignment_id": "CB982240901", "merchant_id": "CB-M-10205", "merchant_name": "Dhaka Electronics Mart", "merchant_phone": "01811334455", "customer_name": "Sabbir Hossain", "customer_phone": "01844556677", "delivery_hub": "Uttara Hub", "delivery_zone": "ISD", "last_parcel_status": "Return In Transit", "cod_amount": 18500, "scans": [{"at": "Nov 20, 4:10 PM", "text": "Customer refused — Return initiated"}, {"at": "Nov 21, 11:20 AM", "text": "Return In Transit at Uttara Hub (no scan for 72h)"}], "discrepancy_hint": "High-value return (BDT 18,500) un-scanned >72h at Uttara Hub"},
    {"consignment_id": "CB982290118", "merchant_id": "CB-M-10895", "merchant_name": "Glow Skincare BD", "merchant_phone": "01614778899", "customer_name": "Nadia Sultana", "customer_phone": "01688990011", "delivery_hub": "Agrabad Hub", "delivery_zone": "CTG", "last_parcel_status": "Delivered (OTP Bypassed)", "cod_amount": 3200, "scans": [{"at": "Nov 22, 5:30 PM", "text": "Marked Delivered at Agrabad Hub — POD OTP not verified"}], "discrepancy_hint": "Marked Delivered without POD OTP — check M#18 Breach of CLOSEBOX"},
], "consignment_id")

upsert("churn_score_config", [
    {"signal_code": "T", "signal_label": "Threat to Churn Flagged (E-12)", "description": "Caller explicitly threatened to leave CarryBee on a logged call", "weight_points": 30},
    {"signal_code": "R", "signal_label": "Recurring Complaints (≥3 in 30d)", "description": "Merchant raised 3 or more issue tickets within rolling 30 days", "weight_points": 20},
    {"signal_code": "N", "signal_label": "Repeated Negative Sentiment (≥2)", "description": "2+ calls logged as Concerned or Dissatisfied", "weight_points": 20},
    {"signal_code": "U", "signal_label": "Unresolved Ticket Past SLA", "description": "At least one open Track A or Track B ticket past SLA due time", "weight_points": 15},
    {"signal_code": "F", "signal_label": "Failed-Contact Streak (≥3 in 7d)", "description": "3+ Dropped or No Answer outcomes in last 7 days", "weight_points": 10},
    {"signal_code": "D", "signal_label": "Declining Engagement (≥50% drop)", "description": "Trip or interaction volume dropped ≥50% WoW", "weight_points": 5},
], "signal_code")

upsert("sheet_registry", [
    {"registry_key": "MASTER_FALLBACK_HUB", "sheet_title": "CarryBee Inbound CRM — Master Stakeholder Fallback Hub", "owner_queue": "Executive Rollup + Fallback Mirror", "spreadsheet_id": "1JE5xO8tDoyw9VP8iVQtItqp_NIS5bbNq_2_9jGNXbLQ", "sheet_url": "https://docs.google.com/spreadsheets/d/1JE5xO8tDoyw9VP8iVQtItqp_NIS5bbNq_2_9jGNXbLQ/edit", "tab_name": "All_Issues_Fallback", "sync_interval": "2m", "sync_status": "Healthy", "row_count": 8},
    {"registry_key": "TEAM_BUSINESS_KAM", "sheet_title": "CarryBee Inbound CRM — Business Team (KAM) Issues", "owner_queue": "Business Team (KAM)", "spreadsheet_id": "1f_nY7jq8OVAOnbMTt4fm8jxMshpt7tIkPliNtUJmVX4", "sheet_url": "https://docs.google.com/spreadsheets/d/1f_nY7jq8OVAOnbMTt4fm8jxMshpt7tIkPliNtUJmVX4/edit", "tab_name": "Issues", "sync_interval": "2m", "sync_status": "Healthy", "row_count": 2},
    {"registry_key": "TEAM_TECH_PRODUCT", "sheet_title": "CarryBee Inbound CRM — Tech & Product Issues", "owner_queue": "Tech & Product", "spreadsheet_id": "1j2N739pVRgF4bI58hODJVPava0dPXwLdHJT8JkM42IY", "sheet_url": "https://docs.google.com/spreadsheets/d/1j2N739pVRgF4bI58hODJVPava0dPXwLdHJT8JkM42IY/edit", "tab_name": "Issues", "sync_interval": "2m", "sync_status": "Healthy", "row_count": 1},
    {"registry_key": "TEAM_ACCOUNTS", "sheet_title": "CarryBee Inbound CRM — Accounts Issues", "owner_queue": "Accounts", "spreadsheet_id": "1hxJH5oiclcNe2KywwrF2EpZFjWVbjFRszPc63iZqzcc", "sheet_url": "https://docs.google.com/spreadsheets/d/1hxJH5oiclcNe2KywwrF2EpZFjWVbjFRszPc63iZqzcc/edit", "tab_name": "Issues", "sync_interval": "2m", "sync_status": "Healthy", "row_count": 1},
    {"registry_key": "TEAM_ACTIVATION", "sheet_title": "CarryBee Inbound CRM — Activation Issues", "owner_queue": "Activation", "spreadsheet_id": "1ivLXZ9Ph7wiyC-pMiptaX9lqwvbfutOoO0TS0HqQisU", "sheet_url": "https://docs.google.com/spreadsheets/d/1ivLXZ9Ph7wiyC-pMiptaX9lqwvbfutOoO0TS0HqQisU/edit", "tab_name": "Issues", "sync_interval": "2m", "sync_status": "Healthy", "row_count": 1},
    {"registry_key": "TEAM_SUPPLY_SAFETY", "sheet_title": "CarryBee Inbound CRM — Supply & Safety Issues", "owner_queue": "Supply", "spreadsheet_id": "1XBHcL8WyBmqoselx3_WU9lmpaVpJCpnHyiJ-sbZOK7Y", "sheet_url": "https://docs.google.com/spreadsheets/d/1XBHcL8WyBmqoselx3_WU9lmpaVpJCpnHyiJ-sbZOK7Y/edit", "tab_name": "Issues", "sync_interval": "2m", "sync_status": "Healthy", "row_count": 2},
    {"registry_key": "TEAM_ISSUE_RESOLUTION", "sheet_title": "CarryBee Inbound CRM — Issue Resolution Escalations", "owner_queue": "Issue Resolution", "spreadsheet_id": "12OvnVgG0geVfZtys6RuVxslpxvc8k6VBnIJcf9c7zYI", "sheet_url": "https://docs.google.com/spreadsheets/d/12OvnVgG0geVfZtys6RuVxslpxvc8k6VBnIJcf9c7zYI/edit", "tab_name": "Issues", "sync_interval": "2m", "sync_status": "Healthy", "row_count": 1},
    {"registry_key": "MERCHANT_KAM_MASTER", "sheet_title": "CarryBee Inbound CRM — Merchant KAM Master", "owner_queue": "Merchant KAM Directory (5-Col)", "spreadsheet_id": "1PEVhZtbunfZB7qAvC6N1NQ5pSMZYQOsDYOjHXgfb2vg", "sheet_url": "https://docs.google.com/spreadsheets/d/1PEVhZtbunfZB7qAvC6N1NQ5pSMZYQOsDYOjHXgfb2vg/edit", "tab_name": "KAM_Merchants", "sync_interval": "15m", "sync_status": "Healthy", "row_count": 6},
], "registry_key")

now = datetime.datetime.now(datetime.timezone.utc)
def ago(mins): return (now - datetime.timedelta(minutes=mins)).isoformat()
def ahead(mins): return (now + datetime.timedelta(minutes=mins)).isoformat()

rakib = prof_by_user["Rakib.Chowdhury"]
mahmud = prof_by_user["Mahmud.Hasan"]
foysal = prof_by_user["Foysal.Hossain"]
touhid = prof_by_user["Touhidur.Rahman"]
sazzad = prof_by_user["Sazzad.Haider"]

CALLS = [
    {"call_ref": "CALL-261124-001", "agent_id": rakib["id"], "agent_name": rakib["username"], "team_id": "Inbound Desk A", "call_direction": "Incoming", "call_outcome": "Successfully Connected", "call_started_at": ago(240), "caller_phone_norm": "01711223344", "user_type": "Existing Merchant", "merchant_id": "CB-M-10482", "caller_name": "Dhaka Fashion House", "merchant_tier": "KAM", "assigned_kam": "Tanvir Ahmed", "responsible_team": "Enterprise KAM", "sentiment": "Concerned", "call_type": "Issue", "matrix_id": 5, "contact_reason": "Delivery Delay (parcel taking longer than expected)", "theme": "Stuck at hub >48h", "action_taken": "Raised Delivery Delay in Global MX & gave revised ETA", "routing_outcome": "GLOBAL_API", "linked_ticket_id": "INB-261124-0001", "additional_context": "High-value COD parcel CB982341009 stuck at Mirpur Hub >48h; merchant requested urgent dispatch today.", "handle_time_seconds": 145, "threat_to_churn": False, "qa_result": "Correct"},
    {"call_ref": "CALL-261124-002", "agent_id": mahmud["id"], "agent_name": mahmud["username"], "team_id": "Inbound Desk A", "call_direction": "Incoming", "call_outcome": "Successfully Connected", "call_started_at": ago(180), "caller_phone_norm": "01614778899", "user_type": "Existing Merchant", "merchant_id": "CB-M-10895", "caller_name": "Glow Skincare BD", "merchant_tier": "KAM", "assigned_kam": "Farhana Akter", "responsible_team": "Key Accounts", "sentiment": "Dissatisfied", "call_type": "Issue", "matrix_id": 34, "contact_reason": "Complaint Against KAM (not responding, wrong info, no handover)", "theme": "KAM not responding", "action_taken": "Escalated to Business Team (KAM Lead) Sheet (30m SLA)", "routing_outcome": "STAKEHOLDER_SHEET", "linked_ticket_id": "SAMPLE-004", "additional_context": "Merchant says KAM has not answered calls for 3 days and threatened to move volume to competitor.", "handle_time_seconds": 192, "threat_to_churn": True, "qa_result": "Correct"},
    {"call_ref": "CALL-261124-003", "agent_id": foysal["id"], "agent_name": foysal["username"], "team_id": "Inbound Desk A", "call_direction": "Incoming", "call_outcome": "Successfully Connected", "call_started_at": ago(130), "caller_phone_norm": "01819554433", "user_type": "Existing Merchant", "merchant_id": "CB-M-10911", "caller_name": "Urban Gadgets BD", "merchant_tier": "KAM", "assigned_kam": "Nusrat Jahan", "responsible_team": "SME KAM", "sentiment": "Concerned", "call_type": "Issue", "matrix_id": 31, "contact_reason": "System / App Issue (login, panel, bulk upload, API, tracking link)", "theme": "Bulk CSV upload failing", "action_taken": "Routed to Tech & Product Sheet (G-01 · 2h SLA)", "routing_outcome": "STAKEHOLDER_SHEET", "linked_ticket_id": "SAMPLE-002", "additional_context": "Merchant reports CSV bulk upload fails with HTTP 500 on Merchant Panel when Bangla address is included.", "handle_time_seconds": 128, "threat_to_churn": False, "qa_result": "Correct"},
    {"call_ref": "CALL-261124-004", "agent_id": rakib["id"], "agent_name": rakib["username"], "team_id": "Inbound Desk A", "call_direction": "Incoming", "call_outcome": "Callback Requested", "call_started_at": ago(55), "callback_scheduled_at": ahead(20), "callback_status": "Pending", "caller_phone_norm": "01712998877", "user_type": "Existing Merchant", "merchant_id": "CB-M-10544", "caller_name": "Bengal Craft Studio", "merchant_tier": "KAM", "assigned_kam": "Tanvir Ahmed", "responsible_team": "Enterprise KAM", "sentiment": "Neutral", "call_type": "Inquiry", "matrix_id": 48, "contact_reason": "Missed Hotline Call / Callback Request", "theme": "Requested callback at preferred time", "action_taken": "Scheduled callback in Inbound CC Callback Queue", "routing_outcome": "LOG_ONLY_OUTCOME", "additional_context": "Merchant was in warehouse handover; asked Inbound Desk to call back in 20 minutes with BRAC Bank EFT reference.", "handle_time_seconds": 48, "threat_to_churn": False},
    {"call_ref": "CALL-261124-005", "agent_id": touhid["id"], "agent_name": touhid["username"], "team_id": "Inbound Desk A", "call_direction": "Incoming", "call_outcome": "Call Dropped After Answer", "call_started_at": ago(40), "callback_scheduled_at": ago(15), "callback_status": "Overdue", "caller_phone_norm": "01811334455", "user_type": "Existing Merchant", "merchant_id": "CB-M-10205", "caller_name": "Dhaka Electronics Mart", "merchant_tier": "KAM", "assigned_kam": "Tanvir Ahmed", "responsible_team": "Enterprise KAM", "sentiment": "Dissatisfied", "call_type": "None", "matrix_id": 49, "contact_reason": "Non-Service / Silent / Wrong Vertical / Abandoned", "theme": "Dropped line", "action_taken": "Closed as None — Log Only (E-13)", "routing_outcome": "LOG_ONLY_OUTCOME", "additional_context": "Line dropped 18 seconds into call while checking return parcel CB982240901; auto +15m callback queued.", "handle_time_seconds": 18, "threat_to_churn": False},
    {"call_ref": "CALL-261124-006", "agent_id": foysal["id"], "agent_name": foysal["username"], "team_id": "Inbound Desk A", "call_direction": "Incoming", "call_outcome": "Successfully Connected", "call_started_at": ago(30), "caller_phone_norm": "01722889900", "user_type": "Existing Merchant", "merchant_id": "CB-M-12400", "caller_name": "KnitWear Express BD", "merchant_tier": "COMPLAINT_MANAGEMENT", "assigned_kam": "Complaint Management", "responsible_team": "Complaint Management", "sentiment": "Positive", "call_type": "Inquiry", "matrix_id": 3, "contact_reason": "Parcel / Order Status Inquiry", "theme": "Where is my parcel?", "action_taken": "Gave live status from panel (FCR)", "routing_outcome": "FCR_NO_TICKET", "additional_context": "Shared live Out-for-Delivery scan and rider contact on call; merchant satisfied, zero ticket needed.", "handle_time_seconds": 74, "threat_to_churn": False, "qa_result": "Correct"},
    {"call_ref": "CALL-261124-007", "agent_id": rakib["id"], "agent_name": rakib["username"], "team_id": "Inbound Desk A", "call_direction": "Incoming", "call_outcome": "Successfully Connected", "call_started_at": ago(22), "caller_phone_norm": "01311998877", "user_type": "Customer", "caller_name": "Mahmuda Akter", "merchant_tier": "N/A", "sentiment": "Concerned", "call_type": "Inquiry", "matrix_id": 47, "contact_reason": "Merchant-Side Order Issue — Redirect (wrong/defective product, refund)", "theme": "Wrong product sent by seller", "action_taken": "Shared merchant contact & logged Redirect to Merchant (G-13)", "routing_outcome": "REDIRECT_TO_MERCHANT", "additional_context": "Customer received size M instead of XL inside sealed package; provided seller hotline & closed without Ops ticket (E-08).", "handle_time_seconds": 95, "threat_to_churn": False, "qa_result": "Correct"},
]
inserted_calls = upsert("call_logs", CALLS, "call_ref")
call_map = {c["call_ref"]: c["id"] for c in inserted_calls}

TICKETS = [
    {
        "ticket_id": "INB-261124-0001", "call_log_id": call_map["CALL-261124-001"], "track": "GLOBAL_MX", "owner_queue": "Operations",
        "matrix_id": 5, "gap_code": None, "priority": "High", "priority_scale": "P2", "priority_flags": "High · Track A MX",
        "sla_due_at": ahead(1440), "sla_label": "3d ISD Global SLA", "sla_breached": False,
        "user_type": "Existing Merchant", "call_type": "Issue", "merchant_or_da_id": "CB-M-10482",
        "caller_name": "Dhaka Fashion House", "caller_phone_norm": "01711223344", "assigned_kam": "Tanvir Ahmed",
        "consignment_id": "CB982341009", "delivery_hub": "Mirpur Hub", "delivery_zone": "ISD",
        "last_parcel_status": "On Hold at Hub (51h)", "contact_reason": "Delivery Delay (parcel taking longer than expected)",
        "theme": "Stuck at hub >48h", "contact_reason_theme": "Delivery Delay › Stuck at hub >48h",
        "action_taken": "Raised Delivery Delay in Global MX & gave revised ETA",
        "issue_details": "High-value COD parcel CB982341009 stuck at Mirpur Hub for 51 hours. Customer threatens cancellation; merchant needs same-day re-attempt. [CRM: INB-261124-0001 | Caller: 01711223344 | KAM: Tanvir Ahmed]",
        "idempotency_key": "IDEMP-INB-261124-0001", "handover_status": "Accepted", "handed_over_at": ago(238),
        "global_category": "Delivery Delay", "global_sub_category": "Processing Delay", "global_issue_type": "Regular",
        "global_issue_id": "CB-24-11-0419", "global_sync_status": "PUSHED", "global_ops_status": "In Progress",
        "global_validation": "Valid", "global_ops_category": "Hub Processing Backlog",
        "global_layer1_response": "Ticket picked by Central Ops MX desk; pinged Mirpur Hub supervisor.",
        "global_layer2_response": "Mirpur Hub located parcel in cage B-4; assigned to Rider Mehedi Hasan for afternoon dispatch.",
        "global_cm_assigned": "CM-Imran (ISD)", "global_last_synced_at": ago(1),
        "crm_status": "In Progress", "reminder_at": ahead(35), "reminder_note": "Verify Layer 3 final_response scan before merchant callback",
        "assigned_agent_id": rakib["id"], "assigned_agent_name": rakib["username"], "created_by": rakib["id"], "created_by_name": rakib["username"]
    },
    {
        "ticket_id": "INB-261124-0002", "call_log_id": None, "track": "GLOBAL_MX", "owner_queue": "Operations",
        "matrix_id": 18, "gap_code": None, "priority": "Urgent", "priority_scale": "P1", "priority_flags": "Urgent · Ready for Feedback Call",
        "sla_due_at": ahead(720), "sla_label": "3d CTG Global SLA", "sla_breached": False,
        "user_type": "Existing Merchant", "call_type": "Issue", "merchant_or_da_id": "CB-M-10895",
        "caller_name": "Glow Skincare BD", "caller_phone_norm": "01614778899", "assigned_kam": "Farhana Akter",
        "consignment_id": "CB982290118", "delivery_hub": "Agrabad Hub", "delivery_zone": "CTG",
        "last_parcel_status": "Delivered (OTP Bypassed)", "contact_reason": "Breach of CLOSEBOX / POD Not Followed",
        "theme": "OTP bypassed", "contact_reason_theme": "Breach of CLOSEBOX › OTP bypassed",
        "issue_details": "Parcel CB982290118 marked Delivered at Agrabad Hub without OTP verification; customer initially reported non-receipt.",
        "idempotency_key": "IDEMP-INB-261124-0002", "handover_status": "Accepted", "handed_over_at": ago(400),
        "global_category": "Breach of CLOSEBOX", "global_sub_category": "POD Not Followed By Agent", "global_issue_type": "Critical",
        "global_issue_id": "CB-24-11-0388", "global_sync_status": "PUSHED", "global_ops_status": "Solved",
        "global_validation": "Valid", "global_ops_category": "Last Mile SOP Breach",
        "global_layer1_response": "Escalated to Agrabad Hub Manager for immediate rider verification.",
        "global_layer2_response": "Rider collected signed reception log from building security; customer Nadia Sultana confirmed parcel collected from guard desk.",
        "global_layer3_response": "Rider warned on mandatory POD OTP compliance.",
        "global_final_response": "Verified with consignee Nadia Sultana at 11:05 AM — parcel received intact from building guard desk; rider cautioned on OTP protocol.",
        "global_cm_assigned": "CM-Sadia (CTG)", "confirmed_rc_code": "RC-11", "derived_accountability": "Carrybee - Internal",
        "resolution_summary": "Verified consignee received parcel from guard desk and logged formal OTP warning on rider.",
        "resolved_by": "ops.ctg@carrybee.com", "resolved_at": ago(25),
        "crm_status": "Resolved - Awaiting Caller Confirm", "assigned_agent_id": rakib["id"], "assigned_agent_name": rakib["username"],
        "created_by": rakib["id"], "created_by_name": rakib["username"]
    },
    {
        "ticket_id": "SAMPLE-001", "call_log_id": None, "track": "STAKEHOLDER_SHEET", "owner_queue": "Business Team (KAM)",
        "matrix_id": 33, "gap_code": "G-02", "priority": "High", "priority_scale": "P2", "priority_flags": "High · KAM Callback",
        "sla_due_at": ago(20), "sla_label": "30 min (Fri 2h 30m)", "sla_breached": True,
        "user_type": "Existing Merchant", "call_type": "Request", "merchant_or_da_id": "CB-M-10482",
        "caller_name": "Dhaka Fashion House", "caller_phone_norm": "01711223344", "assigned_kam": "Tanvir Ahmed",
        "contact_reason": "Merchant Seeking KAM / Wants KAM Contact / KAM Change", "theme": "Wants KAM contact",
        "contact_reason_theme": "Merchant Seeking KAM › Wants KAM Contact",
        "issue_details": "Merchant requested callback from assigned KAM Tanvir regarding bulk pickup schedule for upcoming campaign. Promised 30-min callback.",
        "idempotency_key": "IDEMP-SAMPLE-001", "handover_status": "Handed Over", "handed_over_at": ago(50),
        "target_sheet_key": "TEAM_BUSINESS_KAM", "target_sheet_row": 2, "fallback_hub_row": 2,
        "sheet_sync_status": "SYNCED", "stakeholder_status": "Pending",
        "crm_status": "Open", "assigned_agent_id": rakib["id"], "assigned_agent_name": rakib["username"],
        "created_by": rakib["id"], "created_by_name": rakib["username"]
    },
    {
        "ticket_id": "SAMPLE-002", "call_log_id": call_map["CALL-261124-003"], "track": "STAKEHOLDER_SHEET", "owner_queue": "Tech & Product",
        "matrix_id": 31, "gap_code": "G-01", "priority": "High", "priority_scale": "P2", "priority_flags": "High · Tech Bug",
        "sla_due_at": ahead(45), "sla_label": "2 hours", "sla_breached": False,
        "user_type": "Existing Merchant", "call_type": "Issue", "merchant_or_da_id": "CB-M-10911",
        "caller_name": "Urban Gadgets BD", "caller_phone_norm": "01819554433", "assigned_kam": "Nusrat Jahan",
        "contact_reason": "System / App Issue (login, panel, bulk upload, API, tracking link)", "theme": "Bulk CSV upload failing",
        "contact_reason_theme": "System / App Issue › Bulk Upload Failing",
        "issue_details": "Merchant reports CSV bulk upload fails with 500 error since 9:00 AM today on Merchant Panel. Shared screenshot via support email; promised 2-hour Tech update.",
        "idempotency_key": "IDEMP-SAMPLE-002", "handover_status": "Accepted", "handed_over_at": ago(128),
        "target_sheet_key": "TEAM_TECH_PRODUCT", "target_sheet_row": 2, "fallback_hub_row": 3,
        "sheet_sync_status": "SYNCED", "stakeholder_status": "In Progress",
        "acknowledged_by": "tech.oncall@carrybee.com", "acknowledged_at": ago(110),
        "progress_note": "Identified timeout in bulk CSV UTF-8 parser for >200 rows; deploying hotfix now.",
        "crm_status": "In Progress", "chase_count": 1, "last_chased_at": ago(35),
        "assigned_agent_id": foysal["id"], "assigned_agent_name": foysal["username"],
        "created_by": foysal["id"], "created_by_name": foysal["username"]
    },
    {
        "ticket_id": "SAMPLE-003", "call_log_id": None, "track": "STAKEHOLDER_SHEET", "owner_queue": "Supply",
        "matrix_id": 44, "gap_code": "G-09", "priority": "Urgent", "priority_scale": "P1", "priority_flags": "Urgent · CRITICAL Safety",
        "sla_due_at": ahead(180), "sla_label": "Immediate — same day", "sla_breached": False,
        "user_type": "Delivery Agent", "call_type": "Issue", "merchant_or_da_id": "DA-419",
        "caller_name": "Md. Karim (DA-419)", "caller_phone_norm": "01912334455", "assigned_kam": "N/A",
        "consignment_id": "CB982339014", "delivery_hub": "Mirpur Hub", "delivery_zone": "ISD",
        "last_parcel_status": "Out for Delivery", "contact_reason": "Safety / Security Incident (robbery, threat, accident)",
        "theme": "Physical threat / assault", "contact_reason_theme": "Safety / Security Incident › Threat / Assault (Non-Robbery)",
        "issue_details": "Rider reported verbal threat from consignee at Mirpur 10; rider moved to safe area. Immediate Security escalation raised; Supply owns ticket.",
        "idempotency_key": "IDEMP-SAMPLE-003", "handover_status": "Accepted", "handed_over_at": ago(290),
        "target_sheet_key": "TEAM_SUPPLY_SAFETY", "target_sheet_row": 2, "fallback_hub_row": 4,
        "sheet_sync_status": "SYNCED", "stakeholder_status": "Resolved",
        "acknowledged_by": "supply.lead@carrybee.com", "acknowledged_at": ago(280),
        "confirmed_rc_code": "RC-39", "derived_accountability": "Customer",
        "resolution_summary": "Security verified rider safety, retrieved parcel to Mirpur Hub, and flagged consignee address for prepaid-only verification.",
        "resolved_by": "supply.lead@carrybee.com", "resolved_at": ago(90),
        "crm_status": "Resolved - Awaiting Caller Confirm",
        "assigned_agent_id": mahmud["id"], "assigned_agent_name": mahmud["username"],
        "created_by": mahmud["id"], "created_by_name": mahmud["username"]
    },
    {
        "ticket_id": "SAMPLE-004", "call_log_id": call_map["CALL-261124-002"], "track": "STAKEHOLDER_SHEET", "owner_queue": "Business Team (KAM)",
        "matrix_id": 34, "gap_code": "G-03", "priority": "High", "priority_scale": "P1", "priority_flags": "High · Churn Risk · REOPENED (×1)",
        "sla_due_at": ago(65), "sla_label": "30 min (Fri 2h 30m)", "sla_breached": True, "threat_to_churn": True,
        "user_type": "Existing Merchant", "call_type": "Issue", "merchant_or_da_id": "CB-M-10895",
        "caller_name": "Glow Skincare BD", "caller_phone_norm": "01614778899", "assigned_kam": "Farhana Akter",
        "contact_reason": "Complaint Against KAM (not responding, wrong info, no handover)", "theme": "KAM not responding",
        "contact_reason_theme": "Complaint Against KAM › KAM Not Responding",
        "issue_details": "Merchant says KAM has not answered calls or WhatsApp for 3 days and threatened to stop using CarryBee. Escalated to KAM Lead for same-day callback.",
        "idempotency_key": "IDEMP-SAMPLE-004", "handover_status": "Accepted", "handed_over_at": ago(178),
        "target_sheet_key": "TEAM_BUSINESS_KAM", "target_sheet_row": 3, "fallback_hub_row": 5,
        "sheet_sync_status": "SYNCED", "stakeholder_status": "In Progress",
        "acknowledged_by": "kam.lead@carrybee.com", "acknowledged_at": ago(160),
        "progress_note": "KAM Lead personally calling merchant today and assigning backup KAM coverage.",
        "confirmed_rc_code": "RC-46", "derived_accountability": "Carrybee - Internal",
        "crm_status": "Reopened", "reopened": True, "reopen_count": 1, "feedback_attempts": 1, "feedback_call_outcome": "Not solved",
        "assigned_agent_id": mahmud["id"], "assigned_agent_name": mahmud["username"],
        "created_by": mahmud["id"], "created_by_name": mahmud["username"]
    },
    {
        "ticket_id": "SAMPLE-007", "call_log_id": None, "track": "STAKEHOLDER_SHEET", "owner_queue": "Accounts",
        "matrix_id": 29, "gap_code": "G-10", "priority": "High", "priority_scale": "P2", "priority_flags": "High · Accounts EFT",
        "sla_due_at": ahead(95), "sla_label": "2 hours (Fri +2h)", "sla_breached": False,
        "user_type": "Existing Merchant", "call_type": "Inquiry", "merchant_or_da_id": "CB-M-10544",
        "caller_name": "Bengal Craft Studio", "caller_phone_norm": "01712998877", "assigned_kam": "Tanvir Ahmed",
        "consignment_id": "CB982301122", "delivery_hub": "Gulshan Hub", "delivery_zone": "ISD",
        "last_parcel_status": "Delivered", "contact_reason": "Payment When / How / Statement Inquiry",
        "theme": "EFT status check", "contact_reason_theme": "Payment / Settlement › COD Payout Delay",
        "issue_details": "Merchant reports BDT 14,850 COD payout not credited to bank account yet despite invoice showing Paid. Promised Accounts verification within 2 hours.",
        "idempotency_key": "IDEMP-SAMPLE-007", "handover_status": "Accepted", "handed_over_at": ago(80),
        "target_sheet_key": "TEAM_ACCOUNTS", "target_sheet_row": 2, "fallback_hub_row": 8,
        "sheet_sync_status": "SYNCED", "stakeholder_status": "Acknowledged",
        "acknowledged_by": "accounts.payout@carrybee.com", "acknowledged_at": ago(60),
        "progress_note": "Bank EFT batch reference #EFT-1120-884 queued with BRAC Bank; verifying credit status.",
        "confirmed_rc_code": "RC-24", "derived_accountability": "Carrybee - Internal",
        "crm_status": "Acknowledged", "assigned_agent_id": rakib["id"], "assigned_agent_name": rakib["username"],
        "created_by": rakib["id"], "created_by_name": rakib["username"]
    },
    {
        "ticket_id": "SAMPLE-008", "call_log_id": None, "track": "STAKEHOLDER_SHEET", "owner_queue": "Issue Resolution",
        "matrix_id": 35, "gap_code": "G-04", "priority": "Urgent", "priority_scale": "P1", "priority_flags": "Urgent · SLA Breached · Churn Risk",
        "sla_due_at": ago(45), "sla_label": "Same day 6:00 PM", "sla_breached": True, "threat_to_churn": True,
        "user_type": "Existing Merchant", "call_type": "Inquiry", "merchant_or_da_id": "CB-M-10205",
        "caller_name": "Dhaka Electronics Mart", "caller_phone_norm": "01811334455", "assigned_kam": "Tanvir Ahmed",
        "consignment_id": "CB982240901", "delivery_hub": "Uttara Hub", "delivery_zone": "ISD",
        "last_parcel_status": "Return In Transit", "contact_reason": "Merchant Follow-up on Previous Issue",
        "theme": "SLA breached — urgent chase", "contact_reason_theme": "Escalated Unresolved Ticket › Cross-Team SLA Breach",
        "issue_details": "Merchant called 3rd time in 48h regarding missing high-value return parcel (BDT 18,500) where Ops & Accounts pointed to each other. Escalated to Issue Resolution Team.",
        "idempotency_key": "IDEMP-SAMPLE-008", "handover_status": "Accepted", "handed_over_at": ago(300),
        "target_sheet_key": "TEAM_ISSUE_RESOLUTION", "target_sheet_row": 2, "fallback_hub_row": 9,
        "sheet_sync_status": "SYNCED", "stakeholder_status": "In Progress",
        "acknowledged_by": "ir.lead@carrybee.com", "acknowledged_at": ago(270),
        "progress_note": "Coordinating joint audit between Uttara Hub manager and Accounts claim desk.",
        "confirmed_rc_code": "RC-48", "derived_accountability": "Carrybee - Internal",
        "crm_status": "In Progress", "chase_count": 2, "last_chased_at": ago(30),
        "assigned_agent_id": mahmud["id"], "assigned_agent_name": mahmud["username"],
        "created_by": sazzad["id"], "created_by_name": sazzad["username"]
    },
]
upsert("crm_tickets", TICKETS, "ticket_id")

upsert("global_overflow_watch", [
    {"overflow_id": "OVF-261124-01", "ticket_id": "INB-261124-0001", "global_issue_id": "CB-24-11-0419", "zone": "OSD", "failure_type": "OSD_GRID_LIMIT_EXCEEDED", "issue_summary": "CB-M-10482 · CB982341009 · Sylhet/Mirpur — Written to Supabase escalations (channel='MX'), OSD Zone Sheet append failed at row 2211.", "retry_count": 3, "last_error": "Google Sheets API 400: Range exceeds grid limits (maxRows=2211 on OSD tab)", "recovery_status": "Queued (In Supabase)", "action_note": "W-1 active: Ops viewing directly in Global Web UI & CRM 60s Supabase Read-Through.", "hub_sheet_row": 2},
    {"overflow_id": "OVF-261124-02", "ticket_id": "INB-261124-0002", "global_issue_id": "CB-24-11-0388", "zone": "CTG", "failure_type": "FINAL_RESPONSE_REJECTED", "issue_summary": "CB-M-10895 · CB982290118 · Agrabad Hub — Global Sheet final_response validation rejected; CRM read directly from PostgreSQL.", "retry_count": 1, "last_error": "Global Sheet sync_log: final_response rejected by sheet validation; W-2 Supabase read-through succeeded.", "recovery_status": "Cleared", "action_note": "final_response synced into Green Callback Script box.", "hub_sheet_row": 3, "cleared_at": ago(20)},
], "overflow_id")

upsert("crm_ticket_events", [
    {"ticket_id": "INB-261124-0001", "event_type": "CREATED", "actor": "Rakib.Chowdhury", "note": "Incoming IP phone call (02:25). Raised Track A Global MX ticket."},
    {"ticket_id": "INB-261124-0001", "event_type": "PUSHED_GLOBAL", "actor": "Worker Outbox (MX)", "note": "Pushed POST /api/escalations (channel='MX') -> CB-24-11-0419 [Delivery Delay › Processing Delay]."},
    {"ticket_id": "INB-261124-0001", "event_type": "OPS_UPDATE", "actor": "Global Supabase Read-Through", "note": "Layer 2: Mirpur Hub located parcel in cage B-4; assigned Rider Mehedi Hasan."},
    {"ticket_id": "SAMPLE-004", "event_type": "REOPENED", "actor": "Mahmud.Hasan (E-16)", "note": "Feedback Call Outcome = Not solved -> Auto-reopened (×1) & reset Col T to In Progress."},
    {"ticket_id": "SAMPLE-008", "event_type": "ESCALATED_IR", "actor": "Sazzad.Haider", "note": "Escalated cross-team SLA breach to Issue Resolution sheet."},
])

upsert("audit_logs", [
    {"actor_id": sazzad["id"], "actor_name": "Sazzad.Haider", "actor_role": "Supervisor", "action": "EXPORT_CSV", "scope": "Team Issues (Inbound Desk A · UTF-8 BOM)", "row_count": 8},
    {"actor_id": prof_by_user["Sufian Official"]["id"], "actor_name": "Sufian Official", "actor_role": "Admin", "action": "SYSTEM_PROVISIONED", "scope": "Pre-Provisioned 10 Team Accounts & 5-Role RLS", "row_count": 10},
])
print("ALL SEEDING COMPLETED SUCCESSFULLY!")
