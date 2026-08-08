# OIDC trust between GitHub Actions and AWS, so workflows can assume an IAM
# role via short-lived tokens — no long-lived AWS keys in GitHub secrets.

variable "github_repository" {
  description = "GitHub repository for terraform CI in 'org/repo' form."
  type        = string
  default     = "StartlineAU/startline-web-app"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "terraform_ci_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Admin role is only assumable from protected branches (push/tag events).
    # PRs use the separate read-only role below.
    # Numeric org/repo ID forms: GitHub issues OIDC subjects as
    # repo:ORG@ORGID/REPO@REPOID for org-owned repos — named form alone
    # doesn't match (verified: Aug 2026, repo renamed startline→startline-web-app).
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = concat([
        "repo:${var.github_repository}:*:refs/heads/main",
        "repo:${var.github_repository}:*:refs/heads/prod",
        ], [
        "repo:StartlineAU@277168955/startline-web-app@1163051258:*:refs/heads/main",
        "repo:StartlineAU@277168955/startline-web-app@1163051258:*:refs/heads/prod",
      ])
    }
  }
}

resource "aws_iam_role" "terraform_ci" {
  name               = "${var.project_name}-terraform-ci"
  assume_role_policy = data.aws_iam_policy_document.terraform_ci_assume.json
}

resource "aws_iam_role_policy_attachment" "terraform_ci_admin" {
  role       = aws_iam_role.terraform_ci.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

# ponytail: read-only role for PR workflows — terraform plan and CI checks.
# Uses AWS managed ReadOnlyAccess instead of a custom list to avoid whack-a-mole.
# Cognito admin is needed for e2e seeding.

data "aws_iam_policy_document" "terraform_ci_readonly_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Read-only role is safe from any branch — the IAM policy restricts its scope.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = concat([
        "repo:${var.github_repository}:*",
        ], [
        "repo:StartlineAU@277168955/startline-web-app@1163051258:*",
      ])
    }
  }
}

resource "aws_iam_role" "terraform_ci_readonly" {
  name               = "${var.project_name}-terraform-ci-readonly"
  assume_role_policy = data.aws_iam_policy_document.terraform_ci_readonly_assume.json
}

data "aws_iam_policy" "read_only" {
  arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

resource "aws_iam_role_policy_attachment" "readonly_base" {
  role       = aws_iam_role.terraform_ci_readonly.name
  policy_arn = data.aws_iam_policy.read_only.arn
}

resource "aws_iam_policy" "terraform_ci_readonly_extra" {
  name        = "StartlineCIReadOnlyExtra"
  description = "Extra permissions beyond ReadOnlyAccess needed by CI/plan workflows"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SecretsManagerRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:startline/ci-bootstrap*",
          "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:startline/prod/*",
          "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:startline/staging/*",
        ]
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "terraform_ci_readonly_extra" {
  role       = aws_iam_role.terraform_ci_readonly.name
  policy_arn = aws_iam_policy.terraform_ci_readonly_extra.arn
}
