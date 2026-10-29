/** Currencies an org can open balance accounts in / pick as default. */
export const ACCOUNT_CURRENCIES = ["EUR", "USD", "GBP"] as const;

export const REPORT_TYPES = ["transactions", "settlements", "balances", "disputes"] as const;
export const REPORT_PERIODS = ["this_month", "last_month", "this_quarter", "last_quarter", "year_to_date"] as const;
export const REPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportPeriod = (typeof REPORT_PERIODS)[number];
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const PAYMENTS_PAGE_SIZE = 25;

/** Pending report jobs older than this are shown as failed (the server stopped mid-build). */
export const STALE_REPORT_MINUTES = 10;
