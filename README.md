# AWS Dashboard

> **LOCAL USE ONLY.** This dashboard is a read-only AWS API proxy that runs against your local `~/.aws/config`. It has **no authentication layer**. Do not deploy it to a server, expose it over a tunnel (ngrok, Cloudflare Tunnel, Tailscale serve, etc.), or bind it to `0.0.0.0`. The `yarn dev` script binds to `127.0.0.1` and the middleware rejects non-loopback hosts; do not weaken these settings.

Local dashboard to monitor AWS services (ECS, ECR, S3, Lambda, RDS, CloudFront, and more) across multiple accounts configured via `~/.aws/config`.

## Prerequisites

- Node.js 18+
- AWS CLI configured with profiles in your AWS config file

**macOS**
- Install Node.js via [Homebrew](https://brew.sh): `brew install node`, or use [nvm](https://github.com/nvm-sh/nvm)
- Install AWS CLI: `brew install awscli` or download the [.pkg installer](https://aws.amazon.com/cli/)
- Config file location: `~/.aws/config`

**Windows**
- Install Node.js via [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/): `winget install OpenJS.NodeJS`, or download the [.msi installer](https://nodejs.org)
- Install AWS CLI: `winget install Amazon.AWSCLI` or download the [.msi installer](https://aws.amazon.com/cli/)
- Config file location: `%USERPROFILE%\.aws\config` (e.g. `C:\Users\YourName\.aws\config`)
- Alternatively, use [WSL2](https://learn.microsoft.com/en-us/windows/wsl/) and follow the macOS steps above

Each profile needs read permissions for the services you want to monitor (e.g. `ecs:ListClusters`, `s3:ListBuckets`, `lambda:ListFunctions`, etc.).

## Setup

```bash
cd aws-dashboard
npm install
# or
yarn install
```

## Dev

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) — **only accessible from this machine**.

## Build

```bash
npm run build
# or
yarn build
```

## Lint

```bash
npm run lint
# or
yarn lint
```

## What it shows

Read-only views across all configured AWS accounts:

- ECS clusters, services, and task definitions
- ECR repositories and image tags
- S3 buckets, objects, and bucket configuration
- Lambda functions and versions
- CloudFront distributions
- CloudFormation stacks
- Cognito user pools
- DynamoDB tables
- VPCs and networking
- WAF web ACLs — per-WebACL rule breakdown (active, disabled/overridden) split into managed and custom rules, plus AWS Managed Rule Groups best-practice recommendations that are not yet enabled
- Route53 hosted zones
- Cost analysis

## How it works

The app reads your local AWS profiles (`~/.aws/config` on macOS/Linux, `%USERPROFILE%\.aws\config` on Windows) via the AWS SDK `fromIni` credential provider. It calls AWS `List*`, `Describe*`, and `Get*` APIs — no resources are created or modified. No credentials are stored in the app itself.
