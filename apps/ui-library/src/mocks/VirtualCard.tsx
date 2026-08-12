import { useState } from "react";
import { Button } from "@twodb/ui";
import { X, Eye, Copy, Lock, Plus } from "lucide-react";
import "./VirtualCard.css";

interface Transaction {
	id: string;
	type: "visa" | "mastercard" | "stripe" | "paypal" | "apple-pay";
	title: string;
	subtitle: string;
	amount: string;
}

const TRANSACTIONS: Transaction[] = [
	{
		id: "1",
		type: "visa",
		title: "Visa ending in 1234",
		subtitle: "Expiry 06/2024",
		amount: "+$244.00",
	},
	{
		id: "2",
		type: "mastercard",
		title: "Mastercard ending in 5678",
		subtitle: "Expiry 06/2024",
		amount: "+$326.00",
	},
	{
		id: "3",
		type: "stripe",
		title: "Stripe deposit",
		subtitle: "billing@untitledui.com",
		amount: "+$408.00",
	},
	{
		id: "4",
		type: "visa",
		title: "Visa ending in 1234",
		subtitle: "Expiry 06/2024",
		amount: "+$628.00",
	},
	{
		id: "5",
		type: "paypal",
		title: "PayPal deposit",
		subtitle: "alina@untitledui.com",
		amount: "+$166.00",
	},
	{
		id: "6",
		type: "apple-pay",
		title: "Apple Pay",
		subtitle: "molly@untitledui.com",
		amount: "+$250.00",
	},
	{
		id: "7",
		type: "visa",
		title: "Visa ending in 1234",
		subtitle: "Expiry 06/2024",
		amount: "+$144.00",
	},
];

function PaymentIcon({ type }: { type: Transaction["type"] }) {
	switch (type) {
		case "visa":
			return <span className="mock-card__payment-icon visa">VISA</span>;
		case "mastercard":
			return (
				<div className="mock-card__payment-icon mastercard">
					<div className="mastercard-circle mastercard-circle--1" />
					<div className="mastercard-circle mastercard-circle--2" />
				</div>
			);
		case "stripe":
			return <span className="mock-card__payment-icon stripe">stripe</span>;
		case "paypal":
			return (
				<div className="mock-card__payment-icon paypal">
					<svg viewBox="0 0 24 24" fill="currentColor">
						<path d="M7.053 23.525l1.43-9.06h4.283c3.596 0 5.656-1.728 6.256-5.52.54-3.416-.72-5.976-4.08-7.14C13.786 1.405 12.386 1.2 10.666 1.2H4.906a1.2 1.2 0 0 0-1.184 1.005l-2.64 16.72a1.2 1.2 0 0 0 1.184 1.4h4.787z" />
					</svg>
				</div>
			);
		case "apple-pay":
			return (
				<div className="mock-card__payment-icon apple-pay">
					<svg viewBox="0 0 24 24" fill="currentColor">
						<path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
					</svg>
				</div>
			);
		default:
			return null;
	}
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
	return (
		<div className="mock-card__transaction">
			<PaymentIcon type={transaction.type} />
			<div className="mock-card__transaction-info">
				<span className="mock-card__transaction-title">
					{transaction.title}
				</span>
				<span className="mock-card__transaction-subtitle">
					{transaction.subtitle}
				</span>
			</div>
			<span className="mock-card__transaction-amount">
				{transaction.amount}
			</span>
		</div>
	);
}

