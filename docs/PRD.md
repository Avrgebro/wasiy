# Wasiy Product Requirements Document

## Overview

Wasiy is an operations-first dashboard for residential properties such as condos, multifamily buildings, and residential communities. It helps property teams manage resident/unit records, front desk visitor workflows, amenity reservations, vehicles, announcements, and basic operational reporting across one or more locations.

The initial product is a multi-tenant SaaS web application. Each customer has an Account, and each Account can manage multiple Locations. Account Admins control account setup and staff access, Location Managers run property operations, Front Desk / Security users handle visitor access workflows, and Residents use a responsive web portal for self-service.

The v1 product language should be Spanish. The product should be implemented with future English support in mind, so user-facing copy should not be hard-coded in a way that prevents localization.

## Product Positioning

Wasiy should optimize first for property operations, with enough resident self-service to reduce staff workload.

The v1 product should feel like an operational command center, not an accounting platform, CRM, messaging platform, or full property-management suite. Finance, maintenance, documents, packages, parking enforcement, and advanced analytics are future expansion areas.

## Primary Users

### Account Admin

The Account Admin manages the account, locations, staff users, role assignments, and cross-location visibility. In v1, only Account Admins can create staff users or change staff roles.

### Location Manager

The Location Manager manages one or more assigned Locations. They handle units, residents, vehicles, amenities, reservations, announcements, visitor visibility, manual reservation fee status, exports, and operational activity.

### Front Desk / Security

Front Desk / Security users handle visitor check-in records, look up units and residents, and view operational information needed for access control.

### Resident

Residents use the Resident Portal to pre-register visitors, reserve amenities, view announcements, update limited contact information, and manage vehicles for their unit.

## V1 Scope

### Account and Location Management

- Account Admin can manage one Account.
- An Account can contain multiple Locations.
- Users can be assigned to one or more Locations.
- Location-scoped users only see data for assigned Locations.
- All operational records belong to an Account and usually to a Location.
- A User may have access to multiple Accounts. If a User has multiple Accounts, they must select an active Account before entering the dashboard.
- After an active Account is selected, Users with access to multiple Locations can switch Location context inside the dashboard.

### Roles and Permissions

V1 roles:

- Account Admin
- Location Manager
- Front Desk / Security
- Resident

Account Admins can create staff users and assign roles. Location Managers can manage operational records for assigned Locations, but cannot create staff users or change staff roles in v1.

### Resident and Unit Registry

- Create and manage Units within a Location.
- Create and manage Residents.
- Support Unit Memberships between Residents and Units.
- Allow one Resident to belong to multiple Units.
- Allow each Unit to designate a primary contact.
- Track resident type per Unit Membership, such as Owner, Tenant, Occupant, or Guest Resident.
- Track active/inactive status.
- Store basic resident contact information.
- Invite Residents to claim portal access.
- Support CSV import for Units, Residents, and related registry data.

### Vehicles

- Track vehicles associated with Residents or Units.
- Residents can add, edit, and remove vehicles through the Resident Portal.
- Managers can view and manage vehicle records.
- Vehicle exports are available as CSV.

### Visitor Management

V1 supports two visitor flows:

- Resident pre-registers a visitor for a single date.
- Front Desk / Security creates a walk-in visitor record at arrival.

Visitor management should not require an in-app approval workflow. If a building confirms visitors by intercom or phone, the system may record the confirmation method, but the app does not block check-in until approval is completed inside the product.

Visitor check-in records should include:

- Visitor name
- Optional phone
- Optional ID/reference text, without storing ID images in v1
- Host Resident or Unit
- Location
- Visit date and expected time
- Confirmation method, such as pre-registered, intercom, phone, manager confirmation, or not required
- Notes
- Checked-in timestamp
- User who recorded check-in

Check-out time is optional and should not be treated as reliable, because visitors often leave without interacting with staff or the system.

Recurring visitor authorization is out of v1.

### Amenities and Reservations

- Managers can create and edit Amenities.
- Amenities may include uploaded photos for presentation.
- Amenities can be reservable or non-reservable.
- Amenities can define availability days/hours.
- Amenities can use instant booking or require Location Manager approval.
- Residents can create reservations for their Unit.
- Reservation ownership belongs to the Unit; the creating Resident is recorded.
- Reservation limits should apply at the Unit level, not per individual resident.
- Managers can approve, reject, edit, or cancel reservations.
- Residents can see their upcoming reservations.
- Staff can see today and upcoming reservation schedules.

### Manual Reservation Fees and Deposits

V1 supports manual tracking of reservation-related fees and deposits only.

- Amenities may define a fee or deposit.
- Reservations can show paid/unpaid/manual status.
- Managers can mark reservation fees or deposits as paid or unpaid.
- No online payment processing in v1.
- No unit balances, dues, invoices, rent, refunds, partial payments, or full ledger in v1.

### Announcements

- Account Admins or Location Managers can post announcements.
- Announcements can target a Location.
- Residents can view announcements in the Resident Portal.
- V1 announcements are simple posts.
- No read receipts, comments, delivery tracking, or messaging threads.

### Notifications

V1 notifications are email-only and limited to account-critical actions:

- Staff user invitations
- Resident invitations
- Reservation approval or rejection
- Optional new announcement email

Push, SMS, and WhatsApp are out of v1.

