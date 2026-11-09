-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "jobsCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "ratingAvg" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "VehicleCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reg" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleCheck_userId_reg_key" ON "VehicleCheck"("userId", "reg");

-- AddForeignKey
ALTER TABLE "VehicleCheck" ADD CONSTRAINT "VehicleCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
