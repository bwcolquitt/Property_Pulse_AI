# PropertyPulse - Rental Turnover & Property Readiness Platform

## Product Overview
PropertyPulse is a modern, mobile-first platform for short-term rental turnover management. It unifies reservation-driven turnover scheduling, cleaning checklists, maintenance tracking, inspections, vendor marketplace, messaging, and reporting into a single beach-themed application.

## Tech Stack
- **Frontend**: React Native (Expo SDK 54) with Expo Router, TypeScript
- **Backend**: Python FastAPI with Motor (async MongoDB)
- **Database**: MongoDB
- **Auth**: JWT (email/password) + Google OAuth ready
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key (configured, to be integrated)
- **Theme**: Beach/coastal light theme with teal primary (#006D77), coral accent (#E29578)

## MVP Features (First Release)

### Authentication
- [x] JWT-based login/register with Bearer tokens
- [x] Role-based access (Manager, Cleaner, Vendor, Inspector)
- [x] Demo quick-login buttons
- [ ] Google OAuth integration (endpoints ready)

### Dashboard
- [x] Welcome greeting with readiness score
- [x] Quick stats (Today's Turnovers, At Risk, Inspections, Properties)
- [x] **Outstanding Maintenance Widget** (flagship - total open, urgent, due today, unassigned, blocking guest)
- [x] Recent Issues list with priority dots and blocks badges
- [x] Quick Actions (New Turnover, Report Issue, Messages, Reports)

### Turnovers
- [x] List view with status filters
- [x] Card-based design with status badges, progress bars, risk indicators
- [x] Turnover detail with property info, timing, checklist progress, linked issues
- [x] Status workflow (New → Assigned → In Progress → Ready for Inspection → Completed)
- [x] Checklist execution with room-by-room tasks, photo requirements, progress tracking

### Maintenance Command Center
- [x] **Top-level module** (not buried in turnovers)
- [x] Outstanding as default landing view
- [x] Sub-navigation: Outstanding, Unassigned, In Progress, Awaiting Approval, Awaiting Parts, Scheduled, Completed, Reopened
- [x] Rich issue cards with priority, status, property, trade type, due date, blocks-check-in flag, guest impact
- [x] Issue detail with description, timeline, comments, status actions
- [x] Status workflow with full history tracking

### Marketplace
- [x] Provider directory with filtering (Cleaners, Maintenance)
- [x] Provider cards with ratings, response rates, emergency availability
- [x] Service listings with pricing
- [x] Book Now and Message actions

### Messaging
- [x] Conversation list by turnover/maintenance thread
- [x] Chat interface with message bubbles
- [x] Send messages to participants

### Reports
- [x] Report types: Outstanding Maintenance, Guest Readiness, Turnover Completion, Cleaner Scorecard, Issue Trends, Vendor Performance
- [x] CSV export endpoints

### Properties
- [x] Property list with open issues/turnovers counts
- [x] Property detail with access info (lock codes, WiFi, parking)

### Team Management
- [x] Team member list with roles and assignment counts

### Settings
- [x] Account, Integrations, Organization, Support sections

## Database Schema
- 25+ collections including: users, properties, property_access, reservations, turnovers, checklist_templates, checklist_template_items, turnover_checklists, turnover_checklist_items, issues, issue_status_history, issue_comments, inspections, inventory_items, inventory_levels, providers, provider_services, provider_service_areas, job_posts, conversations, messages, media

## Seed Data
- 5 users (Manager, 2 Cleaners, Vendor, Inspector)
- 4 beach properties (Malibu, Santa Monica, Newport Beach, Laguna Beach)
- 6 reservations across properties
- 5 turnovers in various statuses
- 8 maintenance issues (various priorities and statuses)
- 18 checklist template items across 6 rooms
- 3 marketplace providers
- 2 conversations with messages

## Color System
- Green (#10B981): Ready/Completed
- Yellow (#F59E0B): At Risk
- Red (#EF4444): Urgent/Blocks Check-in
- Blue (#3B82F6): Assigned/Scheduled
- Purple (#8B5CF6): Awaiting Approval
- Gray (#9CA3AF): Cancelled/Inactive

## Next Release Features
- [ ] AI-powered checklist generation (GPT-5.2)
- [ ] AI severity classification & risk scoring
- [ ] Inspection module with scorecards
- [ ] Inventory management with par levels
- [ ] Full marketplace with quotes/bidding
- [ ] Map views for properties/providers
- [ ] Calendar view for turnovers
- [ ] Push notifications
- [ ] Photo/video upload and gallery
- [ ] CSV/PDF report downloads
- [ ] Owner/investor reports

## Business Enhancement
Consider adding a **Predictive Readiness Score** using AI that analyzes historical turnover data, issue patterns, and cleaner performance to predict which properties are likely to have problems before the next guest arrival. This could be offered as a premium feature in the Growth+ tier.
