# Context

## Glossary

### Account

The top-level customer workspace. An Account is managed by one primary Admin and can manage multiple Locations.

### Active Account

The Account currently selected as the User's workspace. Users with access to multiple Accounts must select an Active Account before entering account-scoped dashboard routes.

### Plan

A priced offer for an Account: a code, a name, a unit price in minor units and currency, the units included in the base price, a location limit and a feature list. Plans are seeded, not user-created; only available plans can be chosen at registration.

### Subscription

The one row that ties an Account to its Plan: status (trialing, active, expired), the unit price and currency locked at signup, the billable units, the trial window, the Access Until date and when the terms were accepted. Accounts created by hand have none and are never gated.

### Trial

The free period that self-serve registration starts, fourteen days from completion. During the trial the Subscription status is trialing and Access Until equals the trial end.

### Access Until

The moment the staff surface stops answering for an Account. Enforcement reads this date, never the status; a payment extends it. The resident portal ignores it.

### Admin

The primary manager of an Account. The Admin can add Users and assign them to Locations.

### User

A person who can access the system under an Account. Users may have operational roles such as front desk staff and can be assigned to one or more Locations.

### Account Admin

The highest-privilege role in an Account. The Account Admin manages account settings, Locations, Users, role assignments, records, and cross-location reporting. In the initial product, only the Account Admin can create staff Users or change staff roles.

### Staff Membership

The stored relationship between a User and an Account as staff (one row per Account and User). The membership owns the optional Account-level role and per-account deactivation; Location roles belong to the membership. Account role and Location roles are mutually exclusive: an Account Admin already reaches every Location. A deactivated Staff Membership keeps the member listed with history but grants no access in that Account, without affecting the User's login or other Accounts.

### Staff Invitation

An invitation for a User to join an Account in an operational staff role. A Staff Invitation may include Account-level authority or Location assignments, but the staff relationship belongs to the Account even when the invitation is started from a Location screen.

### Location Manager

A User assigned to manage one or more Locations. A Location Manager can manage operational records for assigned Locations, including Units, Residents, visitors, amenities, reservations, reservation-related payment status, vehicles, and announcements.

### Front Desk / Security

A User assigned to front desk or security workflows for one or more Locations. This role handles visitor check-in records, searches Residents and Units, and views operational information needed for access control.

### Visitor

A non-resident person who is authorized to enter a Location for a limited purpose or time, usually connected to a Resident, Unit, reservation, delivery, service visit, or staff confirmation. The system records visitor access but does not require an in-app approval workflow before check-in.

### Visitor Pre-Registration

A single-date visitor record created before arrival, usually by a Resident for their Unit. Front Desk / Security can use the pre-registration to identify and check in the Visitor when they arrive.

### Visitor Check-In

An operational log created when Front Desk / Security records that a Visitor entered a Location. Check-out time may be absent because Visitors often leave without interacting with staff or the system.

### Amenity

A shared facility inside a Location that may be reserved or managed, such as a pool, gym, event room, meeting room, court, or rooftop space. Amenities may include uploaded photos for presentation in the initial product.

### Reservation

A scheduled use of an Amenity owned by a Unit and usually created by a Resident associated with that Unit. Reservations may be instant-booked when the Amenity allows it or require Location Manager approval when the Amenity has an approval policy.

### Payment

A financial amount owed or paid by a Resident, Unit, or other responsible party to the Location or Account. In the initial product, payment tracking is limited to manual status for reservation-related fees and deposits; full balances, dues, invoices, and online payment processing belong to a later finance phase.

### Expense

A financial cost incurred by a Location or Account, such as maintenance, utilities, supplies, repairs, or vendor services.

### Announcement

A message posted by Account or Location staff for Residents or Users. In the initial product, announcements are simple portal-visible posts without delivery tracking, read receipts, or messaging threads.

### Notification