export function VirtualCardMock() {
	const [activeTab, setActiveTab] = useState<
		"all" | "transactions" | "deposits" | "transfers"
	>("deposits");
	const [cardEnabled, setCardEnabled] = useState(true);

	const tabs = [
		{ id: "all", label: "View all" },
		{ id: "transactions", label: "Transactions" },
		{ id: "deposits", label: "Deposits" },
		{ id: "transfers", label: "Transfers" },
	] as const;

	return (
		<div className="mock-card">
			<div className="mock-card__wash mock-card__wash--a" />
			<div className="mock-card__wash mock-card__wash--b" />

			<div className="mock-card__dialog">
				{/* Header */}
				<div className="mock-card__header">
					<div>
						<h2 className="mock-card__title">Virtual card</h2>
						<p className="mock-card__description">
							Virtual cards are a safer way to pay online.
						</p>
					</div>
					<button
						className="mock-card__close"
						type="button"
						aria-label="Close dialog"
					>
						<X size={20} />
					</button>
				</div>

				{/* Virtual Card */}
				<div className="mock-card__card-wrapper">
					<div className="mock-card__virtual-card">
						<div className="mock-card__card-top">
							<div className="mock-card__card-logo">
								<svg
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="currentColor"
								>
									<path d="M12.0001 2.00024L16.0001 6.00024L12.0001 10.0002L8.00012 6.00024L12.0001 2.00024ZM12.0001 14.0002L16.0001 18.0002L12.0001 22.0002L8.00012 18.0002L12.0001 14.0002ZM4.00012 6.00024L8.00012 10.0002L4.00012 14.0002L2.00012e-05 10.0002L4.00012 6.00024ZM20.0001 10.0002L16.0001 14.0002L20.0001 18.0002L24.0001 14.0002L20.0001 10.0002Z" />
								</svg>
								<span>Untitled UI</span>
							</div>
							<span className="mock-card__card-type">Virtual Card</span>
							<div className="mock-card__card-contactless">
								<svg
									width="24"
									height="24"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path
										d="M8.5 10.5C8.5 10.5 9.5 10.5 10.5 11.5C11.5 12.5 11.5 13.5 11.5 13.5"
										strokeLinecap="round"
									/>
									<path
										d="M11.5 8.5C11.5 8.5 13 8.5 14.5 10C16 11.5 16 13.5 16 13.5"
										strokeLinecap="round"
									/>
									<path
										d="M14.5 5.5C14.5 5.5 17 5.5 19 7.5C21 9.5 21 12.5 21 12.5"
										strokeLinecap="round"
									/>
								</svg>
							</div>
						</div>
						<div className="mock-card__card-bottom">
							<div className="mock-card__card-info">
								<span className="mock-card__card-name">MIA DI SILVA</span>
								<span className="mock-card__card-expiry">06/24</span>
							</div>
							<div className="mock-card__card-number">1234 1234 1234 1234</div>
							<button
								type="button"
								className={`mock-card__card-toggle ${cardEnabled ? "is-enabled" : ""}`}
								onClick={() => setCardEnabled(!cardEnabled)}
								aria-label={cardEnabled ? "Disable card" : "Enable card"}
							>
								<div className="mock-card__card-toggle-track">
									<div className="mock-card__card-toggle-thumb" />
								</div>
							</button>
						</div>
					</div>
				</div>

				{/* Card Actions */}
				<div className="mock-card__actions">
					<button type="button" className="mock-card__action-btn">
						<Eye size={16} />
						<span>Card details</span>
					</button>
					<button type="button" className="mock-card__action-btn">
						<Copy size={16} />
						<span>Copy to clipboard</span>
					</button>
				</div>

				{/* Tabs */}
				<div className="mock-card__tabs">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							className={`mock-card__tab ${activeTab === tab.id ? "is-active" : ""}`}
							onClick={() => setActiveTab(tab.id)}
						>
							{tab.label}
						</button>
					))}
				</div>

				{/* Transaction List */}
				<div className="mock-card__transactions">
					{TRANSACTIONS.map((transaction) => (
						<TransactionRow key={transaction.id} transaction={transaction} />
					))}
				</div>

				{/* Footer */}
				<div className="mock-card__footer">
					<Button size="sm" variant="ghost">
						Close
					</Button>
					<div className="mock-card__footer-actions">
						<Button size="sm" variant="secondary">
							<Lock size={14} style={{ marginRight: 6 }} />
							Lock card
						</Button>
						<Button size="sm" variant="primary">
							<Plus size={14} style={{ marginRight: 6 }} />
							New transfer
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
