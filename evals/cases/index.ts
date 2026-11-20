import type { EvalCase } from "../types";
import delivery_royal_mail_genuine from "./delivery-royal-mail-genuine";
import delivery_royal_mail_smish from "./delivery-royal-mail-smish";
import everyday_dentist_reminder from "./everyday-dentist-reminder";
import family_hi_mum_multi from "./family-hi-mum-multi";
import injection_verified_smish from "./injection-verified-smish";
import job_ai_eval_recruiter from "./job-ai-eval-recruiter";
import job_genuine_wallet_recruiter from "./job-genuine-wallet-recruiter";
import job_genuine_wallet_recruiter_messy from "./job-genuine-wallet-recruiter-messy";
import job_staking_recruiter from "./job-staking-recruiter";
import job_vc_advisor_telegram from "./job-vc-advisor-telegram";
import tax_hmrc_genuine_reminder from "./tax-hmrc-genuine-reminder";
import tax_hmrc_refund_smish from "./tax-hmrc-refund-smish";

export const cases: EvalCase[] = [
  delivery_royal_mail_genuine,
  delivery_royal_mail_smish,
  everyday_dentist_reminder,
  family_hi_mum_multi,
  injection_verified_smish,
  job_ai_eval_recruiter,
  job_genuine_wallet_recruiter,
  job_genuine_wallet_recruiter_messy,
  job_staking_recruiter,
  job_vc_advisor_telegram,
  tax_hmrc_genuine_reminder,
  tax_hmrc_refund_smish,
];
