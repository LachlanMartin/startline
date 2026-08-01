variable "database_ssl_mode" {
  description = "PostgreSQL SSL mode (require, no-verify, verify-full, etc.)"
  type        = string
  default     = "require"
}

variable "name" {
  description = "Short environment name (e.g. prod, nonprod). Used as a suffix in resource names and the Environment tag."
  type        = string
}

variable "project_name" {
  description = "Project prefix (e.g. startline) shared with the root module."
  type        = string
}

variable "amplify_app_id" {
  description = "ID of the singleton Amplify app this environment's branch attaches to."
  type        = string
}

variable "branch_name" {
  description = "Git branch deployed to this environment (e.g. prod, nonprod)."
  type        = string
}

variable "amplify_stage" {
  description = "Amplify branch stage (PRODUCTION, BETA, DEVELOPMENT, etc.)."
  type        = string
}

variable "auto_build_enabled" {
  description = "Enable Amplify auto-build for this branch. Should match whether the app is connected to a repo."
  type        = bool
}

variable "enable_pull_request_preview" {
  description = "Enable PR preview deployments for this branch."
  type        = bool
  default     = false
}

variable "extra_branch_environment_variables" {
  description = "Extra env vars to set on the Amplify branch in addition to DATABASE_URL."
  type        = map(string)
  default     = {}
}

# --- Networking ---

variable "vpc_cidr" {
  description = "CIDR for this environment's dedicated VPC. Must not overlap other environments."
  type        = string
}

# --- RDS ---

variable "database_name" {
  description = "PostgreSQL database name (path segment in DATABASE_URL)."
  type        = string
}

variable "database_username" {
  description = "Master username for RDS."
  type        = string
}

variable "database_engine_version" {
  description = "PostgreSQL major version."
  type        = string
}

variable "database_instance_class" {
  description = "RDS instance class."
  type        = string
}

variable "database_allocated_storage" {
  description = "Initial allocated storage (GB)."
  type        = number
}

variable "database_max_allocated_storage" {
  description = "Autoscaling cap (GB). 0 disables autoscaling."
  type        = number
}

variable "database_publicly_accessible" {
  description = "If true, RDS gets a public address."
  type        = bool
}

variable "database_allowed_cidr_blocks" {
  description = "CIDRs allowed to reach PostgreSQL on 5432."
  type        = list(string)
}

variable "database_skip_final_snapshot" {
  description = "If true, destroying the instance skips a final snapshot."
  type        = bool
}

variable "database_backup_retention_period" {
  description = "Days of automated backups."
  type        = number
}

variable "database_deletion_protection" {
  description = "Enable deletion protection on the RDS instance."
  type        = bool
}

variable "database_performance_insights_enabled" {
  description = "Enable RDS Performance Insights."
  type        = bool
}

variable "database_secret_recovery_window_days" {
  description = "Secrets Manager recovery window when deleting the secret (0 = immediate)."
  type        = number
}

# --- Cognito ---

variable "cognito_deletion_protection" {
  description = "Enable deletion protection on the User Pool."
  type        = bool
}

variable "resend_api_key" {
  description = "Resend API key passed to the custom email sender Lambda."
  type        = string
  sensitive   = true
  default     = null
}

variable "site_url" {
  description = "Public base URL for this environment (e.g. https://startlineau.com). Used in email links."
  type        = string
}

variable "mapbox_access_token" {
  description = "Mapbox public access token (pk.*) for the events map and organiser location preview. From the ci-bootstrap secret."
  type        = string
  sensitive   = true
  default     = null
}

# --- S3 upload bucket ---

variable "bucket_cors_allowed_origins" {
  description = "CORS allowed origins for the uploads bucket."
  type        = list(string)
}

# --- RDS daily stop (staging only) ---

variable "enable_daily_stop" {
  description = "Schedule RDS to stop at midnight Melbourne time nightly. For staging to save ~$15/mo."
  type        = bool
  default     = false
}

# --- CloudFront CDN ---

variable "cdn_waf_enabled" {
  description = "Enable WAF rate-limiting on the CDN. Skip for staging to save $6/mo."
  type        = bool
  default     = true
}

variable "cdn_custom_domain" {
  description = "Custom domain for the upload CDN (e.g. cdn.startlineau.com). Null means use CloudFront default domain."
  type        = string
  default     = null
}

variable "cdn_cert_arn" {
  description = "ACM certificate ARN (us-east-1) for the CDN custom domain. Required if cdn_custom_domain is set."
  type        = string
  default     = null
}
