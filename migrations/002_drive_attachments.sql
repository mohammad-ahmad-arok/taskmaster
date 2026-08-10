-- Run this ONCE on your existing production database (phpMyAdmin -> SQL tab).
-- Safe to run even if task_notes already has rows.

-- Any old rows that used the retired 'file' type become 'drive' so they
-- don't get silently blanked out by the ENUM change below.
UPDATE task_notes SET attachment_type = 'drive' WHERE attachment_type = 'file';

ALTER TABLE task_notes
  MODIFY COLUMN attachment_type ENUM('drive','link') NULL;