A system-generated message sent to a User or Resident. In the initial product, notifications are email-only for account-critical actions such as invitations, reservation decisions, and optionally new announcements; push, SMS, and WhatsApp are outside the initial scope.

### Admin Dashboard

The web interface used by Account Admins and Location Managers to manage account, location, registry, visitor, reservation, vehicle, announcement, and reporting workflows.

### Front Desk Interface

The web interface used by Front Desk / Security users to handle visitor check-in and access-control support workflows.

### Resident Portal

The responsive web interface used by Residents to manage their own resident-facing workflows, such as visitor pre-registration, amenity reservations, announcements, and profile information.

### Resident Self-Service

Resident-facing capabilities that allow Residents to maintain limited personal and Unit-related data. In M3, Residents can update their own phone number and manage Vehicles for their active Units, but cannot change name, email, resident type, Unit Membership, or Primary Contact status.

### Activity Log

A record of sensitive operational events, such as role changes, resident invitations, unit membership changes, visitor check-ins, reservation decisions, amenity setting changes, announcements, and manual reservation fee status changes.

### Maintenance Request

A request to repair, inspect, or resolve an issue related to a Unit, Amenity, common area, or Location.

### Document

A file or record shared inside the system, such as rules, bylaws, policies, forms, contracts, or notices.

### Vehicle

A car, motorcycle, bicycle, or other transport asset registered to a Unit. Vehicles are managed from the Unit (there is no separate vehicles surface); staff find a vehicle by plate from the Units list. Parking spots are labels on the Unit, not records of their own. Visitor vehicles and parking permissions belong to later phases.

### Package

A delivery received, stored, or released by staff for a Resident or Unit.

### Incident

A logged security, safety, rule, or operational event that staff need to record and potentially follow up on.

### Location

A whole residential property managed under an Account, such as a condo, multifamily building, or residential community. A Location contains Units, Residents, Amenities, Staff assignments, visitor activity, payments, and expenses.

### Active Location

The Location currently selected as the User's default operational scope inside the Active Account. Location-scoped workflows still validate access to the specific Location they operate on.

### Accessible Location

A Location that a User is allowed to operate in or view within an Account. Access may come from an explicit Location role assignment or from an Account-level role that grants implicit Location access.

### Unit

A residential space inside a Location, such as an apartment, condo unit, suite, or house number. In the initial product, Units are not parking spots, storage lockers, or other non-residential assets.

### Inactive Registry Record

A Unit, Resident, Unit Membership, or Vehicle that remains in the system for historical context but is no longer available for normal future operations. Records with meaningful operational history should become inactive instead of being hard-deleted.

### Unit Membership

The association between a Resident and a Unit. A Resident may have memberships in multiple Units, and each membership can have its own resident type and status. A Unit may designate one membership as the primary contact.

### Primary Contact

The active Unit Membership designated as the main contact for a Unit. A Unit may have zero or one Primary Contact. Setting a Unit Membership as Primary Contact replaces the previous Primary Contact for that Unit, and inactive memberships cannot remain Primary Contact.

### Resident Type

The Resident's relationship to a specific Unit Membership. Initial fixed Resident Types are Owner, Tenant, Occupant, and Guest Resident. Resident Type belongs to the Unit Membership, not to the Resident globally.

### Resident

A person who lives in a Unit. Residents belong to an Account, and their Location relationship comes through Unit Memberships. A membership carries no role (owner, tenant, …): it means the person lives there, and at most one member is the Unit's primary contact. Owners who do not live in the building are not Residents; if the product needs them (dues, assemblies) they belong on the Unit as an owner contact, not in the directory. Residents may have login access to resident-facing features such as visitor pre-registration, amenity reservations, profile management, payment visibility, and announcements.

### Resident Invitation

An invitation that allows a Resident to claim login access to the resident-facing portal for their Unit. In M3, a Resident Invitation is a token-based claim flow that links a Resident to a User and enables portal access for that Resident.
