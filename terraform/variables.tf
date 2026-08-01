variable "aws_region" {
  description = "AWS region for Amplify and IAM resources."
  type        = string
  default     = "ap-southeast-2"
}

variable "aws_profile" {
  description = "Named AWS CLI profile to use. Leave null to fall back to default credentials/env vars."
  type        = string
  default     = null
}

variable "project_name" {
  description = "Short name used for Amplify app, IAM role prefix, and per-env resource naming."
  type        = string
  default     = "startline"
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID."
  type        = string
  default     = "cae4a54688a0a4c53bda4bd62eb37c35"
}

# --- Amplify ---

variable "amplify_repository_url" {
  description = "HTTPS Git URL for Amplify. Set to null to create the app without a connected repository."
  type        = string
  default     = "https://github.com/StartlineAU/startline-web-app"
}

variable "amplify_environment_variables" {
  description = "Env vars at the app level (apply to BOTH branches). Use the env module's branch env vars for per-environment values."
  type        = map(string)
  default     = {}
}

variable "amplify_custom_domain" {
  description = "Apex domain attached to the prod branch only. Set to null to skip."
  type        = string
  default     = "startlineau.com"
}

# --- RDS shared defaults ---
# Per-environment overrides (db name, deletion protection, final snapshot)
# live in main.tf's local.environments map.

variable "database_username" {
  description = "Master username for RDS, shared across environments."
  type        = string
  default     = "startline"
}

variable "database_engine_version" {
  description = "PostgreSQL major version."
  type        = string
  default     = "16"
}

variable "database_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "database_allocated_storage" {
  description = "Initial allocated storage (GB)."
  type        = number
  default     = 20
}

variable "database_max_allocated_storage" {
  description = "Autoscaling cap (GB). 0 disables autoscaling — required while the AWS account is in Free Tier restricted mode."
  type        = number
  default     = 0
}

variable "database_publicly_accessible" {
  description = "If true, RDS gets a public address so Amplify SSR (outside the VPC) can connect."
  type        = bool
  default     = true
}

variable "database_allowed_cidr_blocks" {
  description = "CIDRs allowed to reach PostgreSQL on 5432. Narrow this where you can; password + TLS are still required."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "database_backup_retention_period" {
  description = "Days of automated backups. 0 disables backups — required while the AWS account is in Free Tier restricted mode."
  type        = number
  default     = 0
}

variable "database_performance_insights_enabled" {
  description = "Enable RDS Performance Insights."
  type        = bool
  default     = false
}

variable "database_secret_recovery_window_days" {
  description = "Secrets Manager recovery window when deleting the secret (0 = immediate)."
  type        = number
  default     = 0
}


