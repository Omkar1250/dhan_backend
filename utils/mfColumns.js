// utils/mfColumns.js
const STAGE_MAP = {
  session4: {
    status: "rm_mf_status_session_4",
    approval: "approval_session_4",
    screenshot: "screenshot_session_4",
  },
  session19: {
    status: "rm_mf_status_session_19",
    approval: "approval_session_19",
    screenshot: "screenshot_session_19",
  },
  batchEnd: {
    status: "rm_mf_status_batch_end",
    approval: "approval_batch_end",
    screenshot: "screenshot_batch_end",
  },
  monthly: {
    status: "rm_mf_status_monthly",
    approval: "approval_monthly",
    screenshot: "screenshot_monthly",
  },
};

const VALID_STATUS = new Set([
  "interested_for_sip",
  "call_not_connect",
  "switch_off",
  "call_back",
  "think_and_let_me_know",
  "sip_done_converted",
]);

const VALID_STAGE = new Set(Object.keys(STAGE_MAP));

module.exports = { STAGE_MAP, VALID_STATUS, VALID_STAGE };
