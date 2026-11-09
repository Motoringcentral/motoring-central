-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'PARTNER', 'DEALER', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('MOBILE_MECHANIC', 'GARAGE', 'AUTO_ELECTRICIAN', 'RECOVERY', 'TYRE_FITTER', 'VALETER', 'BODYWORK', 'MOBILE_EV_CHARGING');

-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PartnerPlan" AS ENUM ('PAY_AS_YOU_GO', 'PRO');

-- CreateEnum
CREATE TYPE "WorkLocation" AS ENUM ('MOBILE', 'WORKSHOP', 'BOTH');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('TRADE_INSURANCE', 'PUBLIC_LIABILITY', 'PHOTO_ID', 'INSURER_APPROVAL', 'EQUIPMENT_TEST_CERTIFICATE', 'SPRAY_PERMIT', 'WORK_PHOTOS', 'COMPANY_REGISTRATION');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ServiceMode" AS ENUM ('MOBILE_MECHANIC', 'GARAGE', 'AUTO_ELECTRICIAN', 'RECOVERY', 'MOBILE_TYRES', 'VALET', 'BODYWORK', 'ALLOY_WHEELS', 'EV_CHARGING');

-- CreateEnum
CREATE TYPE "PartsQuality" AS ENUM ('BUDGET', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BayKind" AS ENUM ('WORKSHOP', 'MOT');

-- CreateEnum
CREATE TYPE "DiaryStatus" AS ENUM ('BOOKED', 'ARRIVED', 'IN_PROGRESS', 'READY', 'COLLECTED');

-- CreateEnum
CREATE TYPE "DealerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DealerPlan" AS ENUM ('STARTER', 'STANDARD', 'PLUS', 'PRO', 'PREMIER');

-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('CAR', 'VAN');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'LIVE', 'RESERVED', 'SOLD', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('LIVE', 'SOLD', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "QuoteRequestStatus" AS ENUM ('OPEN', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "phone" TEXT,
    "postcode" TEXT,
    "remindersOptIn" BOOLEAN NOT NULL DEFAULT false,
    "fullChecksLeft" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PartnerType" NOT NULL,
    "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING',
    "plan" "PartnerPlan" NOT NULL DEFAULT 'PAY_AS_YOU_GO',
    "businessName" TEXT NOT NULL,
    "addressLine1" TEXT,
    "town" TEXT,
    "postcode" TEXT NOT NULL,
    "workLocation" "WorkLocation" NOT NULL DEFAULT 'MOBILE',
    "travelRadiusMiles" INTEGER,
    "labourRatePence" INTEGER,
    "workshopBays" INTEGER,
    "isMotStation" BOOLEAN NOT NULL DEFAULT false,
    "motBays" INTEGER,
    "motFeePence" INTEGER,
    "openingHours" JSONB,
    "skills" TEXT[],
    "qualifications" TEXT,
    "bodyworkServices" BOOLEAN NOT NULL DEFAULT false,
    "alloyServices" BOOLEAN NOT NULL DEFAULT false,
    "insuranceApproved" BOOLEAN NOT NULL DEFAULT false,
    "insurerPanels" TEXT[],
    "warrantyMonths" INTEGER,
    "alloyRefurbPence" INTEGER,
    "diamondCutPence" INTEGER,
    "callOutPence" INTEGER,
    "perMileOutsidePence" INTEGER,
    "chargingVans" TEXT,
    "availability" TEXT,
    "connectors" TEXT[],
    "stripeAccountId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerDocument" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "reg" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT,
    "year" INTEGER,
    "fuel" TEXT,
    "engineCc" INTEGER,
    "transmission" TEXT,
    "colour" TEXT,
    "tyreSize" TEXT,
    "motExpiry" TIMESTAMP(3),
    "fullCheckData" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "mode" "ServiceMode" NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "partsQuality" "PartsQuality",
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "postcode" TEXT,
    "partsPence" INTEGER NOT NULL DEFAULT 0,
    "labourPence" INTEGER NOT NULL DEFAULT 0,
    "bookingFeePence" INTEGER NOT NULL,
    "totalPence" INTEGER NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "bookingId" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryBay" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "BayKind" NOT NULL DEFAULT 'WORKSHOP',
    "position" INTEGER NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DiaryBay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "bayId" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "isBlock" BOOLEAN NOT NULL DEFAULT false,
    "reg" TEXT,
    "vehicle" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "job" TEXT,
    "pricePence" INTEGER,
    "notes" TEXT,
    "status" "DiaryStatus" NOT NULL DEFAULT 'BOOKED',
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dealer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DealerStatus" NOT NULL DEFAULT 'PENDING',
    "plan" "DealerPlan" NOT NULL DEFAULT 'STARTER',
    "trialEndsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "website" TEXT,
    "freePremiumAdsUsed" INTEGER NOT NULL DEFAULT 0,
    "addressLine1" TEXT,
    "town" TEXT,
    "postcode" TEXT NOT NULL,
    "phone" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "freeTradeListingsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dealer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleListing" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "kind" "ListingKind" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "reg" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "mileage" INTEGER NOT NULL,
    "fuel" TEXT,
    "transmission" TEXT,
    "colour" TEXT,
    "pricePence" INTEGER NOT NULL,
    "description" TEXT,
    "photos" TEXT[],
    "costPence" INTEGER,
    "prepCosts" JSONB,
    "soldPence" INTEGER,
    "soldAt" TIMESTAMP(3),
    "premiumUntil" TIMESTAMP(3),
    "boostUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'LIVE',
    "kind" "ListingKind" NOT NULL,
    "reg" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "mileage" INTEGER NOT NULL,
    "knownFaults" TEXT NOT NULL,
    "sellerNotes" TEXT,
    "photos" TEXT[],
    "buyNowPence" INTEGER,
    "minOfferPence" INTEGER,
    "soldAsSeenAt" TIMESTAMP(3) NOT NULL,
    "feePaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOffer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "asBusinessAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallbackRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallbackRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reg" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photos" TEXT[],
    "postcode" TEXT NOT NULL,
    "insuranceClaim" BOOLEAN NOT NULL DEFAULT false,
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteRequestRecipient" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,

    CONSTRAINT "QuoteRequestRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyworkQuote" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "pricePence" INTEGER NOT NULL,
    "notes" TEXT,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyworkQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_userId_key" ON "Partner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_stripeAccountId_key" ON "Partner"("stripeAccountId");

-- CreateIndex
CREATE INDEX "Partner_type_status_idx" ON "Partner"("type", "status");

-- CreateIndex
CREATE INDEX "Partner_postcode_idx" ON "Partner"("postcode");

-- CreateIndex
CREATE INDEX "PartnerDocument_partnerId_kind_idx" ON "PartnerDocument"("partnerId", "kind");

-- CreateIndex
CREATE INDEX "PartnerDocument_status_idx" ON "PartnerDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_reg_key" ON "Vehicle"("reg");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_ref_key" ON "Booking"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_stripePaymentIntentId_key" ON "Booking"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE INDEX "Booking_partnerId_scheduledStart_idx" ON "Booking"("partnerId", "scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "TermsAcceptance_bookingId_key" ON "TermsAcceptance"("bookingId");

-- CreateIndex
CREATE INDEX "TermsAcceptance_userId_idx" ON "TermsAcceptance"("userId");

-- CreateIndex
CREATE INDEX "DiaryBay_partnerId_idx" ON "DiaryBay"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "DiaryEntry_bookingId_key" ON "DiaryEntry"("bookingId");

-- CreateIndex
CREATE INDEX "DiaryEntry_bayId_start_idx" ON "DiaryEntry"("bayId", "start");

-- CreateIndex
CREATE INDEX "DiaryEntry_partnerId_start_idx" ON "DiaryEntry"("partnerId", "start");

-- CreateIndex
CREATE UNIQUE INDEX "Dealer_userId_key" ON "Dealer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Dealer_stripeCustomerId_key" ON "Dealer"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Dealer_stripeSubscriptionId_key" ON "Dealer"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "VehicleListing_kind_status_idx" ON "VehicleListing"("kind", "status");

-- CreateIndex
CREATE INDEX "VehicleListing_dealerId_idx" ON "VehicleListing"("dealerId");

-- CreateIndex
CREATE INDEX "Enquiry_listingId_idx" ON "Enquiry"("listingId");

-- CreateIndex
CREATE INDEX "TradeListing_status_idx" ON "TradeListing"("status");

-- CreateIndex
CREATE INDEX "TradeOffer_listingId_idx" ON "TradeOffer"("listingId");

-- CreateIndex
CREATE INDEX "TradeOffer_buyerId_idx" ON "TradeOffer"("buyerId");

-- CreateIndex
CREATE INDEX "AuditLog_subject_idx" ON "AuditLog"("subject");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRequestRecipient_requestId_partnerId_key" ON "QuoteRequestRecipient"("requestId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "BodyworkQuote_recipientId_key" ON "BodyworkQuote"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "BodyworkQuote_bookingId_key" ON "BodyworkQuote"("bookingId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerDocument" ADD CONSTRAINT "PartnerDocument_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerDocument" ADD CONSTRAINT "PartnerDocument_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryBay" ADD CONSTRAINT "DiaryBay_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_bayId_fkey" FOREIGN KEY ("bayId") REFERENCES "DiaryBay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dealer" ADD CONSTRAINT "Dealer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleListing" ADD CONSTRAINT "VehicleListing_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "VehicleListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeListing" ADD CONSTRAINT "TradeListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "TradeListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequestRecipient" ADD CONSTRAINT "QuoteRequestRecipient_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequestRecipient" ADD CONSTRAINT "QuoteRequestRecipient_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyworkQuote" ADD CONSTRAINT "BodyworkQuote_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "QuoteRequestRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyworkQuote" ADD CONSTRAINT "BodyworkQuote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
