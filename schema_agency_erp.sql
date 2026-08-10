-- =====================================================================
-- Agency ERP Mini — Schema Upgrade
-- =====================================================================
-- ARCHITECTURAL NOTE ON ROLE SEPARATION
-- ---------------------------------------------------------------------
-- Per the security requirement, there is NO single `user` table with a
-- `role` column. Each role owns its own physical table with its own
-- auto-increment id space, its own columns, and (where relevant) its
-- own permissions.
--
-- The one exception is `auth_index`, which is NOT a users table. It
-- stores nothing but (email -> which role-table + which row) so login
-- can find the right table in one indexed lookup instead of scanning
-- four tables on every request. It holds no profile data, no cost
-- rates, no personal fields — only routing information plus the
-- password hash needed to authenticate. Every write to a role table
-- must be mirrored into auth_index inside the same transaction, and
-- application code must never read business data out of auth_index.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ROLE TABLES
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ceo (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  last_login DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS team_managers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  department VARCHAR(150) NULL,
  last_login DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS qa_reviewers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  specialty VARCHAR(150) NULL,
  last_login DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  position VARCHAR(150) NULL,
  department VARCHAR(150) NULL,
  joined_date DATE NULL,
  -- CEO-only financial field. Never selected by non-CEO controllers.
  internal_cost_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00, -- cost per hour, e.g. 25.00
  manager_id INT NULL,
  last_login DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_employee_manager FOREIGN KEY (manager_id) REFERENCES team_managers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. AUTH INDEX (routing only — see note above)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_index (
  email VARCHAR(150) NOT NULL PRIMARY KEY,
  role ENUM('ceo','team_manager','qa','employee') NOT NULL,
  role_table VARCHAR(30) NOT NULL,   -- 'ceo' | 'team_managers' | 'qa_reviewers' | 'employees'
  role_id INT NOT NULL,
  UNIQUE KEY uq_role_row (role_table, role_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. PROJECT TEMPLATES (module 3)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,          -- e.g. "Monthly Social Media Management"
  description TEXT NULL,
  created_by_role VARCHAR(30) NOT NULL,
  created_by_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS template_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  sequence_order INT NOT NULL,               -- 1,2,3... execution order
  depends_on_sequence INT NULL,              -- sequence_order of prerequisite step within same template
  relative_due_days INT NOT NULL DEFAULT 0,  -- days from project start_date
  default_role VARCHAR(30) NULL,             -- suggested assignee role, e.g. 'employee'
  requires_qa_review TINYINT(1) NOT NULL DEFAULT 0,
  requires_client_approval TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_tt_template FOREIGN KEY (template_id) REFERENCES project_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. PROJECTS (extended: contract value + template link)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('not-started','in-progress','completed','on-hold') NOT NULL DEFAULT 'not-started',
  -- CEO-only financial field
  contract_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  template_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_template FOREIGN KEY (template_id) REFERENCES project_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. TASKS (extended: dependency engine, timer, approvals)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  projectId INT NOT NULL,
  projectName VARCHAR(150) NULL,
  assignedTo INT NULL,                -- employees.id
  assignedToName VARCHAR(150) NULL,
  status ENUM(
    'pending',
    'in-progress',
    'pending-internal-review',   -- Approval Gate: awaiting QA/Manager review
    'pending-client-approval',   -- Approval Gate: awaiting client sign-off
    'completed',
    'blocked',
    'rejected'                   -- sent back for revision
  ) NOT NULL DEFAULT 'pending',
  deadline DATE NOT NULL,

  -- Dependency Engine
  dependsOnTaskId INT NULL,
  isLocked TINYINT(1) NOT NULL DEFAULT 0,

  -- Financial / time tracking
  actualTimeSpentSeconds INT NOT NULL DEFAULT 0,
  timerStartedAt DATETIME NULL,       -- non-null while a timer is actively running
  timerState ENUM('stopped','running','paused') NOT NULL DEFAULT 'stopped',

  -- Approval gate metadata
  reviewerRole VARCHAR(30) NULL,      -- 'qa' | 'team_manager'
  reviewerId INT NULL,
  revisionNotes TEXT NULL,

  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_task_project FOREIGN KEY (projectId) REFERENCES project(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_dependency FOREIGN KEY (dependsOnTaskId) REFERENCES task(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_task_dependsOn ON task(dependsOnTaskId);
CREATE INDEX idx_task_assignedTo ON task(assignedTo);
CREATE INDEX idx_task_project ON task(projectId);

-- ---------------------------------------------------------------------
-- 6. TASK NOTES (extended: attachments / links)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  authorRole VARCHAR(30) NOT NULL,
  authorId INT NOT NULL,
  authorName VARCHAR(150) NOT NULL,
  content TEXT NOT NULL,
  attachment_url VARCHAR(1000) NULL,   -- Google Drive view link, or a shared link
  attachment_name VARCHAR(255) NULL,
  attachment_type ENUM('drive','link') NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_note_task FOREIGN KEY (task_id) REFERENCES task(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. EXTENSION REQUESTS (kept from original app, role-tagged)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS extension_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_role VARCHAR(30) NOT NULL DEFAULT 'employee',
  user_id INT NOT NULL,
  user_name VARCHAR(150) NOT NULL,
  reason TEXT NOT NULL,
  requested_days INT NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ext_task FOREIGN KEY (task_id) REFERENCES task(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. REAL-TIME PRESENCE & ACTIVITY LOG (module 1)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS presence_status (
  role_table VARCHAR(30) NOT NULL,
  role_id INT NOT NULL,
  status ENUM('online','offline') NOT NULL DEFAULT 'offline',
  last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  socket_count INT NOT NULL DEFAULT 0,   -- supports multiple tabs/devices
  PRIMARY KEY (role_table, role_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  role_table VARCHAR(30) NOT NULL,
  role_id INT NOT NULL,
  actor_name VARCHAR(150) NULL,
  action_type ENUM(
    'login','logout','online','offline',
    'task_view','task_status_change','task_note_added',
    'task_timer_start','task_timer_stop','task_timer_pause',
    'task_approve','task_reject'
  ) NOT NULL,
  metadata JSON NULL,      -- e.g. {"taskId":12,"from":"pending","to":"in-progress"}
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_activity_actor ON activity_log(role_table, role_id, created_at);

-- ---------------------------------------------------------------------
-- 9. NOTIFICATIONS / PUSH (kept from original app, role-tagged)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_table VARCHAR(30) NOT NULL,
  role_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  task_id INT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_table VARCHAR(30) NOT NULL,
  role_id INT NOT NULL,
  endpoint VARCHAR(500) NOT NULL UNIQUE,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================================
-- Seed a starter CEO account so the system is reachable after migration.
-- Password below is bcrypt hash for: "ChangeMe123!" — CHANGE IMMEDIATELY.
-- =====================================================================
INSERT IGNORE INTO ceo (name, email, password) VALUES
('System Owner', 'ceo@agency.local', '$2a$10$Vh0v6qFqYb0m2z6Kk0z8XeQ9y1qk3rWzqzTz0m8f9m4a8m1c5q3zK');

INSERT IGNORE INTO auth_index (email, role, role_table, role_id)
SELECT email, 'ceo', 'ceo', id FROM ceo WHERE email = 'ceo@agency.local';
