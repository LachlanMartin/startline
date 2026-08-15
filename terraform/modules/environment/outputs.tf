output "branch_name" {
  description = "Amplify branch name attached to this environment."
  value       = aws_amplify_branch.this.branch_name
}

output "branch_arn" {
  description = "Amplify branch ARN."
  value       = aws_amplify_branch.this.arn
}

output "database_host" {
  description = "RDS hostname (without port)."
  value       = aws_db_instance.postgres.address
}

output "database_port" {
  description = "RDS port."
  value       = aws_db_instance.postgres.port
}

output "database_url" {
  description = "Full Prisma-style PostgreSQL URL (sensitive)."
  value       = local.database_url
  sensitive   = true
}

output "database_secret_arn" {
  description = "Secrets Manager secret containing host, credentials, and DATABASE_URL."
  value       = aws_secretsmanager_secret.database.arn
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "cognito_user_pool_arn" {
  value = aws_cognito_user_pool.this.arn
}

output "cognito_issuer_url" {
  description = "OIDC issuer URL for the User Pool."
  value       = "https://${aws_cognito_user_pool.this.endpoint}"
}

output "cognito_app_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "cognito_app_client_secret" {
  value     = aws_cognito_user_pool_client.web.client_secret
  sensitive = true
}

output "app_secret_arn" {
  description = "Secrets Manager secret containing all app env vars."
  value       = aws_secretsmanager_secret.app.arn
}

output "uploads_bucket_id" {
  description = "S3 bucket name for user-uploaded images."
  value       = aws_s3_bucket.uploads.id
}

output "uploads_bucket_arn" {
  description = "S3 bucket ARN for user-uploaded images."
  value       = aws_s3_bucket.uploads.arn
}

output "uploads_bucket_regional_domain_name" {
  description = "Regional domain name for the uploads bucket."
  value       = aws_s3_bucket.uploads.bucket_regional_domain_name
}

output "cdn_distribution_domain_name" {
  description = "CloudFront distribution domain name for the upload CDN."
  value       = aws_cloudfront_distribution.cdn.domain_name
}
