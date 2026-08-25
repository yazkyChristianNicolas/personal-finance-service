/*
  Warnings:

  - Added the required column `paymentMethodId` to the `installment_plans` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "installmentNumber" INTEGER;

-- AlterTable
ALTER TABLE "installment_plans" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "paymentMethodId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "installment_plans_paymentMethodId_idx" ON "installment_plans"("paymentMethodId");

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
