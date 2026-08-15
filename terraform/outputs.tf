output "amplify_app_id" {
  description = "Amplify application ID."
  value       = aws_amplify_app.this.id
}

output "amplify_app_arn" {
  description = "Amplify application ARN."
  value       = aws_amplify_app.this.arn
}

output "amplify_default_domain" {
  description = "Default amplifyapp.com hostname for the app."
  value       = aws_amplify_app.this.default_domain
}

output "amplify_production_branch" {
  description = "Production branch name in Amplify."
  value       = try(module.env["prod"].branch_name, null)
}

output "aws_account_id" {
  description = "AWS account ID resources were created in."
  value       = data.aws_caller_identity.current.account_id
}

output "database_secret_arn" {
  description = "Secrets Manager secret ARN for the database."
  value       = try(module.env["prod"].database_secret_arn, null)
}

output "database_host" {
  description = "RDS hostname."
  value       = try(module.env["prod"].database_host, null)
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID."
  value       = try(module.env["prod"].cognito_user_pool_id, null)
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN."
  value       = try(module.env["prod"].cognito_user_pool_arn, null)
}

output "cognito_issuer_url" {
  description = "OIDC issuer URL."
  value       = try(module.env["prod"].cognito_issuer_url, null)
}

output "cognito_app_client_id" {
  description = "App Client ID."
  value       = try(module.env["prod"].cognito_app_client_id, null)
}

output "cognito_app_client_secret" {
  description = "App Client secret (sensitive)."
  value       = try(module.env["prod"].cognito_app_client_secret, null)
  sensitive   = true
}

output "amplify_domain_dns_records" {
  description = "DNS records for the apex domain."
  value = var.amplify_custom_domain == null || length(aws_amplify_domain_association.this) == 0 ? [] : concat(
    [
      for s in aws_amplify_domain_association.this[0].sub_domain : {
        type   = "CNAME"
        name   = s.prefix == "" ? var.amplify_custom_domain : "${s.prefix}.${var.amplify_custom_domain}"
        value  = s.dns_record
        verify = false
      }
    ],
    [{
      type   = "CNAME"
      name   = "_certificate_validation"
      value  = aws_amplify_domain_association.this[0].certificate_verification_dns_record
      verify = true
    }],
  )
}

output "github_actions_role_arn" {
  description = "Set as GitHub repo variable AWS_ROLE_ARN. Admin access, main branch only."
  value       = aws_iam_role.terraform_ci.arn
}

output "github_actions_readonly_role_arn" {
  description = "Set as GitHub repo variable AWS_ROLE_ARN_READONLY for PR workflows."
  value       = aws_iam_role.terraform_ci_readonly.arn
}

output "uploads_bucket_id" {
  description = "S3 upload bucket name."
  value       = try(module.env["prod"].uploads_bucket_id, null)
}

output "uploads_bucket_arn" {
  description = "S3 upload bucket ARN."
  value       = try(module.env["prod"].uploads_bucket_arn, null)
}

output "uploads_bucket_regional_domain_name" {
  description = "S3 upload bucket regional domain name."
  value       = try(module.env["prod"].uploads_bucket_regional_domain_name, null)
}

# ── Staging outputs ─────────────────────────────────────────────────────

output "staging_cognito_user_pool_id" {
  description = "Staging Cognito User Pool ID."
  value       = try(module.env["staging"].cognito_user_pool_id, null)
}

output "staging_cognito_app_client_id" {
  description = "Staging Cognito App Client ID."
  value       = try(module.env["staging"].cognito_app_client_id, null)
}

output "staging_cognito_issuer_url" {
  description = "Staging OIDC issuer URL."
  value       = try(module.env["staging"].cognito_issuer_url, null)
}

output "staging_database_host" {
  description = "Staging RDS hostname."
  value       = try(module.env["staging"].database_host, null)
}

output "staging_database_secret_arn" {
  description = "Staging Secrets Manager secret ARN for the database."
  value       = try(module.env["staging"].database_secret_arn, null)
}

output "staging_uploads_bucket_id" {
  description = "Staging S3 upload bucket name."
  value       = try(module.env["staging"].uploads_bucket_id, null)
}

output "staging_uploads_bucket_arn" {
  description = "Staging S3 upload bucket ARN."
  value       = try(module.env["staging"].uploads_bucket_arn, null)
}

output "staging_app_secret_arn" {
  description = "Staging Secrets Manager secret containing all app env vars."
  value       = try(module.env["staging"].app_secret_arn, null)
}

output "startline_dev_access_key_id" {
  description = "Access key ID for the startline-dev IAM user."
  value       = aws_iam_access_key.startline_dev.id
}

output "startline_dev_secret_access_key" {
  description = "Secret access key for the startline-dev IAM user."
  value       = aws_iam_access_key.startline_dev.secret
  sensitive   = true
}
