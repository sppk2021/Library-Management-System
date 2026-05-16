# LMS - Library Management System Architecture

## 1. System Overview
A professional, full-stack enterprise resource planning (ERP) tool for libraries, focusing on circulation precision, catalog metadata standards, and advanced administrative intelligence.

## 2. Technology Stack
- **Frontend**: React 18+, Vite, Tailwind CSS (Styling), Motion (Animations), Lucide React (Icons), Recharts (D3 visualization).
- **Backend**: Node.js, Express (API), JSON Web Tokens (Security), SQLite (Data Persistence).
- **Architecture**: Separated Client/Server model with a centralized database.

## 3. Database Schema (ERD)
- **users**: Unified identity management (Student, Librarian, Admin).
- **books**: Catalog supporting Physical, Digital, and Serial formats with MARC21/RDA standard fields.
- **categories**: Multi-level classification system.
- **borrow_records**: Transactional ledger tracking status (Borrowed, Returned, Overdue), borrow dates, and fine metrics.
- **serial_issues**: Specific issue tracking for parent publications.
- **system_config**: Global parameters (Loan limits, Fine rates).
- **logs**: Absolute audit trail for system transactions.

## 4. Key Modules
### Cataloging & Metadata
- Support for complex metadata records and storage slot assignments.
### Circulation Services
- Real-time inventory reduction, return processing, and automated overdue detection.
### Serials & Acquisitions
- Predictive issue arrival tracking and budget-mapped procurement flags.
### System Intelligence
- Advanced reporting on circulation trends, elite reader metrics, and resource utilization rates.

### System Intelligence & Auditing
- **Auditable Circulation Log**: Chronological record of every system transaction with status tracking (Borrowed, Returned, Overdue).
- **Relational Analytics**: Complex SQL joins providing insights into "Premier Titles" (most borrowed) and "Elite Readers" (student engagement).
- **Predictive Serials**: Issue-level tracking for magazines and journals.

## 6. UI/UX Principles
- **Distinctive Visual Identity**: Moving away from generic library software to a high-contrast, modern utility dashboard.
- **Micro-Interactions**: Hover-staggered list animations and shadow-morphism on action cards.
- **Technical Typography**: JetBrains Mono for data precision and Cormorant Garamond for refined headings.
