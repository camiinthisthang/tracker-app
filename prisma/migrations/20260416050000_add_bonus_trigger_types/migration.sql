-- Add new bonus trigger types for referral-based bonuses
ALTER TYPE "BonusTrigger" ADD VALUE IF NOT EXISTS 'REFERRAL_COUNT';
ALTER TYPE "BonusTrigger" ADD VALUE IF NOT EXISTS 'USER_DOWNLOAD';
ALTER TYPE "BonusTrigger" ADD VALUE IF NOT EXISTS 'USER_PAID_PLAN';
