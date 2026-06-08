# Active Account Selection for Multi-Account Users

Wasiy will allow a User to have access to multiple Accounts and will require an active Account context before rendering account-scoped dashboard routes when more than one Account is available. This follows the account-picker pattern used by products such as Stripe: Account is the tenant boundary, while Location is selected or switched inside the dashboard as an operational scope.
