data "aws_caller_identity" "current" {}

# Per-environment infrastructure: VPC + networking, RDS, Cognito, Amplify branch.
#
# One instance of this module is created per environment (prod, nonprod). The
# Amplify app, IAM roles, Route 53 zone, and apex-domain records stay in the
# root module — only resources whose lifecycle is environment-scoped live here.

# ===== Networking =====

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "database" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project_name}-${var.name}"
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_internet_gateway" "database" {
  vpc_id = aws_vpc.database.id

  tags = {
    Name        = "${var.project_name}-${var.name}"
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_subnet" "database_public" {
  count                   = 2
  vpc_id                  = aws_vpc.database.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 1)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.project_name}-${var.name}-public-${count.index}"
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_route_table" "database_public" {
  vpc_id = aws_vpc.database.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.database.id
  }

  tags = {
    Name        = "${var.project_name}-${var.name}-public"
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_route_table_association" "database_public" {
  count          = 2
  subnet_id      = aws_subnet.database_public[count.index].id
  route_table_id = aws_route_table.database_public.id
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project_name}-${var.name}-postgres"
  subnet_ids = aws_subnet.database_public[*].id

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.project_name}-${var.name}-rds-"
  vpc_id      = aws_vpc.database.id
  description = "PostgreSQL ingress for ${var.project_name} ${var.name}"

  dynamic "ingress" {
    for_each = var.database_allowed_cidr_blocks
    content {
      description = "PostgreSQL"
      from_port   = 5432
      to_port     = 5432
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

# ===== RDS (PostgreSQL) =====

resource "random_password" "db_master" {
  length  = 32
  special = false
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.project_name}-${var.name}-postgres"
  engine         = "postgres"
  engine_version = var.database_engine_version
  instance_class = var.database_instance_class

  allocated_storage     = var.database_allocated_storage
  max_allocated_storage = var.database_max_allocated_storage > 0 ? var.database_max_allocated_storage : null
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.database_name
  username = var.database_username
  password = random_password.db_master.result

  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  publicly_accessible             = var.database_publicly_accessible
  skip_final_snapshot             = var.database_skip_final_snapshot
  final_snapshot_identifier       = var.database_skip_final_snapshot ? null : "${var.project_name}-${var.name}-postgres-final"
  backup_retention_period         = var.database_backup_retention_period
  deletion_protection             = var.database_deletion_protection
  performance_insights_enabled    = var.database_performance_insights_enabled
  copy_tags_to_snapshot           = true
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_secretsmanager_secret" "database" {
  name_prefix             = "${var.project_name}/${var.name}/database/"
  recovery_window_in_days = var.database_secret_recovery_window_days

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

locals {
  environment_tag = var.name == "prod" ? "Prod" : "Stage"
  database_url    = "postgresql://${var.database_username}:${urlencode(random_password.db_master.result)}@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${var.database_name}?schema=public&sslmode=require"
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    username     = var.database_username
    password     = random_password.db_master.result
    host         = aws_db_instance.postgres.address
    port         = tostring(aws_db_instance.postgres.port)
    dbname       = var.database_name
    DATABASE_URL = local.database_url
  })
}

resource "random_password" "guest_email_verification" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${var.project_name}/${var.name}/app"
  recovery_window_in_days = 0

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    NEXT_PUBLIC_COGNITO_USER_POOL_ID = aws_cognito_user_pool.this.id
    NEXT_PUBLIC_COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.web.id
    GUEST_EMAIL_VERIFICATION_SECRET  = random_password.guest_email_verification.result
    AWS_S3_BUCKET                    = aws_s3_bucket.uploads.id
    AWS_S3_REGION                    = "ap-southeast-2"
    NEXT_PUBLIC_CDN_URL              = var.cdn_custom_domain != null ? "https://${var.cdn_custom_domain}" : "https://${aws_cloudfront_distribution.cdn.domain_name}"
    DATABASE_URL                     = local.database_url
    NEXT_PUBLIC_SITE_URL             = var.site_url
    NEXT_PUBLIC_BASE_URL             = var.site_url
    NEXT_PUBLIC_AWS_REGION           = "ap-southeast-2"
  })
}

# ===== RDS daily stop scheduler (staging only) =====

resource "aws_iam_role" "scheduler" {
  count = var.enable_daily_stop ? 1 : 0
  name  = "${var.project_name}-${var.name}-rds-scheduler"

  assume_role_policy = jsonencode({
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_iam_role_policy" "scheduler" {
  count = var.enable_daily_stop ? 1 : 0
  role  = aws_iam_role.scheduler[0].id

  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = ["rds:StopDBInstance"]
      Resource = aws_db_instance.postgres.arn
    }]
  })
}

resource "aws_scheduler_schedule" "daily_stop" {
  count = var.enable_daily_stop ? 1 : 0
  name  = "${var.project_name}-${var.name}-rds-daily-stop"

  flexible_time_window { mode = "OFF" }

  schedule_expression          = "cron(0 0 * * ? *)"
  schedule_expression_timezone = "Australia/Melbourne"

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:stopDBInstance"
    role_arn = aws_iam_role.scheduler[0].arn

    input = jsonencode({
      DbInstanceIdentifier = aws_db_instance.postgres.identifier
    })

    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}

# ===== Cognito custom message Lambda =====

resource "aws_iam_role" "cognito_email_lambda" {
  name = "${var.project_name}-${var.name}-cognito-email-lambda"

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "cognito_email_lambda" {
  role = aws_iam_role.cognito_email_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "arn:aws:logs:*:*:*"
    }]
  })
}

