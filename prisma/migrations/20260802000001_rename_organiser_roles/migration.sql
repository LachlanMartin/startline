-- Rename organiser roles: SUPER_ADMIN -> OWNER, ADMIN -> MANAGER (issue #109).
-- Distinguishes organiser-level roles from the platform-level Admin model.
ALTER TYPE "OrganiserRole" RENAME VALUE 'SUPER_ADMIN' TO 'OWNER';
ALTER TYPE "OrganiserRole" RENAME VALUE 'ADMIN' TO 'MANAGER';
