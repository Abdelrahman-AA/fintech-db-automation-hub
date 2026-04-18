# Fintech DB Automation Hub

An advanced automation framework designed for high-integrity database testing in Fintech environments. This project implements a **Mock Database Sandbox** strategy, enabling **Shift-Left Testing** by validating business logic and data constraints directly at the database level, independent of API or UI availability.

## 🌟 Overview

In Fintech, data integrity is paramount. This hub ensures that the core data layer adheres to strict financial rules, audit requirements, and referential integrity. By using a "Provision-then-Test" approach, we simulate complex financial ecosystems in seconds.

### Key Features:
* **Mock Database Sandbox:** Isolated PostgreSQL environments (via Neon/Docker) for safe, destructive testing.
* **Data Provisioning Tool:** Custom TypeScript engine utilizing **Faker.js** to generate high-fidelity financial data (Users, Wallets, Transactions).
* **Schema & Integrity Validation:** Automated checks for triggers, constraints, and audit trail consistency.
* **CI/CD Integration:** Fully automated pipeline using **GitHub Actions** with automated deployment to **GitHub Pages**.

---

## 📊 Live Test Report

You can view the latest automation execution results, including detailed test steps, traces, and performance metrics, hosted on GitHub Pages:

🔗 **[Live Playwright Report](https://abdelrahman-aa.github.io/fintech-db-automation-hub/)**

---

## 🛠 Tech Stack

* **Language:** TypeScript
* **Test Runner:** Playwright (API/DB Testing Mode)
* **Database:** PostgreSQL
* **Data Generation:** Faker.js
* **CI/CD:** GitHub Actions & GitHub Pages
* **Environment Management:** Dotenv & Cross-env

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v20 or higher)
* **PostgreSQL** (Local instance or Neon.tech connection string)
* **Git**

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Abdelrahman-AA/fintech-db-automation-hub.git
    cd fintech-db-automation-hub
    ```

2. **Full Project Setup:**
   Run the following command to clean the environment, install dependencies for all sub-packages (Data Tool & Testing Framework), and install Playwright browsers:
    ```bash
    npm run setup:run
    ```

3.  **Environment Setup:**
    Create a `.env` file in the root directory:
    ```env
    DATABASE_URL=your_postgresql_connection_string
    ```

### Running the Automation

* **Complete Pipeline (Setup + Seed + Test):**
    This command uses an advanced Node.js ESM loader to execute the provisioning scripts followed by the test suite:
    ```bash
    npm run test:full
    ```
    *This command initializes the schema, seeds the database with 1000+ records, and executes the Playwright test suite.*

* **Individual Components:**
    * Initialize DB Schema: `cd data-provisioning-tool && npm run db:init`
    * Seed Data: `cd data-provisioning-tool && npm run db:seed`
    * Run Tests Only: `cd db-testing-framework && npx playwright test`

---

## 📊 Automation Strategy

### 1. Shift-Left Implementation
By testing the database schema and triggers before the backend services are even deployed, we identify architectural flaws and constraint violations early in the SDLC.

### 2. Data Provisioning Tool
Instead of using static snapshots, our tool dynamically generates:
* **Users:** With randomized statuses and metadata.
* **Wallets:** Verified 1:1 mapping with multi-currency support.
* **Transactions:** Complex transfer logic with UUIDs and audit logs.

### 3. CI/CD & Reporting
Every push to `main` triggers a GitHub Action that:
1.  Spins up a Node.js environment.
2.  Provisions the Sandbox Database.
3.  Runs the full test suite.
4.  Deploys a live HTML Report to **GitHub Pages**.

---

## 🏗 Project Structure

```text
fintech-db-automation-hub/
├── .github/
│   └── workflows/
│       └── playwright.yml            # CI/CD pipeline and GitHub Pages deployment
├── data-provisioning-tool/           # Shift-Left Data Tool
│   ├── src/
│   │   ├── check-conn.ts             # Database connection validator
│   │   ├── init-db.ts                # Schema and Triggers initialization
│   │   └── seeder.ts                 # Data generation engine (Faker.js)
│   ├── package.json
│   └── tsconfig.json
├── db-testing-framework/             # Core Test Suite
│   ├── repositories/                 # Data Access Object (DAO) layer
│   │   ├── TransactionRepository.ts
│   │   ├── UserRepository.ts
│   │   └── WalletRepository.ts
│   ├── tests/                        # Comprehensive test specifications
│   │   ├── audit-trail-verification.spec.ts
│   │   ├── business-rules-compliance.spec.ts
│   │   ├── data-boundary-constraints.spec.ts
│   │   ├── referential-integrity-orphans.spec.ts
│   │   ├── schema-integrity.spec.ts
│   │   ├── transaction-flow-logic.spec.ts
│   │   ├── user-entity-validation.spec.ts
│   │   └── wallet-financial-consistency.spec.ts
│   ├── playwright.config.ts          # Playwright configuration
│   └── package.json
├── .env.example                      # Example environment variables
├── .gitignore
├── LICENSE
├── package.json                      # Root orchestrator
└── README.md
```

---

## 👤 Author

**Abdelrahman Abodief**
* Software Quality & Automation Engineer

---