data "archive_file" "cognito_email_lambda" {
  type        = "zip"
  source_file = "${path.module}/lambda/email-sender/index.mjs"
  output_path = "${path.module}/lambda/email-sender.zip"
}

resource "aws_lambda_function" "cognito_email" {
  function_name    = "${var.project_name}-${var.name}-cognito-email"
  role             = aws_iam_role.cognito_email_lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  filename         = data.archive_file.cognito_email_lambda.output_path
  source_code_hash = data.archive_file.cognito_email_lambda.output_base64sha256
  timeout          = 5

  environment {
    variables = {
      SITE_URL = var.site_url
    }
  }

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_lambda_permission" "cognito_email" {
  statement_id  = "AllowCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_email.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.this.arn

  depends_on = [aws_cognito_user_pool.this]
}

resource "aws_cognito_user_pool" "this" {
  name = "${var.project_name}-${var.name}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  lambda_config {
    custom_message = aws_lambda_function.cognito_email.arn
  }

  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  mfa_configuration   = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  device_configuration {
    challenge_required_on_new_device      = false
    device_only_remembered_on_user_prompt = true
  }

  deletion_protection = var.cognito_deletion_protection ? "ACTIVE" : "INACTIVE"

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project_name}-${var.name}-web"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user_group" "this" {
  for_each     = toset(["admins", "users"])
  user_pool_id = aws_cognito_user_pool.this.id
  name         = each.key
}

# ===== Amplify branch =====

resource "aws_amplify_branch" "this" {
  app_id      = var.amplify_app_id
  branch_name = var.branch_name
  stage       = var.amplify_stage

  enable_auto_build           = var.auto_build_enabled
  enable_pull_request_preview = var.enable_pull_request_preview

  environment_variables = merge(
    {
      DATABASE_URL                   = local.database_url
      UPLOADS_BUCKET                 = aws_s3_bucket.uploads.id
      UPLOADS_BUCKET_REGIONAL_DOMAIN = aws_s3_bucket.uploads.bucket_regional_domain_name
    },
    var.extra_branch_environment_variables,
  )

  lifecycle {
    create_before_destroy = false

    precondition {
      condition     = contains(["PRODUCTION", "BETA", "DEVELOPMENT"], var.amplify_stage)
      error_message = "amplify_stage must be one of PRODUCTION, BETA, or DEVELOPMENT."
    }
  }

  tags = {
    Environment = var.name == "prod" ? "Prod" : "Stage"
    Service     = var.project_name
  }
}

# ===== S3 upload bucket =====

resource "aws_s3_bucket" "uploads" {
  bucket = "${var.project_name}-${var.name}-uploads"

  force_destroy = var.name != "prod"

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
  rule {
    id     = "expire-old-objects"
    status = "Enabled"
    filter {}
    expiration {
      days = 365
    }
  }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration {
    status = "Suspended"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "uploads_oac" {
  statement {
    sid    = "AllowCloudFrontOAC"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/images/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.cdn.arn]
    }
  }

  statement {
    sid    = "DenyNonSSL"
    effect = "Deny"
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.uploads.arn,
      "${aws_s3_bucket.uploads.arn}/*",
    ]
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "uploads_oac" {
  bucket = aws_s3_bucket.uploads.id
  policy = data.aws_iam_policy_document.uploads_oac.json
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  dynamic "cors_rule" {
    for_each = [for i, v in var.bucket_cors_allowed_origins : {
      origin = v
    }]
    content {
      allowed_headers = ["*"]
      allowed_methods = ["GET", "PUT", "POST", "DELETE"]
      allowed_origins = [cors_rule.value.origin]
      expose_headers  = ["ETag"]
      max_age_seconds = 3600
    }
  }
}

# ===== CloudFront CDN for upload bucket =====

resource "aws_wafv2_web_acl" "cdn" {
  count = var.cdn_waf_enabled ? 1 : 0
  provider = aws.us_east_1

  name        = "${var.project_name}-${var.name}-cdn-waf"
  description = "Rate-limiting WAF for ${var.name} CDN"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 5000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = false
      metric_name                = "${var.project_name}_${var.name}_cdn_rate_limit"
      sampled_requests_enabled   = false
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = false
    metric_name                = "${var.project_name}_${var.name}_cdn_waf"
    sampled_requests_enabled   = false
  }

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}

resource "aws_cloudfront_origin_access_control" "cdn" {
  name                              = "${var.project_name}-${var.name}-cdn-oac"
  description                       = "OAC for ${var.name} upload bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"
  is_ipv6_enabled     = true
  web_acl_id          = var.cdn_waf_enabled ? aws_wafv2_web_acl.cdn[0].arn : null
  comment             = "CDN for ${var.name} upload bucket"
  price_class         = "PriceClass_100"
  aliases             = var.cdn_custom_domain != null ? [var.cdn_custom_domain] : []

  origin {
    domain_name              = aws_s3_bucket.uploads.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.cdn.id
    origin_id                = "s3-uploads"
  }

  default_cache_behavior {
    target_origin_id       = "s3-uploads"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 3600
    default_ttl = 86400
    max_ttl     = 604800
  }

  dynamic "viewer_certificate" {
    for_each = var.cdn_custom_domain != null ? [1] : []
    content {
      acm_certificate_arn      = var.cdn_cert_arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.cdn_custom_domain == null ? [1] : []
    content {
      cloudfront_default_certificate = true
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Environment = local.environment_tag
    Service     = var.project_name
  }
}
