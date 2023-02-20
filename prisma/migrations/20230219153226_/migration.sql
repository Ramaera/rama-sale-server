-- CreateTable
CREATE TABLE "Purchase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "coinPaymentTxnId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "currencyAmount" TEXT NOT NULL,
    "usdAmount" TEXT NOT NULL,
    "ramaWallet" TEXT NOT NULL,
    "paymentStatus" INTEGER NOT NULL DEFAULT 0,
    "isStaked" BOOLEAN NOT NULL DEFAULT false,
    "stakingHash" TEXT,
    "ramaAmount" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_coinPaymentTxnId_key" ON "Purchase"("coinPaymentTxnId");
