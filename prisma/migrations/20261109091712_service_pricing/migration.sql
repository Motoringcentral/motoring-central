-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "accreditation" TEXT,
ADD COLUMN     "bodyworkFromPence" INTEGER,
ADD COLUMN     "colourChangePence" INTEGER,
ADD COLUMN     "equipment" TEXT,
ADD COLUMN     "fitPerTyrePence" INTEGER,
ADD COLUMN     "kerbRepairPence" INTEGER,
ADD COLUMN     "perMilePence" INTEGER,
ADD COLUMN     "puncturePence" INTEGER,
ADD COLUMN     "valetPricesPence" INTEGER[];
