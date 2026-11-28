import type { EvalCase } from "../types";
import account_takeover_code from "./account-takeover-code";
import bank_fraud_check_reply from "./bank-fraud-check-reply";
import bank_new_payee_call_number from "./bank-new-payee-call-number";
import bank_spend_alert from "./bank-spend-alert";
import calendar_link_phish from "./calendar-link-phish";
import council_tax_email from "./council-tax-email";
import delivery_dpd_genuine from "./delivery-dpd-genuine";
import delivery_evri_fee_smish from "./delivery-evri-fee-smish";
import delivery_royal_mail_genuine from "./delivery-royal-mail-genuine";
import delivery_royal_mail_smish from "./delivery-royal-mail-smish";
import energy_bill_email from "./energy-bill-email";
import everyday_dentist_reminder from "./everyday-dentist-reminder";
import fake_install_command from "./fake-install-command";
import family_hi_dad_text from "./family-hi-dad-text";
import family_hi_mum_multi from "./family-hi-mum-multi";
import friend_squash_booking from "./friend-squash-booking";
import injection_lookup_redirect from "./injection-lookup-redirect";
import injection_screenshot_email from "./injection-screenshot-email";
import injection_verified_smish from "./injection-verified-smish";
import investment_signals_group from "./investment-signals-group";
import invoice_redirect_multi from "./invoice-redirect-multi";
import job_ai_eval_recruiter from "./job-ai-eval-recruiter";
import job_chain_1_approach from "./job-chain-1-approach";
import job_chain_2_move_app from "./job-chain-2-move-app";
import job_chain_3_assignment from "./job-chain-3-assignment";
import job_genuine_plain_recruiter from "./job-genuine-plain-recruiter";
import job_genuine_wallet_recruiter from "./job-genuine-wallet-recruiter";
import job_genuine_wallet_recruiter_messy from "./job-genuine-wallet-recruiter-messy";
import job_lookalike_exchange_recruiter from "./job-lookalike-exchange-recruiter";
import job_staking_recruiter from "./job-staking-recruiter";
import job_task_scam from "./job-task-scam";
import job_vc_advisor_telegram from "./job-vc-advisor-telegram";
import nhs_appointment from "./nhs-appointment";
import order_dispatched_email from "./order-dispatched-email";
import school_jumper_day from "./school-jumper-day";
import tax_customs_duty_parcel from "./tax-customs-duty-parcel";
import tax_hmrc_genuine_reminder from "./tax-hmrc-genuine-reminder";
import tax_hmrc_rebate_email_spoof from "./tax-hmrc-rebate-email-spoof";
import tax_hmrc_refund_smish from "./tax-hmrc-refund-smish";
import tax_hmrc_whatsapp_threat from "./tax-hmrc-whatsapp-threat";
import tax_social_dm_refund from "./tax-social-dm-refund";
import verification_code from "./verification-code";
import wallet_airdrop_drainer from "./wallet-airdrop-drainer";
import wrong_number_opener from "./wrong-number-opener";

export const cases: EvalCase[] = [
  account_takeover_code,
  bank_fraud_check_reply,
  bank_new_payee_call_number,
  bank_spend_alert,
  calendar_link_phish,
  council_tax_email,
  delivery_dpd_genuine,
  delivery_evri_fee_smish,
  delivery_royal_mail_genuine,
  delivery_royal_mail_smish,
  energy_bill_email,
  everyday_dentist_reminder,
  fake_install_command,
  family_hi_dad_text,
  family_hi_mum_multi,
  friend_squash_booking,
  injection_lookup_redirect,
  injection_screenshot_email,
  injection_verified_smish,
  investment_signals_group,
  invoice_redirect_multi,
  job_ai_eval_recruiter,
  job_chain_1_approach,
  job_chain_2_move_app,
  job_chain_3_assignment,
  job_genuine_plain_recruiter,
  job_genuine_wallet_recruiter,
  job_genuine_wallet_recruiter_messy,
  job_lookalike_exchange_recruiter,
  job_staking_recruiter,
  job_task_scam,
  job_vc_advisor_telegram,
  nhs_appointment,
  order_dispatched_email,
  school_jumper_day,
  tax_customs_duty_parcel,
  tax_hmrc_genuine_reminder,
  tax_hmrc_rebate_email_spoof,
  tax_hmrc_refund_smish,
  tax_hmrc_whatsapp_threat,
  tax_social_dm_refund,
  verification_code,
  wallet_airdrop_drainer,
  wrong_number_opener,
];
