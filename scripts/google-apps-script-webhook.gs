/**
 * Carrybee InboundIQ — Google Apps Script Webhook (PRD v3.2 Appendix D)
 * Install as an Installable onEdit(e) trigger on each of the 6 Track B Stakeholder Team Sheets:
 *   02 Business Team (KAM), 03 Tech & Product, 04 Accounts,
 *   05 Activation, 06 Supply & Safety, 07 Issue Resolution.
 */

const CRM_WEBHOOK_URL = 'https://cb-inbound-iq.workers.dev/api/webhooks/stakeholder-sheet';
const WEBHOOK_SECRET = 'REPLACE_WITH_SHEETS_WEBHOOK_HMAC_SECRET';
const EDITABLE_START_COL = 20; // Column T (Stakeholder Status)
const EDITABLE_END_COL = 27;   // Column AA (Resolved By)

function onStakeholderEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== 'Issues') return;

  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row < 2 || col < EDITABLE_START_COL || col > EDITABLE_END_COL) return;

  const rowValues = sheet.getRange(row, 1, 1, 29).getDisplayValues()[0];
  const issueId = rowValues[0];
  if (!issueId) return;

  const status = (rowValues[19] || '').trim();           // Col T
  const rootCause = (rowValues[23] || '').trim();        // Col X (RC-01..RC-64)
  const resolutionSummary = (rowValues[25] || '').trim();// Col Z

  // Client-side Hard Closure Gate warning (Server enforces too)
  if (status === 'Resolved' && (!rootCause || resolutionSummary.length < 20)) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Hard Closure Gate: Select Confirmed Root Cause (Col X: RC-01..RC-64) and enter ≥20 chars in Col Z before marking Resolved.',
      'Carrybee InboundIQ Validation',
      8
    );
  }

  const payload = {
    issue_id: issueId,
    source_team_sheet: SpreadsheetApp.getActiveSpreadsheet().getName(),
    spreadsheet_id: SpreadsheetApp.getActiveSpreadsheet().getId(),
    row_number: row,
    edited_by: Session.getActiveUser().getEmail() || 'stakeholder_sheet_editor',
    values: rowValues,
  };

  UrlFetchApp.fetch(CRM_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-CarryBee-Secret': WEBHOOK_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}
