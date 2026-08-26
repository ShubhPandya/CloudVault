# ⚡ CloudVault: Serverless Digital Asset Management & Ingestion Pipeline

[![Architecture](https://img.shields.io/badge/Architecture-Event--Driven%20Serverless-orange.svg)]()
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.11+-009688.svg?logo=fastapi)]()
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014%20%7C%20App%20Router-black.svg?logo=next.js)]()
[![AWS S3](https://img.shields.io/badge/Storage-Amazon%20S3%20Presigned-569A31.svg?logo=amazons3)]()
[![AWS DynamoDB](https://img.shields.io/badge/Database-Amazon%20DynamoDB-4053D6.svg?logo=amazondynamodb)]()
[![CloudFront](https://img.shields.io/badge/Delivery-CloudFront%20OAC-FF9900.svg?logo=amazonwebservices)]()
[![License](https://img.shields.io/badge/License-MIT-blue.svg)]()

> A production-grade, event-driven digital asset management hub designed to handle high-throughput file uploads, background media transformations, NoSQL single-table metadata indexing, and zero-trust expiring link distribution.

---

## 📌 Architecture Overview

```text
[ Next.js 14 Web Frontend ]
       │  ▲
       │  │ (1) Authenticate (JWT) & Request Presigned Upload URL
       ▼  │
 [ FastAPI Backend Microservice ]
       │
       │ (2) Generate Time-Expiring S3 Presigned PUT Ticket
       ▼
 [ Amazon S3 (Raw Assets Bucket: /uploads) ]
       │
       │ (3) S3 ObjectCreated Event Trigger
       ▼
 [ Amazon SQS (Decoupled Task Queue + Dead-Letter Queue) ]
       │
       │ (4) Batch Poll Trigger
       ▼
 [ AWS Lambda / Async Processing Worker ] (Pillow / pypdf / FFmpeg)
       │
       ├──► (5a) Save Thumbnails & Processed Media ──► [ Amazon S3 (/processed) ]
       └──► (5b) Store Extracted Schema & Metadata   ──► [ Amazon DynamoDB ]
                                                                 │
                                                                 ▼
                                                    [ Upstash Redis (Cache-Aside) ]
                                                                 │
                                                                 ▼
 [ Amazon CloudFront (CDN + OAC) ] ◄── (6) Deliver Expiring Signed Download Links
```

### Key Engineering Highlights

* **Zero-Server Bottleneck Uploads:** Large binary payloads stream directly from client browsers to Amazon S3 via short-lived presigned URLs, avoiding API gateway execution time limits and server memory exhaustion.
* **Event-Driven Asynchronous Pipeline:** Upload completion triggers decoupled SQS queue ingestion, executing isolated background workers to extract metadata, generate `.webp` thumbnails, and process files.
* **Single-Table DynamoDB Schema:** Optimized composite partition key (`PK`) and sort key (`SK`) design providing $O(1)$ lookup complexity for multi-tenant user profiles, asset history, and shared permissions.
* **Zero-Trust Asset Delivery:** Media assets are stored private-by-default with all public bucket access blocked; downloads and media views are delivered via Amazon CloudFront Origin Access Control (OAC) and cryptographic presigned links.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| **Frontend** | **Next.js 14**, React, TypeScript, Tailwind CSS | Responsive dashboard, direct S3 binary streaming, dynamic share views |
| **Backend API** | **FastAPI**, Python 3.11+, Uvicorn, Pydantic v2 | High-performance async REST API, JWT auth, S3 presigned URL generation |
| **Storage** | **Amazon S3** | Dual-prefix private object storage (`/uploads`, `/processed`) |
| **Database** | **Amazon DynamoDB** | Single-table NoSQL store indexing users, asset metadata, and status |
| **Messaging & Queuing** | **Amazon SQS + DLQ** | Decoupled asynchronous event buffering and dead-letter retry isolation |
| **Processing Engine** | **AWS Lambda** (Python 3.11/3.13) | Asynchronous worker bundling Pillow and metadata parsers |
| **Edge Distribution** | **Amazon CloudFront** | Low-latency CDN distribution with Origin Access Control (OAC) |
| **Caching** | **Upstash Redis** | Cache-Aside layer for fast session & asset querying |
| **Infrastructure as Code** | **AWS SAM / CloudFormation** | Declarative cloud resource definitions and IAM least-privilege policies |

---

## 📁 Repository Structure

```text
CloudVault/
├── apps/
│   ├── api/                              # FastAPI Backend Microservice
│   │   ├── core/                         # Config, auth, security & token hashing
│   │   ├── routers/                      # API routes (auth, assets, upload)
│   │   ├── services/                     # S3, DynamoDB & CloudFront SDK logic
│   │   ├── main.py                       # FastAPI entrypoint & CORS middleware
│   │   ├── Procfile                      # Render deployment entrypoint
│   │   └── requirements.txt              # Python API dependencies
│   │
│   └── web/                              # Next.js 14 Frontend Application
│       ├── src/
│       │   └── app/                      # App Router pages (auth, dashboard, share)
│       │       ├── share/
│       │       │   └── [assetId]/        # Auth-gated shared asset viewer
│       │       ├── api.ts                # Frontend API client & direct S3 uploader
│       │       ├── globals.css           # Tailwind styling
│       │       ├── layout.tsx            # Root layout
│       │       └── page.tsx              # Auth & Dashboard UI
│       ├── package.json                  # Node dependencies
│       └── tailwind.config.ts            # Tailwind configuration
│
├── infra/                                # Infrastructure as Code (AWS SAM)
│   ├── samconfig.toml                    # SAM deployment configuration
│   └── template.yaml                     # S3, SQS, DLQ, Lambda, DynamoDB, OAC template
│
├── services/
│   └── worker/                           # AWS Lambda Background Processor
│       ├── handler.py                    # SQS batch event consumer & Pillow thumbnailer
│       └── requirements.txt              # Worker dependencies
│
└── README.md

```

---

## 💰 Cost-Protection & Free-Tier Guardrails

CloudVault is architected to run strictly within the AWS Always-Free and 12-Month Free Tiers at $0 base cost:

* **SSM Parameter Store vs. Secrets Manager:** AWS Secrets Manager charges $0.40/secret/month. CloudVault uses standard SSM Parameter Store / environment variables (100% free).
* **Always-Free Serverless:** AWS Lambda (1M free requests/month), Amazon DynamoDB (25 GB free storage), and CloudFront (1 TB/month free egress data transfer).
* **VPC & NAT Gateway Avoidance:** Standard NAT Gateways cost ~$33/month. CloudVault Lambda workers run outside a VPC to eliminate networking overhead fees.
* **Proactive Budget Alarms:** Set up an AWS Budget alert at **$1.00** to immediately receive email notifications if forecasted spend exceeds $1.00.

---

## 🚀 Setup & Local Development Guide

### 1. Prerequisites

* **Python 3.11+** installed
* **Node.js 18.x+** & **npm** installed
* **AWS CLI** installed and configured (`aws configure`)
* **AWS SAM CLI** (for cloud infrastructure deployment)

---

### 2. Clone the Repository

```bash
git clone [https://github.com/ShubhPandya/CloudVault.git](https://github.com/ShubhPandya/CloudVault.git)
cd CloudVault

```

---

### 3. Deploy Cloud Infrastructure (AWS SAM)

Deploy the S3 buckets, SQS queues, Lambda worker, DynamoDB single-table, and CloudFront distribution:

```bash
cd infra
sam build
sam deploy --guided

```

> Note the deployed resource outputs: `RawAssetsBucket`, `CloudVaultTable`, `AssetProcessingQueue`, and `CloudFrontDomain`.

---

### 4. Backend Setup (FastAPI)

1. Open a terminal and navigate to `apps/api`:
```bash
cd apps/api

```


2. Create and activate a Python virtual environment:
```bash
# Windows (PowerShell / CMD)
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate

```


3. Install required Python packages:
```bash
pip install -r requirements.txt

```


4. Create a `.env` file inside `apps/api/`:
```ini
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
S3_BUCKET_NAME=cloudvault-raw-assets-dev
DYNAMODB_TABLE_NAME=cloudvault-table-dev
CLOUDFRONT_DOMAIN=your_cloudfront_distribution_domain.cloudfront.net
JWT_SECRET=cloudvault-dev-jwt-super-secret-key-change-in-prod
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

```


5. Launch the FastAPI server:
```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

```


* Live API endpoint: `http://localhost:8000`
* Swagger Documentation: `http://localhost:8000/docs`



---

### 5. Frontend Setup (Next.js 14)

1. Open a second terminal and navigate to `apps/web`:
```bash
cd apps/web

```


2. Install npm dependencies:
```bash
npm install

```


3. Create a `.env.local` file inside `apps/web/`:
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000

```


4. Start the Next.js development server:
```bash
npm run dev

```


* Web Application: `http://localhost:3000`



---

### 6. Amazon S3 CORS Configuration

To allow direct browser uploads to Amazon S3, ensure the following CORS configuration is applied to your S3 bucket in the AWS Console (**Bucket -> Permissions -> Cross-origin resource sharing (CORS)**):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://*.vercel.app"
    ],
    "ExposeHeaders": ["ETag"]
  }
]

```

---

## 🌐 Production Cloud Deployment Guide

| Subsystem | Cloud Host | Configuration |
| --- | --- | --- |
| **Backend API** | **Render** (Free Web Service) | Root Dir: `apps/api` | Build: `pip install -r requirements.txt` | Start: `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Frontend UI** | **Vercel** (Serverless Edge) | Root Dir: `apps/web` | Environment Variable: `NEXT_PUBLIC_API_URL=https://your-render-api.onrender.com` |
| **Storage & Workers** | **AWS** (ap-south-1) | Provisioned via AWS SAM (`template.yaml`) |

---

## 🧪 System Walkthrough & API Contracts

### 1. Multi-Tenant Authentication

* `POST /api/v1/auth/signup` $\rightarrow$ Hashes password via `bcrypt` and creates user record in DynamoDB.
* `POST /api/v1/auth/login` $\rightarrow$ Verifies password hash and returns signed JWT access token.

### 2. Direct S3 Upload Pipeline

* `POST /api/v1/assets/presigned-upload` $\rightarrow$ Returns short-lived SigV4 presigned PUT URL and writes `PENDING_UPLOAD` record to DynamoDB.
* Client streams binary payload directly to S3 bucket prefix `uploads/{userId}/{assetId}/{fileName}`.

### 3. Asynchronous Worker Processing

* S3 `ObjectCreated` event dispatches notification to SQS.
* Lambda worker processes media with Pillow, saves 300px `.webp` thumbnail to `/processed/{userId}/{assetId}/`, and updates DynamoDB status to `COMPLETED`.

### 4. Zero-Trust Asset Sharing & Delivery

* `GET /api/v1/assets/` $\rightarrow$ Lists authenticated user's assets.
* `GET /api/v1/assets/{asset_id}/download-url` $\rightarrow$ Generates secure download URL.
* `GET /api/v1/assets/shared/{asset_id}` $\rightarrow$ Resolves shared link preview for authenticated CloudVault users at `/share/[assetId]`.

---

## 📜 License

This project is open-source and available under the [MIT License](https://www.google.com/search?q=LICENSE).

```
