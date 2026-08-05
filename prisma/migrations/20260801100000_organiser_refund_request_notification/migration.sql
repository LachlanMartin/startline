-- Organisers are told in-app when an athlete asks for a refund. Without this the
-- request only surfaced if they happened to open the Refunds tab.
ALTER TYPE "UserNotificationType" ADD VALUE 'ORGANISER_REFUND_REQUEST';
