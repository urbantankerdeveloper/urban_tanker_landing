import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Tag, WalletCards, X } from "lucide-react";
import { Button } from "../../shared/components/ui";
import { money } from "../../shared/data/demo";
import type { CouponContent } from "../../shared/lib/content";
import { useApi } from "../../shared/hooks/useApi";
import { useAppStore } from "../../app/store";

interface PaymentOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}
interface PaymentVerificationResponse {
  verified: boolean;
  paymentId: string;
  orderId: string;
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Unable to load Razorpay Checkout."));
    document.body.appendChild(script);
  });
}

export function CheckoutModal() {
  const {
    data,
    checkoutMethod: method,
    setCheckoutMethod: setMethod,
    completeBooking: onComplete,
    setCheckoutOpen,
  } = useAppStore();
  const coupons = useAppStore((state) => state.content.coupons) as CouponContent[];
  const copy = useAppStore((state) => state.content.checkout);
  const paymentsApi = useApi("razorpay-payment");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponContent | null>(null);
  const [step, setStep] = useState<"review" | "payment">("review");
  const onClose = () => {
    if (!busy) setCheckoutOpen(false);
  };
  const details = data.pendingBooking ?? data.booking;
  const hasPreviousBooking = Boolean(
    data.profile &&
    data.orders.some((order) => order.customer === data.profile?.name),
  );
  const eligibleCoupons = coupons.filter(
    (coupon) =>
      (!coupon.service || coupon.service === details.service) &&
      !(coupon.firstBooking && hasPreviousBooking),
  );
  const baseAmount =
    "amount" in details && typeof details.amount === "number"
      ? details.amount
      : 0;
  const discount = appliedCoupon
    ? Math.min(
      appliedCoupon.discount > 0 && appliedCoupon.discount < 100
        ? Math.round((baseAmount * appliedCoupon.discount) / 100)
        : appliedCoupon.discount,
      baseAmount,
    )
    : 0;
  const amount = Math.max(0, baseAmount - discount);
  const complete = (payment: string) =>
    onComplete({
      id: `AF-${String(Date.now()).slice(-6)}`,
      service: details.service,
      capacity: details.capacity,
      address: details.address,
      customer: data.profile?.name || "Urban Tanker customer",
      customerEmail: data.profile?.email,
      amount,
      discount,
      couponCode: appliedCoupon?.code,
      status: "Vendor assigned",
      vendor: "BlueDrop Tankers",
      driver: "Ravi Kumar",
      eta: "35 min",
      payment,
      created: "Just now",
    });
  const applyCouponCode = (value: string) => {
    const code = value.trim().toUpperCase();
    const coupon = coupons.find((item) => item.code === code);
    const alreadyBooked = Boolean(
      coupon?.firstBooking &&
      data.profile &&
      data.orders.some((order) => order.customer === data.profile?.name),
    );
    if (
      !coupon ||
      (coupon.service && coupon.service !== details.service) ||
      alreadyBooked
    ) {
      setAppliedCoupon(null);
      setError(
        alreadyBooked
          ? "This first-booking offer has already been used."
          : "That coupon is not valid for this service.",
      );
      return;
    }
    setAppliedCoupon(coupon);
    setCouponCode(coupon.code);
    setError("");
  };
  const applyCoupon = () => applyCouponCode(couponCode);
  const selectCoupon = (code: string) => {
    setCouponCode(code);
    setAppliedCoupon(null);
    setError("");
  };
  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setError("");
  };
  const pay = async () => {
    setError("");
    if (method === "Cash") {
      complete("Due on delivery");
      return;
    }
    setBusy(true);
    try {
      const order = await paymentsApi.post<PaymentOrderResponse>(
        "/createRazorpayOrder",
        {
          amount: Math.round(amount * 100),
          receipt: `urban-tanker-${Date.now()}`,
        },
      );
      await loadRazorpay();
      if (!window.Razorpay)
        throw new Error("Razorpay Checkout is unavailable.");
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Urban Tanker",
        description: `${details.service} · ${details.capacity}`,
        order_id: order.orderId,
        prefill: { name: data.profile?.name, email: data.profile?.email },
        theme: { color: "#0b8c96" },
        handler: async (payment) => {
          try {
            const verification =
              await paymentsApi.post<PaymentVerificationResponse>(
                "/verifyRazorpayPayment",
                {
                  razorpayOrderId: payment.razorpay_order_id,
                  razorpayPaymentId: payment.razorpay_payment_id,
                  razorpaySignature: payment.razorpay_signature,
                },
              );
            if (!verification.verified)
              throw new Error("Payment verification failed.");
            complete("Paid");
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Payment verification failed.",
            );
          } finally {
            setBusy(false);
          }
        },
      });
      checkout.open();
    } catch (cause) {
      setBusy(false);
      setError(
        cause instanceof Error ? cause.message : "Unable to start payment.",
      );
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close checkout"
          disabled={busy}
        >
          <X size={18} />
        </button>
        <span className="eyebrow">
          {step === "review" ? copy.reviewEyebrow : copy.paymentEyebrow}
        </span>
        <h2 id="checkout-title">
          {step === "review" ? copy.reviewTitle : copy.paymentTitle}
        </h2>
        <p className="modal-copy">
          {step === "review"
            ? copy.reviewDescription
            : copy.paymentDescription}
        </p>
        {step === "review" && <div className="checkout-step checkout-step-review">
          <div className="checkout-summary">
            <div>
              <span>{copy.serviceLabel}</span>
              <b>{details.service}</b>
            </div>
            <div>
              <span>{copy.capacityLabel}</span>
              <b>{details.capacity}</b>
            </div>
            <div>
              <span>{copy.deliveryLabel}</span>
              <b>{details.address}</b>
            </div>
            {discount > 0 && (
              <div>
                <span>{copy.discountLabel} · {appliedCoupon?.code}</span>
                <span className="discount-actions">
                  <strong className="discount-value">-{money(discount)}</strong>
                  <button
                    className="coupon-remove"
                    type="button"
                    onClick={removeCoupon}
                    aria-label={copy.removeCoupon}
                    title={copy.removeCoupon}
                    disabled={busy}
                  >
                    <X size={13} />
                  </button>
                </span>
              </div>
            )}
            <div className="summary-total">
              <span>{copy.totalLabel}</span>
              <strong>{money(amount)}</strong>
            </div>
          </div>
          <div className="coupon-entry">
            <label htmlFor="checkout-coupon">{copy.couponLabel}</label>
            <div>
              <Tag size={16} />
              <input
                id="checkout-coupon"
                value={couponCode}
                onChange={(event) => {
                  setCouponCode(event.target.value);
                  setAppliedCoupon(null);
                  setError("");
                }}
                placeholder={copy.couponPlaceholder}
                disabled={busy}
              />
              {couponCode.trim() && !appliedCoupon && (
                <button type="button" onClick={applyCoupon} disabled={busy}>
                  {copy.couponApply}
                </button>
              )}
            </div>
            <div className="coupon-offers" aria-label="Available coupon codes">
              {eligibleCoupons.map((coupon) => {
                return (
                  <article className="coupon-offer" key={coupon.code}>
                    <div>
                      <strong>{coupon.code}</strong>
                      <span>{coupon.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectCoupon(coupon.code)}
                      disabled={busy}
                      aria-pressed={couponCode === coupon.code && !appliedCoupon}
                    >
                      {couponCode === coupon.code && !appliedCoupon
                        ? copy.couponSelected
                        : copy.couponSelect}
                    </button>
                  </article>
                );
              })}
            </div>
            <small>
              {appliedCoupon
                ? `${appliedCoupon.code} ${copy.couponApplied} ${money(discount)}.`
                : copy.couponPrompt}
            </small>
          </div>
          <Button
            variant="primary full"
            onClick={() => setStep("payment")}
            disabled={busy}
          >
            {copy.continuePayment} <ArrowRight size={16} />
          </Button>
        </div>}
        {step === "payment" && <div className="checkout-step checkout-step-payment">
          <div className="payment-review-total"><span>{copy.totalToPay}</span><strong>{money(amount)}</strong></div>
          <Button
            variant="quiet full"
            icon={ArrowLeft}
            onClick={() => setStep("review")}
            disabled={busy}
          >
            {copy.backToReview}
          </Button>
          <fieldset className="payment-options">
            <legend>{copy.payment}</legend>
            {["UPI", "Card", "Cash"].map((option) => (
              <button
                type="button"
                key={option}
                className={method === option ? "selected" : ""}
                aria-pressed={method === option}
                onClick={() => setMethod(option)}
                disabled={busy}
              >
                <WalletCards size={16} />
                <span>{option === "Cash" ? copy.cashOnDelivery : option}</span>
                {method === option && <Check size={15} />}
              </button>
            ))}
          </fieldset>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <Button
            variant="primary full"
            onClick={() => void pay()}
            disabled={busy}
          >
            {busy
              ? copy.processing
              : method === "Cash"
                ? copy.confirmBooking
                : copy.pay}{" "}
            <ArrowRight size={16} />
          </Button>
          <small className="modal-note">
            Online payments are securely processed and verified by Razorpay.
          </small>
        </div>}
      </section>
    </div>
  );
}
