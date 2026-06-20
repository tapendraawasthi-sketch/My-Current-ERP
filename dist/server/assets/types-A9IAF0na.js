//#region src/lib/types.ts
var AccountType = /* @__PURE__ */ function(AccountType) {
	AccountType["ASSET"] = "asset";
	AccountType["LIABILITY"] = "liability";
	AccountType["EQUITY"] = "equity";
	AccountType["INCOME"] = "income";
	AccountType["EXPENSE"] = "expense";
	return AccountType;
}({});
var AccountLevel = /* @__PURE__ */ function(AccountLevel) {
	AccountLevel["GROUP"] = "group";
	AccountLevel["SUBGROUP"] = "subgroup";
	AccountLevel["LEDGER"] = "ledger";
	AccountLevel["SUBLEDGER"] = "subledger";
	return AccountLevel;
}({});
var VoucherStatus = /* @__PURE__ */ function(VoucherStatus) {
	VoucherStatus["DRAFT"] = "draft";
	VoucherStatus["POSTED"] = "posted";
	VoucherStatus["CANCELLED"] = "cancelled";
	return VoucherStatus;
}({});
var VoucherType = /* @__PURE__ */ function(VoucherType) {
	VoucherType["JOURNAL"] = "journal";
	VoucherType["PAYMENT"] = "payment";
	VoucherType["RECEIPT"] = "receipt";
	VoucherType["CONTRA"] = "contra";
	VoucherType["SALES_INVOICE"] = "sales-invoice";
	VoucherType["PURCHASE_INVOICE"] = "purchase-invoice";
	VoucherType["SALES_RETURN"] = "sales-return";
	VoucherType["PURCHASE_RETURN"] = "purchase-return";
	VoucherType["DEBIT_NOTE"] = "debit-note";
	VoucherType["CREDIT_NOTE"] = "credit-note";
	VoucherType["STOCK_JOURNAL"] = "stock-journal";
	VoucherType["OPENING_BALANCE"] = "opening-balance";
	return VoucherType;
}({});
var PartyType = /* @__PURE__ */ function(PartyType) {
	PartyType["CUSTOMER"] = "customer";
	PartyType["SUPPLIER"] = "supplier";
	PartyType["BOTH"] = "both";
	return PartyType;
}({});
var ItemType = /* @__PURE__ */ function(ItemType) {
	ItemType["PRODUCT"] = "product";
	ItemType["SERVICE"] = "service";
	return ItemType;
}({});
var PaymentMode = /* @__PURE__ */ function(PaymentMode) {
	PaymentMode["CASH"] = "cash";
	PaymentMode["BANK"] = "bank";
	PaymentMode["BANK_TRANSFER"] = "bank";
	PaymentMode["CREDIT"] = "credit";
	return PaymentMode;
}({});
var PaymentStatus = /* @__PURE__ */ function(PaymentStatus) {
	PaymentStatus["PAID"] = "paid";
	PaymentStatus["UNPAID"] = "unpaid";
	PaymentStatus["PARTIAL"] = "partial";
	return PaymentStatus;
}({});
var UserRole = /* @__PURE__ */ function(UserRole) {
	UserRole["ADMIN"] = "admin";
	UserRole["ACCOUNTANT"] = "accountant";
	UserRole["VIEWER"] = "viewer";
	UserRole["MANAGER"] = "manager";
	return UserRole;
}({});
var DateFormat = /* @__PURE__ */ function(DateFormat) {
	DateFormat["BS"] = "BS";
	DateFormat["AD"] = "AD";
	return DateFormat;
}({});
var StockValuationMethod = /* @__PURE__ */ function(StockValuationMethod) {
	StockValuationMethod["FIFO"] = "fifo";
	StockValuationMethod["WEIGHTED_AVERAGE"] = "weighted-average";
	StockValuationMethod["LIFO"] = "lifo";
	return StockValuationMethod;
}({});
var TdsType = /* @__PURE__ */ function(TdsType) {
	TdsType["CONTRACTOR"] = "contractor";
	TdsType["SERVICE_CONTRACT"] = "contractor";
	TdsType["CONSULTANCY"] = "consultancy";
	TdsType["RENT"] = "rent";
	TdsType["HOUSE_RENT"] = "rent";
	TdsType["SALARY"] = "salary";
	TdsType["DIVIDEND"] = "dividend";
	TdsType["COMMISSION"] = "commission";
	TdsType["OTHER"] = "other";
	TdsType["NONE"] = "none";
	return TdsType;
}({});
var OrderStatus = /* @__PURE__ */ function(OrderStatus) {
	OrderStatus["DRAFT"] = "draft";
	OrderStatus["APPROVED"] = "approved";
	OrderStatus["FULFILLED"] = "fulfilled";
	OrderStatus["PARTIAL"] = "partial";
	OrderStatus["CANCELLED"] = "cancelled";
	return OrderStatus;
}({});
var ChallanStatus = /* @__PURE__ */ function(ChallanStatus) {
	ChallanStatus["DRAFT"] = "draft";
	ChallanStatus["DISPATCHED"] = "dispatched";
	ChallanStatus["RECEIVED"] = "received";
	ChallanStatus["CANCELLED"] = "cancelled";
	return ChallanStatus;
}({});
var BudgetPeriod = /* @__PURE__ */ function(BudgetPeriod) {
	BudgetPeriod["MONTHLY"] = "monthly";
	BudgetPeriod["QUARTERLY"] = "quarterly";
	BudgetPeriod["YEARLY"] = "yearly";
	return BudgetPeriod;
}({});
var FiscalYearStatus = /* @__PURE__ */ function(FiscalYearStatus) {
	FiscalYearStatus["ACTIVE"] = "active";
	FiscalYearStatus["CLOSED"] = "closed";
	FiscalYearStatus["FUTURE"] = "future";
	return FiscalYearStatus;
}({});
var MovementType = /* @__PURE__ */ function(MovementType) {
	MovementType["PURCHASE"] = "purchase";
	MovementType["SALES"] = "sales";
	MovementType["SALES_RETURN"] = "sales-return";
	MovementType["PURCHASE_RETURN"] = "purchase-return";
	MovementType["TRANSFER_IN"] = "transfer-in";
	MovementType["TRANSFER_OUT"] = "transfer-out";
	MovementType["OPENING"] = "opening";
	MovementType["ADJUSTMENT"] = "adjustment";
	return MovementType;
}({});
var ReportPeriodPreset = /* @__PURE__ */ function(ReportPeriodPreset) {
	ReportPeriodPreset["TODAY"] = "today";
	ReportPeriodPreset["WEEK"] = "week";
	ReportPeriodPreset["MONTH"] = "month";
	ReportPeriodPreset["QUARTER"] = "quarter";
	ReportPeriodPreset["FY"] = "fy";
	ReportPeriodPreset["CUSTOM"] = "custom";
	return ReportPeriodPreset;
}({});
var RecurringFrequency = /* @__PURE__ */ function(RecurringFrequency) {
	RecurringFrequency["DAILY"] = "daily";
	RecurringFrequency["WEEKLY"] = "weekly";
	RecurringFrequency["MONTHLY"] = "monthly";
	RecurringFrequency["QUARTERLY"] = "quarterly";
	RecurringFrequency["YEARLY"] = "yearly";
	return RecurringFrequency;
}({});
//#endregion
export { UserRole as _, DateFormat as a, MovementType as c, PaymentMode as d, PaymentStatus as f, TdsType as g, StockValuationMethod as h, ChallanStatus as i, OrderStatus as l, ReportPeriodPreset as m, AccountType as n, FiscalYearStatus as o, RecurringFrequency as p, BudgetPeriod as r, ItemType as s, AccountLevel as t, PartyType as u, VoucherStatus as v, VoucherType as y };