### Dashboards

The dashboard should be operational, not analytics-heavy.

Account Admin dashboard:

- All locations overview
- Pending reservation approvals
- Recent visitor volume
- Resident invitation status
- Registry completeness
- Quick links for locations and users

Location Manager dashboard:

- Today’s visitors
- Pending reservations
- Today/upcoming amenity reservations
- Recent announcements
- Unit and resident counts
- Unclaimed resident invitations

Front Desk dashboard:

- Today’s expected visitors
- Recent check-ins
- Quick unit/resident search
- Current amenity schedule

Resident dashboard:

- Upcoming reservations
- Visitor pre-registrations
- Recent announcements
- Household/unit information

### Activity Log

V1 should keep an activity log for sensitive operational events:

- User invited, role changed, or deactivated
- Resident invited or deactivated
- Unit Membership changed
- Visitor pre-registration created or cancelled
- Visitor check-in recorded
- Reservation created, approved, rejected, or cancelled
- Amenity settings changed
- Announcement posted
- Reservation fee/deposit marked paid or unpaid

The activity log should be visible to Account Admins and Location Managers for their permitted scope.

### Exports

V1 supports basic CSV exports:

- Units and residents
- Vehicles
- Visitor check-ins by date range
- Reservations by amenity and date range
- Reservation fees and deposits
- Activity log entries

No custom report builder in v1.

## V1 Product Surfaces

### Admin Dashboard

Responsive web interface for Account Admins and Location Managers.

### Front Desk Interface

Focused web interface for visitor check-in, resident/unit lookup, and daily operational visibility.

### Resident Portal

Responsive web portal for residents. No native iOS or Android app in v1.

### Marketing Site

Minimal public website for the root domain. The marketing site should explain the product, provide basic pricing or demo-request information, and link users to the app login.

## Language and Localization

V1 should launch with Spanish as the primary interface language. The product should be structured so English can be added later without rewriting screens, validation messages, notifications, or operational labels.

Initial localization expectations:

- Spanish UI copy for all v1 user-facing screens.
- Spanish email templates for v1 notifications.
- Spanish validation and error messages where practical.
- Date, time, and number formatting should respect the active locale.
- English support is a future requirement, not a v1 content-completion requirement.

## Out of Scope for V1

- Full accounting
- Online payments
- Unit balances, dues, invoices, rent, refunds, and ledgers
- Expense management
- Maintenance requests
- Documents and file libraries
- Pets
- Packages and deliveries
- Incident logs
- Recurring visitors
- Visitor ID/photo uploads
- Native mobile apps
- Push, SMS, or WhatsApp notifications
- Read receipts or messaging threads
- Custom report builder
- Vendor management
- Parking enforcement
- Marketing blog, CMS, case studies, complex animations, newsletter automation, and payment checkout

## Future Phases and Brainstorm Backlog

### Finance

- Monthly condo dues or rent-like charges
- Online payments
- Payment receipts
- Invoices
- Unit balances
- Refunds and deposits
- Expense tracking
- Budgeting
- Financial exports
- Accounting integrations

### Maintenance

- Resident maintenance requests
- Staff assignment
- Photos and attachments
- Status workflow
- Vendor coordination
- Cost tracking
- SLA reporting

### Documents

- Rules and policies
- Bylaws
- Forms
- Lease or ownership documents
- Resident acknowledgements
- Document visibility by Location or Unit

### Packages

- Package intake
- Resident notification
- Pickup confirmation
- Package history

### Incidents

- Security and rule violation logs
- Follow-up status
- Internal notes
- Attachment support
- Exportable incident reports

### Parking

- Parking spot assignments
- Visitor parking passes
- Vehicle permits
- Parking violations
- Enforcement reports

### Advanced Visitor Access

- Recurring visitor authorization
- Contractor/vendor access
- QR codes
- Kiosk mode
- Access-control hardware integrations

### Advanced Reservations

- Reservation cancellation rules
- Deposits and refunds
- Reservation waivers
- Capacity management
- Guest lists
- Amenity-specific policies

### Communications

- Email digests
- Push notifications
- SMS/WhatsApp integrations
- Delivery/read tracking
- Comment threads or resident replies

### Analytics

- Occupancy trends
- Visitor volume trends
- Amenity utilization
- Reservation revenue
- Operational workload
- Export scheduling

## Success Criteria

V1 is successful if a small-to-mid residential property can:

- Onboard its units and residents using CSV import.
- Invite residents to a portal.
- Maintain an accurate resident/unit/vehicle registry.
- Let residents pre-register visitors.
- Let Front Desk / Security record visitor check-ins quickly.
- Let residents reserve amenities.
- Let managers approve reservations where required.
- Track reservation-related fees/deposits manually.
- Communicate basic announcements.
- Export operational records.
- Review sensitive operational activity.

## Open Questions

- What markets/countries should the first version target?
- Which Spanish regional variant should be treated as the default product voice?
- What identity provider or authentication approach should be used?
- What payment provider should be considered for the later finance phase?
- Should CSV import have strict templates or flexible column mapping?
- What minimum audit retention period is required?
- What data privacy requirements apply to visitor logs and resident records?
- Should Location Managers be allowed to impersonate or assist residents?
- Should resident invitations expire?
- Should reservations support cancellation windows in v1?
