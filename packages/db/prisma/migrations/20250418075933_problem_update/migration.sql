/*
  Warnings:

  - Added the required column `functionName` to the `Problem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `returnType` to the `Problem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "args" JSONB[],
ADD COLUMN     "functionName" TEXT NOT NULL,
ADD COLUMN     "returnType" TEXT NOT NULL;
